import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtPayload } from '../../auth/types/jwt-payload.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { SkipAutoAudit } from '../../common/decorators/skip-auto-audit.decorator';
import { RoleName } from '../../roles/entities/role.entity';
import { AskQuestionDto } from './dto/ask-question.dto';
import { KnowledgeQueryResponseDto } from './dto/knowledge-query-response.dto';
import { KnowledgeQueriesService } from './knowledge-queries.service';

/**
 * Consultas à base de conhecimento (feature 003). Restrito a Chefia/Diretor e
 * Supervisor; agentes penitenciários não acessam.
 */
@ApiTags('knowledge')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token de acesso ausente, inválido ou expirado' })
@ApiForbiddenResponse({ description: 'Somente Chefia/Diretor e Supervisor' })
@Controller('api/v1/knowledge/queries')
export class KnowledgeQueriesController {
  constructor(private readonly knowledgeQueriesService: KnowledgeQueriesService) {}

  @ApiOperation({
    summary: 'Pergunta em linguagem natural; a resposta é baseada só nos documentos da base',
  })
  @ApiCreatedResponse({
    type: KnowledgeQueryResponseDto,
    description:
      'Registro da consulta: ANSWERED, NO_ANSWER ou EXCERPTS_ONLY (a IA de chat falhou e a resposta são os trechos brutos)',
  })
  @ApiBadRequestResponse({ description: 'Pergunta vazia, curta ou longa demais' })
  @ApiTooManyRequestsResponse({ description: 'Limite de consultas por minuto excedido' })
  @ApiServiceUnavailableResponse({ description: 'O provedor de embeddings está indisponível' })
  @Post()
  @Roles(RoleName.WARDEN, RoleName.SUPERVISOR)
  @SkipAutoAudit() // O histórico imutável (knowledge_queries) já é o registro desta ação
  ask(
    @Body() dto: AskQuestionDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<KnowledgeQueryResponseDto> {
    return this.knowledgeQueriesService.ask(dto.question, currentUser.sub);
  }
}
