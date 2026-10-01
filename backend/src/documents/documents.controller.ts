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
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { DocumentResponseDto } from './dto/document-response.dto';
import { DocumentTypeResponseDto } from './dto/document-type-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipAutoAudit } from '../common/decorators/skip-auto-audit.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';
import { RoleName } from '../roles/entities/role.entity';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import loadConfiguration from '../config/configuration';

/**
 * contracts/documents.md — biblioteca de Formulários/Modelos de Documentos/
 * Manuais. Leitura (listar categorias, listar, baixar) é aberta a qualquer
 * perfil autenticado; envio/remoção são exclusivos de WARDEN/SUPERVISOR.
 */
@ApiTags('documents')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token de acesso ausente, inválido ou expirado' })
@ApiForbiddenResponse({
  description:
    'Perfil sem permissão para a operação (envio/remoção exigem Chefia/Diretor ou Supervisor)',
})
@Controller('api/v1')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @ApiOperation({ summary: 'Lista as 3 categorias fixas de documentos' })
  @Get('document-types')
  listTypes(): Promise<DocumentTypeResponseDto[]> {
    return this.documentsService.listTypes();
  }

  @ApiOperation({
    summary:
      'Lista documentos (todas as categorias ou uma só, com busca por nome e paginação), mais recente primeiro',
  })
  @ApiPaginatedResponse(DocumentResponseDto)
  @Get('documents')
  list(@Query() query: ListDocumentsQueryDto): Promise<PaginatedResponseDto<DocumentResponseDto>> {
    return this.documentsService.list(query);
  }

  @ApiOperation({ summary: 'Baixa o arquivo de um documento' })
  @Get('documents/:id/download')
  async download(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { absolutePath, mimeType, originalFileName } =
      await this.documentsService.getDownloadInfo(id);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
    });
    return new StreamableFile(createReadStream(absolutePath));
  }

  @ApiOperation({ summary: 'Envia um novo documento (somente Chefia/Diretor e Supervisor)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'name', 'documentTypeId'],
      properties: {
        file: { type: 'string', format: 'binary' },
        name: { type: 'string' },
        documentTypeId: { type: 'integer' },
      },
    },
  })
  @ApiOkResponse({ description: 'Documento enviado' })
  @Post('documents')
  @Roles(RoleName.WARDEN, RoleName.SUPERVISOR)
  @SkipAutoAudit() // DocumentsService.create() já registra a auditoria (INSERT)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: loadConfiguration().documents.maxFileSizeMb * 1024 * 1024 },
    }),
  )
  create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: CreateDocumentDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<DocumentResponseDto> {
    return this.documentsService.create(file, dto, currentUser.sub);
  }

  @ApiOperation({
    summary: 'Remove definitivamente um documento (somente Chefia/Diretor e Supervisor)',
  })
  @ApiOkResponse({
    schema: { properties: { message: { type: 'string', example: 'Documento removido' } } },
  })
  @Delete('documents/:id')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleName.WARDEN, RoleName.SUPERVISOR)
  @SkipAutoAudit() // DocumentsService.remove() já registra a auditoria (DELETE, oldData = snapshot)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<{ message: string }> {
    await this.documentsService.remove(id, currentUser.sub);
    return { message: 'Documento removido' };
  }
}
