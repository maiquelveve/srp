import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { AuditModule } from '../audit/audit.module';
import { IngestionService } from './documents/ingestion.service';
import { IngestionQueue } from './documents/ingestion-queue';
import { KnowledgeDocumentsController } from './documents/knowledge-documents.controller';
import { KnowledgeDocumentsService } from './documents/knowledge-documents.service';
import { TextExtractor } from './documents/text-extractor';
import { KnowledgeBootstrapService } from './knowledge-bootstrap.service';
import { KnowledgeDocumentChunk } from './entities/knowledge-document-chunk.entity';
import { KnowledgeDocument } from './entities/knowledge-document.entity';
import { KnowledgeQuery } from './entities/knowledge-query.entity';
import { KnowledgeQueriesController } from './queries/knowledge-queries.controller';
import { KnowledgeQueriesService } from './queries/knowledge-queries.service';

/**
 * Base de conhecimento com RAG (feature 003): documentos (envio e ingestão) e
 * consultas. O histórico de perguntas entra numa fase seguinte.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([KnowledgeDocument, KnowledgeDocumentChunk, KnowledgeQuery]),
    AiModule,
    AuditModule,
  ],
  controllers: [KnowledgeDocumentsController, KnowledgeQueriesController],
  providers: [
    KnowledgeBootstrapService,
    TextExtractor,
    IngestionService,
    IngestionQueue,
    KnowledgeDocumentsService,
    KnowledgeQueriesService,
  ],
})
export class KnowledgeModule {}
