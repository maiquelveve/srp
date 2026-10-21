import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtPayload } from '../../auth/types/jwt-payload.type';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { SkipAutoAudit } from '../../common/decorators/skip-auto-audit.decorator';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import loadConfiguration from '../../config/configuration';
import { RoleName } from '../../roles/entities/role.entity';
import { CreateKnowledgeDocumentDto } from './dto/create-knowledge-document.dto';
import { KnowledgeDocumentResponseDto } from './dto/knowledge-document-response.dto';
import { ListKnowledgeDocumentsQueryDto } from './dto/list-knowledge-documents-query.dto';
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
}
