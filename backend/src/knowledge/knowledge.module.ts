import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { AuditModule } from '../audit/audit.module';
import { KnowledgeBootstrapService } from './knowledge-bootstrap.service';
import { KnowledgeDocumentChunk } from './entities/knowledge-document-chunk.entity';
import { KnowledgeDocument } from './entities/knowledge-document.entity';
import { KnowledgeQuery } from './entities/knowledge-query.entity';

/**
 * Base de conhecimento com RAG (feature 003). Hoje só tem as entities e a
 * verificação de boot; ingestão, consulta e histórico entram nas próximas fases.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([KnowledgeDocument, KnowledgeDocumentChunk, KnowledgeQuery]),
    AiModule,
    AuditModule,
  ],
  providers: [KnowledgeBootstrapService],
})
export class KnowledgeModule {}
