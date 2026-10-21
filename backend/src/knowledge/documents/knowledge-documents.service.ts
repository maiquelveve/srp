import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
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
import { UpdateKnowledgeDocumentDto } from './dto/update-knowledge-document.dto';
import { IngestionQueue } from './ingestion-queue';
import { KNOWLEDGE_FILE_FORMATS, KnowledgeFileFormat } from './text-extractor';

const UNIQUE_VIOLATION_CODE = '23505';
const DUPLICATE_NAME_MESSAGE = 'Já existe um documento com esse nome na base de conhecimento';
const UNSUPPORTED_FORMAT_MESSAGE = 'Formato de arquivo não permitido. Envie PDF, DOCX ou TXT.';
const DOCUMENT_NOT_FOUND_MESSAGE = 'Documento não encontrado';
const DEFAULT_LIST_LIMIT = 20;
const NOTHING_TO_UPDATE_MESSAGE = 'Informe um novo nome ou um novo arquivo';
const DOCUMENT_BUSY_MESSAGE =
  'O documento está sendo processado. Aguarde terminar e tente novamente';
const NOT_REPROCESSABLE_MESSAGE =
  'Só é possível reprocessar documentos que falharam ou que precisam de reprocessamento';

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
  private readonly logger = new Logger(KnowledgeDocumentsService.name);
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

  /**
   * Renomeia e/ou troca o arquivo (FR-020). Só o nome: `200`, sem reprocessar. Com arquivo
   * novo e documento `READY`: vira `UPDATING` e a versão atual segue pesquisável até a troca.
   * Documento sem versão utilizável (`FAILED`/`NEEDS_REPROCESS`) não tem o que preservar:
   * o arquivo é trocado já e ele volta a `PROCESSING`.
   */
  async update(
    id: number,
    file: Express.Multer.File | undefined,
    dto: UpdateKnowledgeDocumentDto,
    actingUserId: number,
  ): Promise<KnowledgeDocumentResponseDto> {
    if (!file && dto.name === undefined) {
      throw new BadRequestException(NOTHING_TO_UPDATE_MESSAGE);
    }

    const document = await this.findOrFail(id);
    if (this.isBeingProcessed(document)) {
      throw new ConflictException(DOCUMENT_BUSY_MESSAGE);
    }
    if (dto.name !== undefined) {
      await this.assertNameAvailable(dto.name, id);
    }

    if (!file) {
      return this.rename(document, dto.name as string, actingUserId);
    }
    if (!matchesDeclaredExtension(file.originalname, file.buffer, KNOWLEDGE_FILE_FORMATS)) {
      throw new BadRequestException(UNSUPPORTED_FORMAT_MESSAGE);
    }
    const fileFormat = detectFileFormat(file.buffer) as KnowledgeFileFormat;
    const generatedFileName = `${randomUUID()}.${fileFormat}`;
    await fs.mkdir(this.storagePath, { recursive: true });
    await fs.writeFile(join(this.storagePath, generatedFileName), file.buffer);

    const keepsCurrentVersion = document.status === KnowledgeDocumentStatus.READY;
    try {
      const updated = await this.dataSource.transaction(async (manager) => {
        // Condicionar ao estado lido barra duas atualizações simultâneas do mesmo documento.
        const result = await manager.update(
          KnowledgeDocument,
          { id, status: document.status },
          {
            name: dto.name ?? document.name,
            failureReason: null,
            uploadedBy: { id: actingUserId } as User,
            ...(keepsCurrentVersion
              ? {
                  status: KnowledgeDocumentStatus.UPDATING,
                  pendingFilePath: generatedFileName,
                  pendingOriginalFileName: file.originalname,
                }
              : {
                  status: KnowledgeDocumentStatus.PROCESSING,
                  filePath: generatedFileName,
                  originalFileName: file.originalname,
                  fileFormat,
                  sizeBytes: file.size,
                  chunkCount: 0,
                }),
          },
        );
        if (result.affected !== 1) {
          throw new ConflictException(DOCUMENT_BUSY_MESSAGE);
        }
        await this.auditService.record(
          {
            userId: actingUserId,
            affectedTable: 'knowledge_documents',
            recordId: id,
            action: AuditAction.UPDATE,
            oldData: this.auditSnapshot(document),
            newData: {
              name: dto.name ?? document.name,
              status: keepsCurrentVersion
                ? KnowledgeDocumentStatus.UPDATING
                : KnowledgeDocumentStatus.PROCESSING,
              fileFormat,
              originalFileName: file.originalname,
              sizeBytes: file.size,
            },
          },
          manager,
        );
        return manager.findOneOrFail(KnowledgeDocument, {
          where: { id },
          relations: { uploadedBy: true },
        });
      });

      if (!keepsCurrentVersion) {
        await this.removeFileQuietly(document.filePath);
      }
      this.ingestionQueue.enqueue(id);
      return KnowledgeDocumentResponseDto.fromEntity(updated);
    } catch (error) {
      await this.removeFileQuietly(generatedFileName);
      throw this.mapDuplicateName(error);
    }
  }

  /** Recoloca na fila um documento que falhou ou ficou com outro modelo de embeddings (FR-015). */
  async reprocess(id: number, actingUserId: number): Promise<KnowledgeDocumentResponseDto> {
    const document = await this.findOrFail(id);
    if (
      document.status !== KnowledgeDocumentStatus.FAILED &&
      document.status !== KnowledgeDocumentStatus.NEEDS_REPROCESS
    ) {
      throw new ConflictException(NOT_REPROCESSABLE_MESSAGE);
    }

    const updated = await this.dataSource.transaction(async (manager) => {
      const result = await manager.update(
        KnowledgeDocument,
        { id, status: document.status },
        { status: KnowledgeDocumentStatus.PROCESSING, failureReason: null },
      );
      if (result.affected !== 1) {
        throw new ConflictException(NOT_REPROCESSABLE_MESSAGE);
      }
      await this.auditService.record(
        {
          userId: actingUserId,
          affectedTable: 'knowledge_documents',
          recordId: id,
          action: AuditAction.UPDATE,
          oldData: { status: document.status, failureReason: document.failureReason },
          newData: { status: KnowledgeDocumentStatus.PROCESSING, failureReason: null },
        },
        manager,
      );
      return manager.findOneOrFail(KnowledgeDocument, {
        where: { id },
        relations: { uploadedBy: true },
      });
    });

    this.ingestionQueue.enqueue(id);
    return KnowledgeDocumentResponseDto.fromEntity(updated);
  }

  /**
   * Apaga linha, trechos (cascade) e arquivos. O histórico de consultas guarda uma cópia
   * das fontes, então não é afetado (FR-026). Um processamento em andamento termina sem
   * efeito: ao gravar os trechos o documento já não existe.
   */
  async remove(id: number, actingUserId: number): Promise<void> {
    const document = await this.findOrFail(id);
    this.ingestionQueue.cancel(id);

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(KnowledgeDocument, id);
      await this.auditService.record(
        {
          userId: actingUserId,
          affectedTable: 'knowledge_documents',
          recordId: id,
          action: AuditAction.DELETE,
          oldData: this.auditSnapshot(document),
          newData: null,
        },
        manager,
      );
    });

    // Depois do commit: a linha já saiu, então uma falha no disco só deixa lixo, e vira log.
    await this.removeFileQuietly(document.filePath);
    if (document.pendingFilePath) {
      await this.removeFileQuietly(document.pendingFilePath);
    }
  }

  private async rename(
    document: KnowledgeDocument,
    newName: string,
    actingUserId: number,
  ): Promise<KnowledgeDocumentResponseDto> {
    if (newName === document.name) {
      return KnowledgeDocumentResponseDto.fromEntity(document);
    }
    try {
      await this.dataSource.transaction(async (manager) => {
        // Zera o aviso de falha da última atualização: ele só vale para quem acabou de receber o erro.
        await manager.update(KnowledgeDocument, document.id, {
          name: newName,
          failureReason: null,
        });
        await this.auditService.record(
          {
            userId: actingUserId,
            affectedTable: 'knowledge_documents',
            recordId: document.id,
            action: AuditAction.UPDATE,
            oldData: { name: document.name },
            newData: { name: newName },
          },
          manager,
        );
      });
    } catch (error) {
      throw this.mapDuplicateName(error);
    }
    return KnowledgeDocumentResponseDto.fromEntity(await this.findOrFail(document.id));
  }

  private async findOrFail(id: number): Promise<KnowledgeDocument> {
    const document = await this.documents.findOne({
      where: { id },
      relations: { uploadedBy: true },
    });
    if (!document) {
      throw new NotFoundException(DOCUMENT_NOT_FOUND_MESSAGE);
    }
    return document;
  }

  private isBeingProcessed(document: KnowledgeDocument): boolean {
    return (
      document.status === KnowledgeDocumentStatus.PROCESSING ||
      document.status === KnowledgeDocumentStatus.UPDATING
    );
  }

  /** Conferência amigável; a garantia real, mesmo com pedidos simultâneos, é o índice único. */
  private async assertNameAvailable(name: string, ignoredDocumentId: number): Promise<void> {
    const existing = await this.documents.findOne({ select: { id: true }, where: { name } });
    if (existing && existing.id !== ignoredDocumentId) {
      throw new ConflictException(DUPLICATE_NAME_MESSAGE);
    }
  }

  private mapDuplicateName(error: unknown): unknown {
    const driverError = (error as QueryFailedError).driverError as { code?: string } | undefined;
    if (error instanceof QueryFailedError && driverError?.code === UNIQUE_VIOLATION_CODE) {
      return new ConflictException(DUPLICATE_NAME_MESSAGE);
    }
    return error;
  }

  /** Metadados para auditoria: nunca o conteúdo do arquivo (FR-022). */
  private auditSnapshot(document: KnowledgeDocument): Record<string, unknown> {
    return {
      name: document.name,
      status: document.status,
      fileFormat: document.fileFormat,
      originalFileName: document.originalFileName,
      sizeBytes: document.sizeBytes,
    };
  }

  private async removeFileQuietly(relativePath: string): Promise<void> {
    await fs.unlink(join(this.storagePath, relativePath)).catch(() => {
      this.logger.warn('Não foi possível remover um arquivo de documento do disco');
    });
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
