import { createReadStream } from 'fs';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtPayload } from '../../auth/types/jwt-payload.type';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { SkipAutoAudit } from '../../common/decorators/skip-auto-audit.decorator';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import loadConfiguration from '../../config/configuration';
import { RoleName } from '../../roles/entities/role.entity';
import { KnowledgeDocumentStatus } from '../entities/knowledge-document.entity';
import { CreateKnowledgeDocumentDto } from './dto/create-knowledge-document.dto';
import { KnowledgeDocumentResponseDto } from './dto/knowledge-document-response.dto';
import { ListKnowledgeDocumentsQueryDto } from './dto/list-knowledge-documents-query.dto';
import { UpdateKnowledgeDocumentDto } from './dto/update-knowledge-document.dto';
import { KnowledgeDocumentsService } from './knowledge-documents.service';

/**
 * Documentos da base de conhecimento (feature 003). Tudo aqui é restrito a
 * Chefia/Diretor e Supervisor; agentes penitenciários não acessam.
 */
@ApiTags('knowledge')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token de acesso ausente, inválido ou expirado' })
@ApiForbiddenResponse({ description: 'Somente Chefia/Diretor e Supervisor' })
@Controller('api/v1/knowledge/documents')
export class KnowledgeDocumentsController {
  constructor(private readonly knowledgeDocumentsService: KnowledgeDocumentsService) {}

  @ApiOperation({
    summary: 'Lista documentos da base (busca por nome e paginação), mais recente primeiro',
  })
  @ApiPaginatedResponse(KnowledgeDocumentResponseDto)
  @Get()
  @Roles(RoleName.WARDEN, RoleName.SUPERVISOR)
  list(
    @Query() query: ListKnowledgeDocumentsQueryDto,
  ): Promise<PaginatedResponseDto<KnowledgeDocumentResponseDto>> {
    return this.knowledgeDocumentsService.list(query);
  }

  @ApiOperation({
    summary: 'Devolve o arquivo original de um documento, para visualizar ou baixar',
  })
  @ApiNotFoundResponse({ description: 'Documento inexistente ou arquivo ausente do disco' })
  @Get(':id/file')
  @Roles(RoleName.WARDEN, RoleName.SUPERVISOR)
  async getFile(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { absolutePath, mimeType, originalFileName } =
      await this.knowledgeDocumentsService.getFileInfo(id);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(originalFileName)}"`,
    });
    return new StreamableFile(createReadStream(absolutePath));
  }

  @ApiOperation({
    summary: 'Envia um documento (PDF, DOCX ou TXT); o processamento segue em segundo plano',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'name'],
      properties: {
        file: { type: 'string', format: 'binary' },
        name: { type: 'string' },
      },
    },
  })
  @ApiAcceptedResponse({
    type: KnowledgeDocumentResponseDto,
    description: 'Documento recebido, com status PROCESSING',
  })
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(RoleName.WARDEN, RoleName.SUPERVISOR)
  @SkipAutoAudit() // KnowledgeDocumentsService.create() já registra a auditoria (INSERT)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: loadConfiguration().documents.maxFileSizeMb * 1024 * 1024 },
    }),
  )
  create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: CreateKnowledgeDocumentDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<KnowledgeDocumentResponseDto> {
    return this.knowledgeDocumentsService.create(file, dto, currentUser.sub);
  }

  @ApiOperation({
    summary:
      'Renomeia e/ou envia nova versão do documento; a versão atual segue pesquisável até a troca',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        name: { type: 'string' },
      },
    },
  })
  @ApiAcceptedResponse({
    type: KnowledgeDocumentResponseDto,
    description: 'Nova versão recebida; o documento fica em UPDATING (ou PROCESSING)',
  })
  @ApiOkResponse({
    type: KnowledgeDocumentResponseDto,
    description: 'Somente o nome foi alterado, sem reprocessar',
  })
  @ApiNotFoundResponse({ description: 'Documento inexistente' })
  @ApiConflictResponse({
    description: 'Nome já usado por outro documento, ou documento em processamento',
  })
  @Put(':id')
  @Roles(RoleName.WARDEN, RoleName.SUPERVISOR)
  @SkipAutoAudit() // KnowledgeDocumentsService.update() já registra a auditoria (UPDATE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: loadConfiguration().documents.maxFileSizeMb * 1024 * 1024 },
    }),
  )
  async update(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UpdateKnowledgeDocumentDto,
    @CurrentUser() currentUser: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<KnowledgeDocumentResponseDto> {
    const updated = await this.knowledgeDocumentsService.update(id, file, dto, currentUser.sub);
    // 202 quando há processamento em segundo plano; 200 quando só o nome mudou.
    const isProcessing =
      updated.status === KnowledgeDocumentStatus.UPDATING ||
      updated.status === KnowledgeDocumentStatus.PROCESSING;
    res.status(isProcessing ? HttpStatus.ACCEPTED : HttpStatus.OK);
    return updated;
  }

  @ApiOperation({ summary: 'Reprocessa um documento que falhou ou precisa de novo processamento' })
  @ApiAcceptedResponse({
    type: KnowledgeDocumentResponseDto,
    description: 'Documento de volta à fila, com status PROCESSING',
  })
  @ApiNotFoundResponse({ description: 'Documento inexistente' })
  @ApiConflictResponse({ description: 'O documento não está em FAILED nem NEEDS_REPROCESS' })
  @Post(':id/reprocess')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(RoleName.WARDEN, RoleName.SUPERVISOR)
  @SkipAutoAudit() // KnowledgeDocumentsService.reprocess() já registra a auditoria (UPDATE)
  reprocess(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<KnowledgeDocumentResponseDto> {
    return this.knowledgeDocumentsService.reprocess(id, currentUser.sub);
  }

  @ApiOperation({
    summary: 'Exclui o documento, seus trechos e o arquivo; o histórico de consultas é mantido',
  })
  @ApiNoContentResponse({ description: 'Documento excluído' })
  @ApiNotFoundResponse({ description: 'Documento inexistente' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(RoleName.WARDEN, RoleName.SUPERVISOR)
  @SkipAutoAudit() // KnowledgeDocumentsService.remove() já registra a auditoria (DELETE)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<void> {
    return this.knowledgeDocumentsService.remove(id, currentUser.sub);
  }
}
