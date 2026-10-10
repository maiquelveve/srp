# Implementation Plan: Base de Conhecimento com Consulta Assistida por IA (RAG)

**Branch**: `003-knowledge-base-rag` | **Date**: 2026-10-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-knowledge-base-rag/spec.md`

## Summary

Adicionar ao backend NestJS/TypeORM/PostgreSQL e ao painel web React um módulo `knowledge/` (somente web, sem mobile) que permite a Supervisor e Chefia/Diretor (1) carregar PDF/DOCX/TXT, que são armazenados em disco, tem o texto extraído, dividido em trechos de ~300–500 palavras com sobreposição de ~50, vetorizado e persistido em PostgreSQL com `pgvector`; (2) perguntar em linguagem natural e receber resposta gerada exclusivamente a partir dos 5 trechos mais similares, com fontes citadas e fallback para trechos brutos quando a IA falha; (3) listar, atualizar e excluir documentos; (4) consultar um histórico imutável (garantido por trigger no banco, como `audit_logs`).

A camada de IA é implementada à mão (sem SDK de IA): duas interfaces (`EmbeddingProvider`, `ChatProvider`), adapters HTTP sobre `fetch` nativo para Ollama, OpenAI e Claude, e providers de fábrica NestJS selecionados por `EMBEDDING_PROVIDER`/`CHAT_PROVIDER` e injetados por token. O Ollama roda via `docker/ollama/docker-compose.yml`; o Postgres do compose passa a usar a imagem com `pgvector`. O armazenamento de arquivo e a verificação de assinatura reutilizam o que a feature 002 já tem em `documents/`.

## Technical Context

**Language/Version**: TypeScript strict; Node.js 24 (já em uso) com `fetch` global; React 18 no frontend. Mobile fora de escopo (FR-003).

**Primary Dependencies**: Backend, adições a `backend/package.json` — apenas extratores de texto (não são bibliotecas de IA): `pdf-parse` (PDF) e `mammoth` (DOCX); TXT é lido direto. DOC legado fica fora (a spec pede PDF/DOCX/TXT). Nenhuma lib de IA/HTTP nova: adapters usam `fetch`. Frontend: nenhuma dependência nova (`tabs`, `table`, `dialog`, `alert-dialog`, `badge`, `skeleton` shadcn já instalados). Detalhes em research.md #2 e #3.

**Storage**: PostgreSQL 16 + extensão `vector` (imagem `pgvector/pgvector:pg16` no compose). Tabelas novas: `knowledge_documents`, `knowledge_document_chunks`, `knowledge_queries`. Arquivos em disco, novo subdiretório configurável `KNOWLEDGE_STORAGE_PATH` (mesmo mecanismo da 002, nomes gerados com UUID).

**Testing**: Jest (unitário: chunker, extratores, adapters com `fetch` mockado, factory, montagem de prompt, regras de fallback) + Supertest (integração: endpoints, RBAC, imutabilidade do histórico, ingestão e consulta com provedores falsos injetados pelo token) — mesmo padrão de `backend/test/`. Frontend: Vitest + React Testing Library. Validação de qualidade de resposta (SC-001/SC-002) por conjunto de perguntas manual contra Ollama real, descrito em quickstart.md.

**Target Platform**: Backend Linux (mesmo processo existente) + Ollama em container separado; frontend web em navegadores modernos.

**Project Type**: Web application (extensão de `backend/` e `frontend/`). Nenhum projeto novo.

**Performance Goals**: SC-003 (resposta em até 30 s em 90% das consultas na configuração local) e SC-004 (documento de 50 páginas disponível em até 5 min). Sem metas de throughput; uso é de poucos usuários simultâneos.

**Constraints**: Sem SDK de IA pronto (decisão tomada). Dimensão do vetor fixa por coluna: `EMBEDDING_DIMENSIONS` (default 1024) deve coincidir com a coluna, validado no boot. Respostas só com base nos trechos recuperados (FR-005). Histórico imutável no banco (FR-024). Identificadores de código/schema em inglês, textos de tela em português (Constituição XI). Telas seguem `docs/style-guide.md`.

**Scale/Scope**: Dezenas a poucas centenas de documentos, milhares a dezenas de milhares de trechos; busca exata com índice HNSW é suficiente. 1 página web nova (3 abas) + 1 item de menu.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Avaliação |
|---|-----------|-----------|
| I | Domain First | PASS — todo endpoint e tela mapeia para FRs de `spec.md`; nada fora do spec. A spec precede o código (SDD). |
| II | Security First | PASS — `@Roles(WARDEN, SUPERVISOR)` em todo o módulo, validado no backend (FR-001/002); assinatura real do arquivo; limite de taxa por usuário na consulta (FR-010); conteúdo de documento tratado como dado, não instrução (FR-033); chaves de API só por env, nunca em log; conteúdo de pergunta/documento não vai a logs (FR-032). Risco de envio a terceiros com provedores externos documentado (research.md #9). |
| III | Auditability | PASS — enviar/atualizar/excluir/reprocessar documento chamam `AuditService.record` com `affectedTable='knowledge_documents'`; o histórico de consultas é, em si, registro imutável (trigger). |
| IV | Data Integrity | PASS — troca de conteúdo de documento em uma única transação (nunca parcialmente indexado, FR-016); nome único por constraint; dimensão do vetor validada; histórico bloqueado por trigger de banco, não só pela API. |
| V | Clean Architecture | PASS — Controller → Service → Repository; regras de RAG (chunking, recuperação, prompt, fallback) em services/utilitários testáveis; adapters isolados atrás de interfaces; nenhuma regra na UI. |
| VI | Single Source of Truth | PASS — o estado "disponível" é o `status` do documento; nomes das fontes no histórico são snapshot intencional (FR-026), não duplicação viva. |
| VII | Consistency | PASS — `/api/v1/knowledge/...`, envelope paginado `{ data, total }`, mesmos códigos `400/403/404/409/413` de `documents`. |
| VIII | Testability | PASS — providers por interface permitem fakes determinísticos; chunker e extratores puros. |
| IX | Maintainability | PASS — validação de assinatura/extensão/tamanho de arquivo é reaproveitada de `documents/file-signature.ts` (extraída para uso comum, sem copiar); um módulo com responsabilidade única. |
| X | Documentation | PASS — Swagger nos endpoints; `docs/srp_spec_database_model.md` e README atualizados na implementação. |
| XI | Language Convention | PASS — tabelas/colunas/código em inglês (as `documentos`/`documento_chunks` da descrição viram `knowledge_documents`/`knowledge_document_chunks`, conforme Assumptions da spec); UI em português. |

Nenhuma violação — Complexity Tracking não necessário.

**Re-check pós-Phase 1**: data-model.md, contracts/ e research.md revisados contra a tabela. Pontos verificados: trigger de imutabilidade em `knowledge_queries` (IV/III), swap transacional de trechos (IV), reuso de `file-signature` (IX), `fetch` sem SDK (restrição da fase). Gate mantido **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/003-knowledge-base-rag/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── ai-providers.md  # Interfaces EmbeddingProvider / ChatProvider, erros, config
│   ├── knowledge-api.md # Endpoints REST /api/v1/knowledge
│   └── flows.md         # Fluxos de ingestão, atualização e consulta
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
docker/
├── postgres/docker-compose.yml        # imagem → pgvector/pgvector:pg16
└── ollama/                            # NOVO stack (convenção de docker/README.md)
    ├── docker-compose.yml             # ollama + job que baixa os modelos
    └── .env.example

backend/
├── src/
│   ├── ai/                            # NOVO — camada de provedores (sem regra de negócio)
│   │   ├── ai.module.ts               # providers de fábrica + tokens
│   │   ├── ai.tokens.ts               # 'EmbeddingProvider' | 'ChatProvider'
│   │   ├── ai-provider.error.ts       # AiProviderError (kind)
│   │   ├── interfaces/
│   │   │   ├── embedding-provider.interface.ts
│   │   │   └── chat-provider.interface.ts
│   │   └── providers/
│   │       ├── ollama-embedding.provider.ts
│   │       ├── openai-embedding.provider.ts
│   │       ├── ollama-chat.provider.ts
│   │       ├── openai-chat.provider.ts
│   │       └── claude-chat.provider.ts
│   ├── knowledge/                     # NOVO — domínio
│   │   ├── knowledge.module.ts
│   │   ├── documents/                 # ingestão e gestão
│   │   │   ├── knowledge-documents.controller.ts
│   │   │   ├── knowledge-documents.service.ts
│   │   │   ├── ingestion.service.ts   # pipeline extrair → chunk → embed → persistir
│   │   │   ├── ingestion-queue.ts     # fila em processo, concorrência 1, recuperação no boot, waitForIdle()
│   │   │   ├── text-extractor.ts      # PDF/DOCX/TXT
│   │   │   ├── chunker.ts             # função pura
│   │   │   └── dto/
│   │   ├── queries/                   # consulta e histórico
│   │   │   ├── knowledge-queries.controller.ts
│   │   │   ├── knowledge-queries.service.ts
│   │   │   ├── prompt-builder.ts      # função pura
│   │   │   └── dto/
│   │   ├── knowledge-bootstrap.service.ts  # no boot: valida dimensão (fundacional); marca NEEDS_REPROCESS (US3)
│   │   └── entities/
│   │       ├── knowledge-document.entity.ts
│   │       ├── knowledge-document-chunk.entity.ts
│   │       └── knowledge-query.entity.ts
│   ├── documents/file-signature.ts    # reutilizado (sem mudança de comportamento)
│   ├── config/configuration.ts        # + bloco `ai` e `knowledge`
│   ├── database/
│   │   ├── data-source.ts             # + 3 entities
│   │   └── migrations/<ts>-AddKnowledgeBase.ts
│   └── app.module.ts                  # + AiModule, KnowledgeModule
└── test/
    ├── unit/                          # chunker, extractor, adapters, factory, prompt-builder
    └── integration/
        ├── fakes/                     # providers falsos (embedding e chat)
        └── knowledge-*.spec.ts

frontend/src/
├── features/knowledge-base/           # NOVO
│   ├── index.tsx                      # página com abas: Perguntar | Histórico | Documentos
│   ├── api.ts  types.ts
│   └── components/                    # AskPanel, HistoryList, DocumentsTable, UploadDocumentDialog, ...
├── layouts/AppShell/...               # + item de menu (roles WARDEN, SUPERVISOR)
└── App.tsx                            # + rota /base-de-conhecimento
```

**Structure Decision**: Extensão do monólito existente. A camada `ai/` é um módulo separado do domínio `knowledge/` para que provedores sejam trocáveis sem tocar regras (FR-027) e reaproveitáveis por futuras features. Upload reutiliza `documents/file-signature.ts`; o armazenamento em disco segue o mesmo padrão (nome UUID, caminho relativo no banco).
