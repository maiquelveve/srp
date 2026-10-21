import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { escapeLike } from '../../common/like.util';
import { APP_CONFIG } from '../../config/app-config.module';
import { AppConfig } from '../../config/configuration';
import { detectFileFormat, matchesDeclaredExtension } from '../../documents/file-signature';
import { User } from '../../users/entities/user.entity';
import { KnowledgeDocument, KnowledgeDocumentStatus } from '../entities/knowledge-document.entity';
import { CreateKnowledgeDocumentDto } from './dto/create-knowledge-document.dto';
import { KnowledgeDocumentResponseDto } from './dto/knowledge-document-response.dto';
import { ListKnowledgeDocumentsQueryDto } from './dto/list-knowledge-documents-query.dto';
import { IngestionQueue } from './ingestion-queue';
import { KNOWLEDGE_FILE_FORMATS, KnowledgeFileFormat } from './text-extractor';

const UNIQUE_VIOLATION_CODE = '23505';
const DUPLICATE_NAME_MESSAGE = 'Já existe um documento com esse nome na base de conhecimento';
const UNSUPPORTED_FORMAT_MESSAGE = 'Formato de arquivo não permitido. Envie PDF, DOCX ou TXT.';
const DOCUMENT_NOT_FOUND_MESSAGE = 'Documento não encontrado';
const DEFAULT_LIST_LIMIT = 20;

/** Tipo de conteúdo devolvido ao abrir o arquivo; o formato guardado vem da detecção pelo conteúdo. */
const MIME_TYPE_BY_FORMAT: Record<KnowledgeFileFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain; charset=utf-8',
};

export interface KnowledgeDocumentFileInfo {
  absolutePath: string;
  mimeType: string;
  originalFileName: string;
}

@Injectable()
export class KnowledgeDocumentsService {
  private readonly storagePath: string;

  constructor(
    @InjectRepository(KnowledgeDocument)
    private readonly documents: Repository<KnowledgeDocument>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly ingestionQueue: IngestionQueue,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.storagePath = config.knowledge.storagePath;
  }

  /**
   * Valida, guarda o arquivo, cria o registro `PROCESSING` e enfileira a ingestão.
   * O limite de tamanho (`413`) já foi aplicado pelo `FileInterceptor` no controller.
   */
  async create(
    file: Express.Multer.File | undefined,
    dto: CreateKnowledgeDocumentDto,
    actingUserId: number,
  ): Promise<KnowledgeDocumentResponseDto> {
    if (!file) {
      throw new BadRequestException('Arquivo obrigatório');
    }
    // Confere o CONTEÚDO do arquivo, não só a extensão; `.doc` fica de fora.
    if (!matchesDeclaredExtension(file.originalname, file.buffer, KNOWLEDGE_FILE_FORMATS)) {
      throw new BadRequestException(UNSUPPORTED_FORMAT_MESSAGE);
    }
    const fileFormat = detectFileFormat(file.buffer) as KnowledgeFileFormat;

    // Nome gerado (UUID): evita colisão e path traversal; o nome original só vai para exibição.
    const generatedFileName = `${randomUUID()}.${fileFormat}`;
    await fs.mkdir(this.storagePath, { recursive: true });
    await fs.writeFile(join(this.storagePath, generatedFileName), file.buffer);

    try {
      // Documento e auditoria na mesma transação: ou os dois existem, ou nenhum.
      const created = await this.dataSource.transaction(async (manager) => {
        const saved = await manager.save(
          manager.getRepository(KnowledgeDocument).create({
            name: dto.name,
            filePath: generatedFileName,
            originalFileName: file.originalname,
            fileFormat,
            sizeBytes: file.size,
            status: KnowledgeDocumentStatus.PROCESSING,
            uploadedBy: { id: actingUserId } as User,
          }),
        );
        await this.auditService.record(
          {
            userId: actingUserId,
            affectedTable: 'knowledge_documents',
            recordId: saved.id,
            action: AuditAction.INSERT,
            oldData: null,
            newData: {
              name: saved.name,
              fileFormat,
              originalFileName: saved.originalFileName,
              sizeBytes: saved.sizeBytes,
            },
          },
          manager,
        );
        return saved;
      });

      // Só enfileira depois do commit, para a fila nunca ver um documento que não existe.
      this.ingestionQueue.enqueue(created.id);
      return KnowledgeDocumentResponseDto.fromEntity(created);
    } catch (error) {
      // Falhou depois de gravar o arquivo: remove o órfão do disco.
      await fs.unlink(join(this.storagePath, generatedFileName)).catch(() => undefined);
      // Nome repetido, inclusive em envios simultâneos, é barrado pelo índice único do banco.
      const driverError = (error as QueryFailedError).driverError as { code?: string } | undefined;
      if (error instanceof QueryFailedError && driverError?.code === UNIQUE_VIOLATION_CODE) {
        throw new ConflictException(DUPLICATE_NAME_MESSAGE);
      }
      throw error;
    }
  }

  /** Caminho e metadados do arquivo guardado, para a tela abrir o documento original. */
  async getFileInfo(id: number): Promise<KnowledgeDocumentFileInfo> {
    const document = await this.documents.findOne({ where: { id } });
    if (!document) {
      throw new NotFoundException(DOCUMENT_NOT_FOUND_MESSAGE);
    }

    const absolutePath = join(this.storagePath, document.filePath);
    try {
      await fs.access(absolutePath);
    } catch {
      // Linha existe no banco mas o arquivo sumiu do disco: mesma resposta de "não encontrado".
      throw new NotFoundException(DOCUMENT_NOT_FOUND_MESSAGE);
    }

    return {
      absolutePath,
      mimeType: MIME_TYPE_BY_FORMAT[document.fileFormat as KnowledgeFileFormat],
      originalFileName: document.originalFileName,
    };
  }

  /** Mais recentes primeiro, com busca por nome e paginação. */
  async list(
    query: ListKnowledgeDocumentsQueryDto,
  ): Promise<PaginatedResponseDto<KnowledgeDocumentResponseDto>> {
    const queryBuilder = this.documents
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.uploadedBy', 'uploadedBy')
      .orderBy('document.createdAt', 'DESC');

    if (query.search) {
      queryBuilder.andWhere('document.name ILIKE :search', {
        search: `%${escapeLike(query.search)}%`,
      });
    }

    const total = await queryBuilder.getCount();
    const rows = await queryBuilder
      .take(query.limit ?? DEFAULT_LIST_LIMIT)
      .skip(query.offset ?? 0)
      .getMany();

    return new PaginatedResponseDto(
      rows.map((row) => KnowledgeDocumentResponseDto.fromEntity(row)),
      total,
    );
  }
}
