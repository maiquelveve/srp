---

description: "Task list for feature 003 - Base de Conhecimento com RAG"
---

# Tasks: Base de Conhecimento com Consulta Assistida por IA (RAG)

**Input**: Design documents from `/specs/003-knowledge-base-rag/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Incluídos (backend unit + integração e frontend), mesmo padrão das features 001 e 002 (Constituição VIII).

**Organization**: Tasks agrupadas por user story (spec.md US1–US4). As duas stories P1 formam o MVP juntas: US2 (carregar documentos) vem antes de US1 (perguntar) na ordem de implementação porque a consulta só tem valor com conteúdo indexado.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência de task incompleta)
- **[Story]**: A qual user story a task pertence (US1–US4)
- Caminhos de arquivo exatos em toda descrição

## Path Conventions

Extensão dos projetos existentes (`plan.md` Project Structure); `mobile/` não é tocado (FR-003):

- `backend/src/ai/` (novo), `backend/src/knowledge/` (novo), `backend/src/documents/` (apenas `file-signature.ts`), `backend/src/config/`, `backend/src/database/`, `backend/test/`
- `frontend/src/features/knowledge-base/` (novo), `frontend/src/layouts/AppShell/`, `frontend/src/App.tsx`
- `docker/postgres/`, `docker/ollama/` (novo)

## Convenções que valem para todas as tasks

- Identificadores de código e schema em inglês; textos de interface em português; sem travessão (—) em texto de tela (Constituição XI e `user-facing-text.spec.ts`).
- Nomes de variáveis por extenso, sem abreviações (ex.: `queryBuilder`, não `qb`).
- Telas seguem `docs/style-guide.md` (tokens, componentes shadcn já instalados, padrão de tela e de diálogo); nenhuma paleta/estrutura nova.
- Nunca logar texto de pergunta, resposta ou conteúdo de documento (FR-032).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Infraestrutura local e dependências compartilhadas pelas 4 user stories

- [X] T001 Trocar a imagem do serviço em `docker/postgres/docker-compose.yml` para `pgvector/pgvector:pg16` e anotar a mudança em `docker/README.md`. Atenção: a imagem é Debian (glibc) e a anterior era Alpine (musl); um volume existente NÃO deve ser reaproveitado direto (ordenação de texto diferente pode corromper índices). Ver nota no `docker/README.md`: recriar o banco ou fazer dump/restore
- [X] T002 [P] Criar o stack `docker/ollama/docker-compose.yml` (serviço `ollama` com volume nomeado, porta `11434`, healthcheck, e um serviço de uma execução que faz `ollama pull` de `bge-m3` e `qwen2.5:7b-instruct`) e `docker/ollama/.env.example`, seguindo a convenção de `docker/README.md`
- [X] T003 [P] Adicionar `pdf-parse` e `mammoth` (e tipos, se necessários) às dependências de `backend/package.json` (research.md #2) e, em seguida, validar com um script descartável em CommonJS que ambos carregam e extraem texto de um arquivo de exemplo; se `pdf-parse` falhar em CommonJS, trocar por `pdfjs-dist` (build legacy) e registrar a mudança em research.md #2
- [X] T004 [P] Garantir que `KNOWLEDGE_STORAGE_PATH` (padrão `backend/storage/knowledge/`) e `storage/knowledge-test/` não sejam versionados. Não existe `backend/.gitignore`: o `.gitignore` da raiz já ignora `backend/storage/` inteiro, então só o comentário foi atualizado

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Configuração, camada de provedores de IA, schema do banco e esqueleto dos módulos usados por todas as stories

**⚠️ CRITICAL**: Nenhuma user story pode começar antes desta fase

### Configuração

- [X] T005 Estender `backend/src/config/configuration.ts` com os blocos `ai` (provedores, modelos, `OLLAMA_CHAT_NUM_CTX`, URLs, chaves, timeouts, `EMBEDDING_DIMENSIONS`, batch size; contracts/ai-providers.md) e `knowledge` (`KNOWLEDGE_STORAGE_PATH`, `KNOWLEDGE_MIN_SIMILARITY`, `KNOWLEDGE_QUERY_RATE_LIMIT`, `KNOWLEDGE_QUESTION_MAX_LENGTH`), com defaults do plano
- [X] T006 [P] Documentar todas as variáveis novas em `backend/.env.example` (blocos comentados, no padrão já usado), incluindo o aviso de que provedores externos enviam conteúdo a terceiros (research.md #9)

### Banco de dados

- [X] T007 [P] Criar a entity `KnowledgeDocument` (enum de status, `failureReason`, `pendingFilePath`, índice único em `name`) em `backend/src/knowledge/entities/knowledge-document.entity.ts` conforme data-model.md
- [X] T008 [P] Criar a entity `KnowledgeDocumentChunk` (coluna `embedding` do tipo `vector` com transformer para `number[]`, `embeddingModel`, cascade em `documentId`) em `backend/src/knowledge/entities/knowledge-document-chunk.entity.ts`
- [X] T009 [P] Criar a entity `KnowledgeQuery` (enum `outcome`, `sources` jsonb, `failureKind`, FK `userId` com `RESTRICT`) em `backend/src/knowledge/entities/knowledge-query.entity.ts`
- [X] T010 Registrar as 3 entities em `backend/src/database/data-source.ts` e escrever a migration `backend/src/database/migrations/<timestamp>-AddKnowledgeBase.ts`: `CREATE EXTENSION vector`, as 3 tabelas, índice HNSW `vector_cosine_ops`, índices em `knowledge_queries(created_at)` e `knowledge_queries(user_id, created_at)` e trigger `knowledge_queries_immutable` (`BEFORE UPDATE OR DELETE OR TRUNCATE`, no molde de `1790200000000-MakeAuditLogsImmutable.ts`), com `down()` completo
- [X] T011 Garantir que `backend/test/integration/setup-test-db.ts` roda a migration nova no banco de teste, que aponta para o Postgres com `pgvector`, e que as 3 tabelas entram no `TRUNCATE` entre execuções. Como `knowledge_queries` é imutável (e o `TRUNCATE ... CASCADE` a alcança a partir de `users`), desabilitar a trigger `knowledge_queries_immutable` antes e reabilitá-la depois, exatamente como já é feito para `audit_logs` nesse arquivo

### Camada de provedores de IA (backend/src/ai/)

- [X] T012 [P] Criar `backend/src/ai/ai-provider.error.ts` (`AiProviderError` com `kind`: `RATE_LIMIT`, `QUOTA_OR_AUTH`, `UNAVAILABLE`, `TIMEOUT`, `INVALID_RESPONSE`) e `backend/src/ai/ai.tokens.ts` (`EMBEDDING_PROVIDER`, `CHAT_PROVIDER`)
- [X] T013 [P] Criar as interfaces `backend/src/ai/interfaces/embedding-provider.interface.ts` e `backend/src/ai/interfaces/chat-provider.interface.ts` exatamente como em contracts/ai-providers.md
- [X] T014 [P] Criar um helper `backend/src/ai/providers/http-json.ts` que faz `fetch` com `AbortSignal.timeout`, mapeia status HTTP e falhas de rede para `AiProviderError` e nunca inclui chave de API, corpo da resposta, pergunta nem trecho de documento na mensagem (cobrir com teste unitário em `backend/test/unit/http-json.spec.ts`, FR-032)
- [X] T015 [P] Implementar `OllamaEmbeddingProvider` em `backend/src/ai/providers/ollama-embedding.provider.ts` (`POST /api/embed`, lotes, valida a dimensão de cada vetor) e teste unitário com `fetch` mockado em `backend/test/unit/ollama-embedding.provider.spec.ts`
- [X] T016 [P] Implementar `OpenAiEmbeddingProvider` em `backend/src/ai/providers/openai-embedding.provider.ts` (`POST /v1/embeddings`, parâmetro `dimensions`) e teste unitário em `backend/test/unit/openai-embedding.provider.spec.ts`
- [X] T017 [P] Implementar `OllamaChatProvider` em `backend/src/ai/providers/ollama-chat.provider.ts` (`POST /api/chat`, `stream: false`, `options.num_ctx` = `OLLAMA_CHAT_NUM_CTX`, para o contexto com 5 trechos não ser truncado) e teste unitário em `backend/test/unit/ollama-chat.provider.spec.ts` (inclui verificar que `num_ctx` é enviado)
- [X] T018 [P] Implementar `OpenAiChatProvider` em `backend/src/ai/providers/openai-chat.provider.ts` e teste unitário em `backend/test/unit/openai-chat.provider.spec.ts`
- [X] T019 [P] Implementar `ClaudeChatProvider` em `backend/src/ai/providers/claude-chat.provider.ts` (`POST /v1/messages`, headers `x-api-key` e `anthropic-version`) e teste unitário em `backend/test/unit/claude-chat.provider.spec.ts`
- [X] T020 Criar `backend/src/ai/ai.module.ts` com os providers de fábrica `EMBEDDING_PROVIDER` e `CHAT_PROVIDER` selecionados por `EMBEDDING_PROVIDER`/`CHAT_PROVIDER` de `AppConfig`; provider desconhecido ou credencial ausente lança erro claro na criação (FR-030); registra `warn` quando o provedor é externo; exporta os tokens. Teste unitário da fábrica (cada combinação válida, valor inválido, chave ausente) em `backend/test/unit/ai.module.spec.ts`

### Reuso da validação de arquivo e esqueleto do módulo

- [X] T021 Estender `matchesDeclaredExtension` em `backend/src/documents/file-signature.ts` com um parâmetro opcional `allowedFormats` (padrão: todos, mantendo o comportamento da biblioteca da 002) e cobrir o novo parâmetro em `backend/test/unit/file-signature.spec.ts` (`.doc` recusado quando a lista é `pdf/docx/txt`)
- [X] T022 Criar `backend/src/knowledge/knowledge.module.ts` (importa `TypeOrmModule.forFeature` das 3 entities, `AiModule`, `AuditModule`) e registrar `AiModule` e `KnowledgeModule` em `backend/src/app.module.ts`; criar também `backend/src/knowledge/knowledge-bootstrap.service.ts` (`onApplicationBootstrap`) já com a validação de `EMBEDDING_DIMENSIONS` contra a coluna `vector(N)` (lê `atttypmod`; falha o boot com mensagem clara se divergir), para o MVP não depender da US3 para essa proteção
- [X] T023 [P] Criar fakes de teste `backend/test/integration/fakes/fake-embedding.provider.ts` (vetor determinístico por hash do texto, configurável para falhar) e `backend/test/integration/fakes/fake-chat.provider.ts` (resposta configurável, `[SEM_RESPOSTA]`, falha por `kind`), para sobrescrever os tokens nos testes de integração

### Frontend base

- [X] T024 [P] Criar `frontend/src/features/knowledge-base/types.ts` (estados do documento, `outcome`, objetos de resposta conforme contracts/knowledge-api.md) e `frontend/src/features/knowledge-base/api.ts` (cliente para os 7 endpoints usando `services/api-client.ts`)
- [X] T025 Criar a página `frontend/src/features/knowledge-base/index.tsx` com as abas "Perguntar", "Histórico" e "Documentos" (componente `tabs` shadcn, padrão de tela de `docs/style-guide.md`), registrar a rota `/base-de-conhecimento` em `frontend/src/App.tsx` e o item de menu em `frontend/src/layouts/AppShell/index.tsx` visível apenas para `WARDEN` e `SUPERVISOR`

**Checkpoint**: Provedores, schema e esqueletos prontos; user stories podem começar

---

## Phase 3: User Story 2 - Carregar documentos na base de conhecimento (Priority: P1) 🎯 MVP

**Goal**: Supervisor/Chefia envia PDF/DOCX/TXT; o sistema guarda, extrai, divide, vetoriza e persiste, mostrando o estado até "Disponível para consulta" ou "Falhou".

**Independent Test**: Enviar um TXT/PDF/DOCX válido e ver o documento chegar a `READY` com trechos persistidos; enviar arquivo com conteúdo diferente da extensão (`400`), nome repetido (`409`) e PDF sem texto (`FAILED` com `NO_EXTRACTABLE_TEXT`). Contratos: `contracts/knowledge-api.md` (POST/GET documents), `contracts/flows.md` (ingestão).

### Tests for User Story 2

- [ ] T026 [P] [US2] Testes unitários do chunker (tamanho alvo/máximo, overlap de 50 palavras, texto curto, sentença maior que o máximo, texto vazio) em `backend/test/unit/chunker.spec.ts`
- [ ] T027 [P] [US2] Testes unitários do `TextExtractor` (TXT UTF-8, DOCX e PDF de fixture com texto, PDF sem texto lança `NO_EXTRACTABLE_TEXT`, arquivo corrompido) em `backend/test/unit/text-extractor.spec.ts`, com fixtures pequenas em `backend/test/integration/fixtures/knowledge/`
- [ ] T028 [P] [US2] Teste de integração de upload e ingestão (`202`, `READY` com `chunkCount > 0`, `400` assinatura x extensão, `400` para `.doc`, `409` nome duplicado, `413`, `403` para `PRISON_OFFICER`, falha do `EmbeddingProvider` leva a `FAILED(AI_UNAVAILABLE)` sem trechos parciais, auditoria `INSERT`; envio concorrente com o mesmo nome resulta em um `201`/`202` e um `409`; usar `IngestionQueue.waitForIdle()` para aguardar o processamento) em `backend/test/integration/knowledge-documents.spec.ts`

### Implementation for User Story 2

- [ ] T029 [P] [US2] Implementar `chunkText` (função pura; 400 palavras alvo, máx. 500, overlap 50, quebra por parágrafo/sentença) em `backend/src/knowledge/documents/chunker.ts`
- [ ] T030 [P] [US2] Implementar `TextExtractor` (escolhe por formato detectado: `pdf-parse`, `mammoth`, UTF-8) em `backend/src/knowledge/documents/text-extractor.ts`
- [ ] T031 [P] [US2] Criar DTOs `CreateKnowledgeDocumentDto`, `ListKnowledgeDocumentsQueryDto` e `KnowledgeDocumentResponseDto` em `backend/src/knowledge/documents/dto/` (com decorators Swagger; resposta sem `filePath`)
- [ ] T032 [US2] Implementar `IngestionService.process(documentId)` em `backend/src/knowledge/documents/ingestion.service.ts`: extrai, divide, vetoriza em lotes, e numa única transação insere os trechos e marca `READY`; qualquer erro marca `FAILED` com o código de motivo e nunca deixa trechos parciais (FR-016). Sem logar conteúdo.
- [ ] T033 [US2] Implementar `IngestionQueue` em `backend/src/knowledge/documents/ingestion-queue.ts` (fila em memória, concorrência 1, cancelamento por id, e método `waitForIdle()` que resolve quando a fila esvazia, usado pelos testes de integração) e, em `onApplicationBootstrap`, recolocar na fila documentos `PROCESSING`/`UPDATING` deixados por execução anterior (research.md #7)
- [ ] T034 [US2] Implementar em `backend/src/knowledge/documents/knowledge-documents.service.ts` os métodos `create` (valida tamanho, assinatura via `matchesDeclaredExtension` com `allowedFormats`, nome único com a violação `23505` da constraint convertida em `409`, inclusive em envios simultâneos, e arquivo já gravado removido do disco em caso de falha; grava arquivo com nome UUID em `KNOWLEDGE_STORAGE_PATH`; cria documento `PROCESSING` + auditoria `INSERT` na mesma transação; enfileira) e `list` (busca por nome com `escapeLike`, paginação, mais recente primeiro)
- [ ] T035 [US2] Implementar `backend/src/knowledge/documents/knowledge-documents.controller.ts` com `POST /api/v1/knowledge/documents` (`FileInterceptor`, limite `DOCUMENTS_MAX_FILE_SIZE_MB`, `202`) e `GET /api/v1/knowledge/documents`, ambos com `@Roles(WARDEN, SUPERVISOR)` e Swagger; registrar controller/providers em `knowledge.module.ts`
- [ ] T036 [P] [US2] Criar `frontend/src/features/knowledge-base/components/UploadDocumentDialog/index.tsx` (campo de nome, seletor de arquivo PDF/DOCX/TXT, mensagens de `400`/`409`/`413` em português) seguindo o padrão de diálogo/formulário de `docs/style-guide.md`, reaproveitando a estrutura de `features/documents/components/UploadDocumentDialog`
- [ ] T037 [US2] Criar `frontend/src/features/knowledge-base/components/DocumentsTable/index.tsx` na aba "Documentos": lista com nome, tipo, data de envio, autor e `Badge` de estado ("Processando", "Disponível para consulta", "Falhou" com motivo legível, "Atualizando", "Precisa reprocessar"), busca por nome, paginação, estado vazio, e atualização automática a cada 3 s enquanto houver documento em `PROCESSING`/`UPDATING`

**Checkpoint**: É possível carregar documentos e vê-los ficar disponíveis

---

## Phase 4: User Story 1 - Perguntar e receber resposta baseada nos documentos (Priority: P1) 🎯 MVP

**Goal**: Pergunta em linguagem natural devolve resposta baseada exclusivamente nos 5 trechos mais similares, com fontes, "Não foi possível encontrar a resposta" quando não houver base, e trechos brutos quando a IA de chat falhar; toda consulta é persistida no histórico.

**Independent Test**: Com um documento `READY`, perguntar algo do conteúdo (`ANSWERED` + fonte), algo fora (`NO_ANSWER`, sem chamar o chat), simular falha do chat (`EXCERPTS_ONLY`, `201`) e do embedding (`503`, nada persistido); `PRISON_OFFICER` recebe `403`. Contratos: `contracts/knowledge-api.md` (POST queries), `contracts/flows.md` (consulta).

### Tests for User Story 1

- [ ] T038 [P] [US1] Testes unitários do `PromptBuilder` (delimitação dos trechos, instrução anti-injeção, marcador `[SEM_RESPOSTA]`, formatação dos trechos brutos) em `backend/test/unit/prompt-builder.spec.ts`
- [ ] T039 [P] [US1] Teste de integração da consulta (`ANSWERED` com fontes, `NO_ANSWER` sem chamar o chat quando nada passa do limiar, `NO_ANSWER` quando o chat devolve `[SEM_RESPOSTA]`, `EXCERPTS_ONLY` para cada `kind` de falha do chat, `503` sem persistir quando o embedding falha, `400` para pergunta vazia/longa, `403` para `PRISON_OFFICER`, `429` ao exceder o limite do usuário (e consulta de outro usuário não é afetada), e só documentos `READY`/`UPDATING` entram na recuperação) em `backend/test/integration/knowledge-queries.spec.ts`

### Implementation for User Story 1

- [ ] T040 [P] [US1] Implementar `PromptBuilder` (função pura; prompt de sistema e de usuário conforme contracts/flows.md; formatação dos trechos brutos) em `backend/src/knowledge/queries/prompt-builder.ts`
- [ ] T041 [P] [US1] Criar DTOs `AskQuestionDto` (`trim`, 3 a `KNOWLEDGE_QUESTION_MAX_LENGTH` caracteres) e `KnowledgeQueryResponseDto` (inclui `askedBy`, `sources`, `outcome`) em `backend/src/knowledge/queries/dto/`
- [ ] T042 [US1] Implementar a recuperação em `backend/src/knowledge/queries/knowledge-queries.service.ts`: SQL do data-model.md (cosseno, `LIMIT 5`, só `READY`/`UPDATING`, `embedding_model` atual), descarte abaixo de `KNOWLEDGE_MIN_SIMILARITY`
- [ ] T043 [US1] Implementar `ask` no mesmo service: embedding da pergunta (erro vira `503` sem persistir), recuperação, `NO_ANSWER` sem chamar o chat quando não há trechos, chamada ao `ChatProvider`, conversão de `[SEM_RESPOSTA]`, fallback `EXCERPTS_ONLY` para qualquer `AiProviderError` (gravando `failureKind`), e persistência do registro em `knowledge_queries` com snapshot de fontes (FR-023, FR-026)
- [ ] T044 [US1] Implementar `backend/src/knowledge/queries/knowledge-queries.controller.ts` com `POST /api/v1/knowledge/queries` (`@Roles(WARDEN, SUPERVISOR)`, `@SkipAutoAudit()`, Swagger); registrar em `knowledge.module.ts`. Implementar o limite por usuário no `KnowledgeQueriesService` (antes de chamar a IA): contar os registros do usuário em `knowledge_queries` nos últimos 60 s e lançar `429` ao atingir `KNOWLEDGE_QUERY_RATE_LIMIT` (research.md #11; não usar `@Throttle`, pois o `ThrottlerGuard` roda antes do `JwtAuthGuard`)
- [ ] T045 [P] [US1] Criar `frontend/src/features/knowledge-base/components/AskPanel/index.tsx` na aba "Perguntar": campo de texto, botão "Enviar", estado de carregamento que impede reenvio, exibição da resposta com lista de fontes, aviso de "trechos brutos" para `EXCERPTS_ONLY`, mensagem para `NO_ANSWER`, mensagens de `400`/`429`/`503` em português e aviso, com atalho para a aba "Documentos", quando não há nenhum documento disponível para consulta (edge case da spec), tudo conforme `docs/style-guide.md`

**Checkpoint**: MVP completo (US2 + US1): carregar documentos e perguntar

---

## Phase 5: User Story 3 - Visualizar, atualizar e excluir documentos (Priority: P2)

**Goal**: Substituir um documento por versão nova sem janela fora do ar, excluí-lo com confirmação e reprocessar documentos com falha ou de modelo antigo.

**Independent Test**: Atualizar com conteúdo diferente e ver as respostas passarem da versão antiga para a nova; atualização que falha mantém a antiga; excluir remove linha, trechos e arquivo e mantém o histórico; trocar `embedding_model` marca `NEEDS_REPROCESS`. Contratos: `contracts/knowledge-api.md` (PUT, reprocess, DELETE), `contracts/flows.md`.

### Tests for User Story 3

- [ ] T046 [P] [US3] Teste de integração de atualização, reprocessamento e exclusão (`UPDATING` mantém trechos antigos pesquisáveis; sucesso troca atomicamente; falha volta a `READY` com `failureReason` e arquivo novo removido; só `name` renomeia sem reprocessar; `409` para nome de outro documento e para documento em processamento; reprocess de `FAILED`/`NEEDS_REPROCESS` e `409` nos demais; `DELETE` remove trechos e arquivo e preserva `knowledge_queries`; auditoria `UPDATE`/`DELETE`) em `backend/test/integration/knowledge-documents-manage.spec.ts`
- [ ] T047 [P] [US3] Teste de integração da detecção de troca de modelo (documento `READY` com `embedding_model` diferente do atual vira `NEEDS_REPROCESS` no bootstrap e deixa de ser recuperado) em `backend/test/integration/knowledge-model-change.spec.ts`

### Implementation for User Story 3

- [ ] T048 [P] [US3] Criar `UpdateKnowledgeDocumentDto` (`name` opcional; exige `file` ou `name`) em `backend/src/knowledge/documents/dto/update-knowledge-document.dto.ts`
- [ ] T049 [US3] Estender `IngestionService` para o fluxo de atualização (processa em memória a partir de `pendingFilePath`; transação final apaga trechos antigos, insere novos, troca `filePath`, `READY`; remove o arquivo antigo; falha limpa `pendingFilePath`, remove o arquivo novo e volta a `READY` com `failureReason`) em `backend/src/knowledge/documents/ingestion.service.ts`
- [ ] T050 [US3] Implementar `update`, `reprocess` e `remove` em `backend/src/knowledge/documents/knowledge-documents.service.ts` (regras de `409` por estado/nome, cancelamento do job na exclusão, remoção de arquivos, auditoria com `oldData`/`newData` sem conteúdo)
- [ ] T051 [US3] Adicionar `PUT /api/v1/knowledge/documents/:id`, `POST /api/v1/knowledge/documents/:id/reprocess` e `DELETE /api/v1/knowledge/documents/:id` em `backend/src/knowledge/documents/knowledge-documents.controller.ts` (`@Roles(WARDEN, SUPERVISOR)`, Swagger)
- [ ] T052 [US3] Implementar no bootstrap de `KnowledgeModule` a marcação `NEEDS_REPROCESS` de documentos `READY` cujo `embedding_model` difere do configurado (contracts/flows.md, "Recuperação no boot"), estendendo `backend/src/knowledge/knowledge-bootstrap.service.ts` criado no T022 (a validação de dimensão já existe lá)
- [ ] T053 [P] [US3] Criar `frontend/src/features/knowledge-base/components/EditDocumentDialog/index.tsx` (renomear e/ou enviar nova versão) e `frontend/src/features/knowledge-base/components/DeleteDocumentDialog/index.tsx` (confirmação explícita com `alert-dialog`, texto deixando claro que o histórico é mantido), no padrão de `docs/style-guide.md`
- [ ] T054 [US3] Ligar editar, excluir e "Reprocessar" às linhas de `DocumentsTable` em `frontend/src/features/knowledge-base/components/DocumentsTable/index.tsx` (ações por estado: reprocessar só em "Falhou"/"Precisa reprocessar"; edição desabilitada em processamento)

**Checkpoint**: Ciclo de vida completo dos documentos

---

## Phase 6: User Story 4 - Consultar o histórico (Priority: P2)

**Goal**: Ver pergunta, resposta, autor e data de todas as consultas, paginado e com busca; ninguém consegue alterar ou apagar registros.

**Independent Test**: Duas perguntas aparecem no histórico (inclusive de usuários diferentes e as sem resposta); `PUT`/`PATCH`/`DELETE` em `/knowledge/queries/:id` respondem `404`; `UPDATE`/`DELETE` direto no banco falham pela trigger. Contrato: `contracts/knowledge-api.md` (GET queries).

### Tests for User Story 4

- [ ] T055 [P] [US4] Teste de integração do histórico (lista de todos os usuários com `askedBy`, ordem decrescente, paginação, filtro `search`, `NO_ANSWER` presente, `403` para `PRISON_OFFICER`, `404` em `PUT`/`PATCH`/`DELETE`, e `UPDATE`/`DELETE`/`TRUNCATE` diretos no banco falham com erro de imutabilidade; histórico preservado após excluir o documento fonte) em `backend/test/integration/knowledge-history.spec.ts`

### Implementation for User Story 4

- [ ] T056 [P] [US4] Criar `ListKnowledgeQueriesQueryDto` (`search`, `limit`, `offset`) em `backend/src/knowledge/queries/dto/list-knowledge-queries-query.dto.ts`
- [ ] T057 [US4] Implementar `list` em `backend/src/knowledge/queries/knowledge-queries.service.ts` (todos os usuários, `created_at DESC`, filtro por substring com `escapeLike`, join com o autor) e `GET /api/v1/knowledge/queries` em `knowledge-queries.controller.ts` com Swagger; confirmar que nenhum método de update/delete existe no service ou no controller
- [ ] T058 [P] [US4] Criar `frontend/src/features/knowledge-base/components/HistoryList/index.tsx` na aba "Histórico": lista paginada com pergunta, resposta, autor e data, busca por texto da pergunta, indicação visual de `NO_ANSWER` e `EXCERPTS_ONLY`, estado vazio, sem nenhuma ação de editar/excluir

**Checkpoint**: Todas as user stories funcionais

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentação, consistência e validação final (Constituição IX e X)

- [ ] T059 [P] Adicionar testes de componente do frontend (AskPanel: envio, bloqueio de reenvio, fontes, aviso de trechos brutos; DocumentsTable: estados e polling; HistoryList: sem ações destrutivas) em `frontend/tests/knowledge-base/`
- [ ] T060 [P] Atualizar `backend/test/integration/swagger.spec.ts` para cobrir os endpoints de `/api/v1/knowledge` e confirmar que `user-facing-text.spec.ts` cobre os textos novos do frontend (sem travessão)
- [ ] T061 [P] Atualizar `docs/srp_spec_database_model.md` com as 3 tabelas novas, o `README.md` com a feature 003 (Ollama via compose, variáveis de ambiente, comandos) e `docs/style-guide.md` apenas se algum padrão novo de tela surgir
- [ ] T062 Executar `npm run lint`, `npm test` e `npm run test:integration` em `backend/` e `npm run lint` e `npm test` em `frontend/`, corrigindo todas as falhas
- [ ] T063 Executar os cenários 1 a 6 de `quickstart.md` contra o Ollama real e registrar o resultado do conjunto de validação (SC-001/SC-002); ajustar `KNOWLEDGE_MIN_SIMILARITY` e, se necessário, os modelos e `EMBEDDING_DIMENSIONS` (decisão adiada em research.md #4) e anotar os valores finais em `research.md`; registrar também os tempos medidos: tempo de resposta das consultas (p90, alvo de 30 s, SC-003) e tempo até um documento de 50 páginas ficar disponível (alvo de 5 min, SC-004)
- [ ] T064 Revisar o log do backend durante os cenários do T063 e confirmar que nenhum texto de pergunta, resposta, conteúdo de documento ou chave de API aparece (FR-032)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências; T002, T003, T004 em paralelo.
- **Foundational (Phase 2)**: depende do Setup; **bloqueia todas as user stories**.
- **US2 (Phase 3)** e **US1 (Phase 4)**: dependem da Foundational. US1 depende em runtime de documentos indexados, mas seus testes usam fixtures e fakes, então podem avançar em paralelo a US2 após a Foundational.
- **US3 (Phase 5)**: depende de US2 (reaproveita `IngestionService`, service e controller de documentos).
- **US4 (Phase 6)**: depende de US1 apenas para haver registros (a persistência vem do T043); a leitura em si é independente.
- **Polish (Phase 7)**: depende das stories desejadas.

### Within Foundational

- T007, T008, T009 em paralelo, depois T010 → T011.
- T012, T013, T014 em paralelo; T015 a T019 em paralelo após T012 a T014; T020 depende de T005 e T015 a T019.
- T021 independente; T022 depende de T007 a T010 e T020.

### Within Each Story

- Testes escritos antes da implementação e vistos falhar.
- Funções puras (chunker, extractor, prompt builder) → services → controllers → frontend.

### Parallel Opportunities

- Os 5 adapters (T015 a T019) são arquivos independentes.
- Chunker, extractor e DTOs (T029 a T031) em paralelo.
- Frontend de cada story em paralelo ao backend, após o contrato estar fixo.
- US1 e US2 podem ser tocadas por duas pessoas ao mesmo tempo após a Phase 2.

### Parallel Example: Foundational (adapters)

```text
Task: "Implementar OllamaEmbeddingProvider em backend/src/ai/providers/ollama-embedding.provider.ts"
Task: "Implementar OpenAiEmbeddingProvider em backend/src/ai/providers/openai-embedding.provider.ts"
Task: "Implementar OllamaChatProvider em backend/src/ai/providers/ollama-chat.provider.ts"
Task: "Implementar OpenAiChatProvider em backend/src/ai/providers/openai-chat.provider.ts"
Task: "Implementar ClaudeChatProvider em backend/src/ai/providers/claude-chat.provider.ts"
```

---

## Implementation Strategy

### MVP First (US2 + US1)

1. Phase 1 e Phase 2 completas.
2. Phase 3 (US2): carregar documentos. **Validar**: documento chega a `READY`.
3. Phase 4 (US1): perguntar. **Validar**: cenários 1 a 3 do quickstart.
4. Parar, demonstrar e decidir os modelos (T063) antes de investir nas stories P2.

### Incremental Delivery

1. MVP (US2 + US1).
2. + US3: manter a base atualizada.
3. + US4: histórico visível.
4. Polish e validação com documentos reais.

### Notas

- A decisão final de modelos e `EMBEDDING_DIMENSIONS` está adiada para os testes (research.md #4). Se a dimensão mudar, ajustar T008/T010 **antes** de qualquer carga real.
- Commit sugerido ao fim de cada fase ou story, na branch `003-knowledge-base-rag`.
