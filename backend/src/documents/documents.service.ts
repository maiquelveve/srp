import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { DocumentType } from './entities/document-type.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { DocumentResponseDto } from './dto/document-response.dto';
import { DocumentTypeResponseDto } from './dto/document-type-response.dto';
import { detectFileFormat, matchesDeclaredExtension, FORMAT_MIME_TYPES } from './file-signature';
import { User } from '../users/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { APP_CONFIG } from '../config/app-config.module';
import { AppConfig } from '../config/configuration';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';

const UNIQUE_VIOLATION_CODE = '23505';
const DUPLICATE_NAME_MESSAGE = 'Já existe um documento com esse nome nesta categoria';
const UNSUPPORTED_FORMAT_MESSAGE = 'Formato de arquivo não permitido. Envie DOCX, DOC, TXT ou PDF.';

const DOCUMENT_RELATIONS = { documentType: true, uploadedBy: true } as const;
/** GET /documents sem `limit` explícito (tela "Biblioteca de Documentos"). */
const DEFAULT_LIST_LIMIT = 20;

export interface DownloadInfo {
  absolutePath: string;
  mimeType: string;
  originalFileName: string;
}

/**
 * contracts/documents.md — biblioteca de Formulários/Modelos de Documentos/
 * Manuais. Arquivo em disco local (`DOCUMENTS_STORAGE_PATH`, research.md #8),
 * nome gerado (nunca o nome de exibição nem o original) para evitar colisão
 * e path traversal; o banco guarda só metadados + caminho relativo.
 */
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly storagePath: string;

  constructor(
    @InjectRepository(Document) private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentType)
    private readonly documentTypeRepository: Repository<DocumentType>,
    private readonly auditService: AuditService,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.storagePath = config.documents.storagePath;
  }

  async listTypes(): Promise<DocumentTypeResponseDto[]> {
    const types = await this.documentTypeRepository.find({ order: { id: 'ASC' } });
    return types.map((type) => DocumentTypeResponseDto.fromEntity(type));
  }

  /**
   * `documentTypeId` omitido lista todas as categorias (tela "Biblioteca de
   * Documentos", unificada) — com `documentTypeId`, continua filtrado numa
   * categoria só (telas por categoria: Formulários/Modelos/Manuais).
   */
  async list(query: ListDocumentsQueryDto): Promise<PaginatedResponseDto<DocumentResponseDto>> {
    const qb = this.documentRepository
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.documentType', 'documentType')
      .leftJoinAndSelect('document.uploadedBy', 'uploadedBy')
      .orderBy('document.createdAt', 'DESC');

    if (query.documentTypeId !== undefined) {
      qb.andWhere('documentType.id = :documentTypeId', { documentTypeId: query.documentTypeId });
    }
    if (query.search) {
      qb.andWhere('document.name ILIKE :search', { search: `%${query.search}%` });
    }

    const total = await qb.getCount();
    const documents = await qb
      .take(query.limit ?? DEFAULT_LIST_LIMIT)
      .skip(query.offset ?? 0)
      .getMany();

    return new PaginatedResponseDto(
      documents.map((document) => DocumentResponseDto.fromEntity(document)),
      total,
    );
  }

  /**
   * FR-013/FR-013a/FR-014/FR-010a — valida assinatura real do conteúdo
   * (nunca a extensão declarada isolada), categoria existente e nome único
   * na categoria antes de gravar em disco; `413` de tamanho já é recusado
   * antes de chegar aqui, pelo próprio `FileInterceptor` (Multer).
   */
  async create(
    file: Express.Multer.File | undefined,
    dto: CreateDocumentDto,
    actingUserId: number,
  ): Promise<DocumentResponseDto> {
    if (!file) {
      throw new BadRequestException('Arquivo obrigatório');
    }
    if (!matchesDeclaredExtension(file.originalname, file.buffer)) {
      throw new BadRequestException(UNSUPPORTED_FORMAT_MESSAGE);
    }

    const documentType = await this.documentTypeRepository.findOne({
      where: { id: dto.documentTypeId },
    });
    if (!documentType) {
      throw new NotFoundException('Categoria não encontrada');
    }

    const detectedFormat = detectFileFormat(file.buffer);
    // Sempre não-nulo aqui — matchesDeclaredExtension() já confirmou a correspondência acima.
    const mimeType = detectedFormat ? FORMAT_MIME_TYPES[detectedFormat] : file.mimetype;

    const extension = extname(file.originalname).toLowerCase();
    const generatedFileName = `${randomUUID()}${extension}`;
    const absolutePath = join(this.storagePath, generatedFileName);
    await fs.mkdir(this.storagePath, { recursive: true });
    await fs.writeFile(absolutePath, file.buffer);

    try {
      const created = await this.documentRepository.save(
        this.documentRepository.create({
          name: dto.name,
          path: generatedFileName,
          originalFileName: file.originalname,
          mimeType,
          sizeBytes: file.size,
          documentType,
          uploadedBy: { id: actingUserId } as User,
        }),
      );

      await this.auditService.record({
        userId: actingUserId,
        affectedTable: 'documents',
        recordId: created.id,
        action: AuditAction.INSERT,
        oldData: null,
        newData: {
          name: created.name,
          documentTypeId: documentType.id,
          originalFileName: created.originalFileName,
          sizeBytes: created.sizeBytes,
        },
      });

      // `save()` devolve a mesma instância, com `documentType` já anexado
      // (veio do findOne acima) — nenhum reload extra é necessário.
      return DocumentResponseDto.fromEntity(created);
    } catch (error) {
      // Corrida de upload concorrente com o mesmo nome — o save() falhou
      // depois do arquivo já escrito; remove o órfão antes de responder.
      await fs.unlink(absolutePath).catch(() => undefined);
      const driverError = (error as QueryFailedError).driverError as { code?: string } | undefined;
      if (error instanceof QueryFailedError && driverError?.code === UNIQUE_VIOLATION_CODE) {
        throw new ConflictException(DUPLICATE_NAME_MESSAGE);
      }
      throw error;
    }
  }

  async getDownloadInfo(id: number): Promise<DownloadInfo> {
    const document = await this.documentRepository.findOne({ where: { id } });
    if (!document) {
      throw new NotFoundException('Documento não encontrado');
    }

    const absolutePath = join(this.storagePath, document.path);
    try {
      await fs.access(absolutePath);
    } catch {
      // Linha existe no banco mas o arquivo sumiu do disco (fora de banda) — mesma resposta de "não encontrado".
      throw new NotFoundException('Documento não encontrado');
    }

    return {
      absolutePath,
      mimeType: document.mimeType,
      originalFileName: document.originalFileName,
    };
  }

  /** FR-012 — remoção definitiva (hard delete) da linha + arquivo em disco (research.md #10). */
  async remove(id: number, actingUserId: number): Promise<void> {
    const document = await this.documentRepository.findOne({
      where: { id },
      relations: DOCUMENT_RELATIONS,
    });
    if (!document) {
      throw new NotFoundException('Documento não encontrado');
    }

    const oldData = {
      name: document.name,
      documentTypeId: document.documentType.id,
      originalFileName: document.originalFileName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      uploadedByUserId: document.uploadedBy.id,
      createdAt: document.createdAt,
    };

    await this.documentRepository.remove(document);

    const absolutePath = join(this.storagePath, document.path);
    await fs.unlink(absolutePath).catch((error: unknown) => {
      this.logger.warn(`Falha ao remover arquivo em disco (${absolutePath}): ${String(error)}`);
    });

    await this.auditService.record({
      userId: actingUserId,
      affectedTable: 'documents',
      recordId: id,
      action: AuditAction.DELETE,
      oldData,
      newData: null,
    });
  }
}
