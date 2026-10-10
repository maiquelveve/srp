# Phase 0 Research: Base de Conhecimento com RAG

Nenhum `NEEDS CLARIFICATION` ficou aberto no Technical Context. Esta pesquisa registra as decisões que a spec deixou para o plano.

## 1. Armazenamento vetorial: pgvector e métrica de distância

**Decision**: Extensão `vector` no PostgreSQL 16 (`CREATE EXTENSION vector` na migration); coluna `embedding vector(1024)`; consulta por **distância de cosseno** (`<=>`) com índice HNSW `vector_cosine_ops`. O compose do Postgres troca a imagem para `pgvector/pgvector:pg16`.

**Rationale**: A descrição pede `ORDER BY embedding <-> $1 LIMIT 5` (distância L2). Para vetores normalizados, L2 e cosseno produzem a mesma ordenação; os modelos escolhidos (bge-m3, text-embedding-3) devolvem vetores normalizados, mas Ollama nem sempre normaliza. Cosseno é invariante a isso e dá uma similaridade (`1 - distância`) com escala estável, necessária para o limiar de relevância (FR-007). O formato do SQL (`ORDER BY ... LIMIT 5`) é o pedido. Imagem `pg16` mantém o mesmo major do volume existente.

**Alternatives considered**:
- `<->` literal → ordenação equivalente só se normalizarmos; limiar menos interpretável. Rejeitado (a decisão do usuário é o padrão ORDER BY/LIMIT, não o operador).
- Normalizar no backend e usar `<->`/`<#>` → trabalho extra sem ganho.
- Sem índice (varredura exata) → aceitável nesta escala, mas HNSW é barato; mantido, com busca exata como fallback possível.

## 2. Extração de texto

**Decision**: `pdf-parse` (PDF), `mammoth` (DOCX → texto bruto), TXT lido como UTF-8. DOC legado NÃO é aceito nesta fase (a spec lista PDF/DOCX/TXT, ao contrário da biblioteca da 002); `matchesDeclaredExtension` ganha um parâmetro opcional com a lista de formatos permitidos, sem mudar o comportamento atual. Todas executadas em um `TextExtractor` com uma função por formato, escolhida pelo formato **detectado** (`detectFileFormat`), nunca pela extensão. PDF sem texto (escaneado) → `FAILED` com motivo `NO_EXTRACTABLE_TEXT` (OCR é fora de escopo).

**Rationale**: As duas são puro JS, sem binário nativo, sem serviço externo. Os formatos aceitos são os mesmos da feature 002, então o detector já existe.

**Risco a validar no primeiro task**: confirmar que as versões escolhidas funcionam em CommonJS no Nest (lição da 002 sobre `file-type` ESM-only). Fallback: `pdfjs-dist` legacy build para PDF.

**Alternatives considered**: `unpdf` (ESM-only), Apache Tika (serviço Java extra), `textract` (binários externos). Rejeitados por custo operacional.

## 3. Chunking

**Decision**: Função pura `chunkText(text, { targetWords: 400, maxWords: 500, overlapWords: 50 })`: normaliza espaços, divide em parágrafos/sentenças, agrega até ~400 palavras (máx. 500), cada novo trecho começa repetindo as últimas 50 palavras do anterior. Sentença maior que o máximo é cortada por palavras. Cada trecho guarda `position` e `wordCount`.

**Rationale**: Atende "300–500 palavras, overlap ~50". Cortar em limites de sentença evita trechos que começam no meio de uma frase. Função pura é trivial de testar.

**Alternatives considered**: janela fixa por palavra (mais simples, corta frases), chunking semântico por embedding (custo e complexidade sem necessidade nesta fase).

## 4. Modelos iniciais (Ollama) e dimensão do vetor

**Decision**: Embeddings `bge-m3` (1024 dimensões, multilíngue). Chat `qwen2.5:7b-instruct` por padrão (bom em português, roda em CPU/GPU modesta). Ambos configuráveis por env. `EMBEDDING_DIMENSIONS=1024` fixa a coluna; OpenAI usa `text-embedding-3-small` com parâmetro `dimensions=1024`, mantendo a mesma coluna.

**Rationale**: O conteúdo é em português; modelos só em inglês (ex.: `nomic-embed-text`) recuperam mal. Dimensão única na coluna permite trocar de provedor de embeddings sem migration de schema (só reprocessar). Os defaults de modelo são ponto de partida. **Decisão do usuário (2026-10-10): a escolha final dos modelos fica para depois dos testes** com documentos reais (conjunto de perguntas do quickstart, SC-001); até lá `bge-m3` + `qwen2.5:7b-instruct` valem como padrão e a dimensão 1024 permanece. Se os testes apontarem para um modelo de outra dimensão, muda-se `EMBEDDING_DIMENSIONS` e a migration da coluna antes do primeiro uso real.

**Alternatives considered**: `nomic-embed-text` (768, fraco em PT), `llama3.1:8b` (aceitável, menor em PT), coluna sem dimensão fixa (impede índice HNSW).

## 5. Seleção de provedor por env e injeção por token

**Decision**: `AiModule` registra dois providers de fábrica com tokens string `'EmbeddingProvider'` e `'ChatProvider'`; a fábrica lê `EMBEDDING_PROVIDER` (`ollama|openai`) e `CHAT_PROVIDER` (`ollama|openai|claude`) de `AppConfig` e instancia o adapter. Valor desconhecido ou credencial ausente para provedor externo → exceção na criação do provider, que derruba o boot com mensagem clara (FR-030). Serviços consomem `@Inject('EmbeddingProvider')`/`@Inject('ChatProvider')`.

**Rationale**: Exatamente o padrão decidido pelo usuário. Falhar no boot evita descobrir config inválida só na primeira pergunta.

## 6. Chamada HTTP aos provedores (sem SDK)

**Decision**: `fetch` nativo com `AbortSignal.timeout(...)` usando `AI_CHAT_TIMEOUT_MS` (default 60 s) para chat e `AI_EMBEDDING_TIMEOUT_MS` (default 30 s) para embeddings. Endpoints: Ollama `POST {base}/api/embed` e `POST {base}/api/chat` (`stream:false`); OpenAI `POST /v1/embeddings` e `/v1/chat/completions`; Claude `POST /v1/messages` com `x-api-key` e `anthropic-version`. Respostas HTTP mapeadas para `AiProviderError.kind`: 429 → `RATE_LIMIT`; 401/402/403 e erros de cota → `QUOTA_OR_AUTH`; 5xx/rede → `UNAVAILABLE`; abort → `TIMEOUT`; corpo inesperado → `INVALID_RESPONSE`.

**Rationale**: Mantém "sem lib externa de IA" e o controle total do fluxo. Embeddings em lote respeitam um `batchSize` (default 16) para não estourar payload.

## 7. Processamento assíncrono da ingestão

**Decision**: `POST` grava o arquivo, cria o documento em `PROCESSING` e responde `202` imediatamente; um `IngestionQueue` em processo (concorrência 1, sem dependência nova) executa o pipeline. Ao subir o backend, documentos em `PROCESSING`/`UPDATING` de execuções anteriores são recolocados na fila (o arquivo já está em disco). O frontend consulta a lista a cada 3 s enquanto houver documento em processamento.

**Rationale**: Documentos grandes podem levar minutos (SC-004), inviável dentro de uma requisição HTTP. Fila persistida pelo próprio estado do documento evita infraestrutura nova (Redis/BullMQ) para a escala desta fase.

**Alternatives considered**: BullMQ/Redis (nova infraestrutura, desproporcional), processamento síncrono (timeouts), worker thread (complexidade sem ganho com I/O-bound).

## 8. Atualização sem janela de indisponibilidade

**Decision**: Atualizar mantém a mesma linha de `knowledge_documents`. O novo arquivo vai para `pending_file_path`, status `UPDATING` (conteúdo antigo continua pesquisável). O pipeline extrai, divide e vetoriza **em memória**; só então, em **uma transação**: apaga os trechos antigos, insere os novos, troca `file_path`, volta a `READY`. Depois remove o arquivo antigo do disco. Falha em qualquer etapa → status volta a `READY`, `failure_reason` preenchido, `pending_file_path` limpo e arquivo novo removido.

**Rationale**: Atende FR-020 (nada de documento fora do ar) e FR-016 (nunca parcial). A descrição aceitava "excluir e reinserir"; o swap transacional dá a mesma simplicidade com melhor garantia.

## 9. Privacidade e provedores externos

**Decision**: Padrão do repositório continua local (Ollama). Ao configurar `openai` ou `claude`, o backend registra um `warn` no boot indicando que perguntas e trechos serão enviados a terceiros. Nenhum conteúdo de documento/pergunta é logado (apenas ids, tamanhos e duração).

**Rationale**: FR-032 e a premissa da spec. A decisão de ativar provedor externo é institucional.

## 10. Relevância, "sem resposta" e anti-injeção

**Decision**: Recuperação: top 5 por distância de cosseno, descartando trechos com similaridade < `KNOWLEDGE_MIN_SIMILARITY` (default 0.45, calibrado no conjunto de validação). Zero trechos → resposta fixa "Não foi possível encontrar a resposta", **sem chamar o chat**. Com trechos, o prompt de sistema instrui: responder só com o contexto, em português, citar a fonte, e emitir o marcador literal `[SEM_RESPOSTA]` se o contexto não bastar; o backend converte esse marcador na mensagem padrão. Os trechos entram delimitados (`<trecho id=… documento=…>…</trecho>`) com instrução de que seu conteúdo é dado, não comando.

**Rationale**: FR-005/FR-007/FR-033. O marcador torna a decisão do modelo detectável sem depender de texto livre.

## 11. Limite de consultas e tamanho de pergunta

**Decision**: limite **por usuário** de `KNOWLEDGE_QUERY_RATE_LIMIT` (default 10) consultas por minuto, aplicado no `KnowledgeQueriesService` antes de chamar a IA: conta os registros de `knowledge_queries` do usuário com `created_at` nos últimos 60 s; se atingiu o limite, responde `429`. Decidido pelo usuário em 2026-10-10 (por usuário, não por IP).

**Tamanho da pergunta**: 3 a `KNOWLEDGE_QUESTION_MAX_LENGTH` caracteres (default 1000), validado no DTO; fora disso `400` sem chamar a IA.

**Rationale**: FR-009/FR-010 sem infraestrutura nova. Por usuário evita que várias pessoas atrás da mesma rede institucional dividam o mesmo limite. A contagem é feita no banco, e não no `ThrottlerModule`, porque no `AppModule` o `ThrottlerGuard` roda antes do `JwtAuthGuard` (`req.user` ainda não existe quando o rastreador é calculado). Contar em `knowledge_queries` não depende da ordem dos guards, não exige estado em memória (funciona com mais de uma instância) e usa o índice em `created_at`. Limitação aceita: consultas que falham antes de persistir (`503`, `400`) não entram na contagem; o limite global por IP do `ThrottlerModule` continua valendo como proteção geral. Requisições paralelas do mesmo usuário podem passar juntas pela contagem (janela de concorrência pequena, aceita nesta fase).

## 12. Imutabilidade do histórico

**Decision**: Migration cria trigger `BEFORE UPDATE OR DELETE OR TRUNCATE` em `knowledge_queries`, no mesmo molde de `audit_logs` (migration `MakeAuditLogsImmutable`). Nenhum método de update/delete existe no service; nenhuma rota PUT/PATCH/DELETE.

**Rationale**: FR-024; defesa em profundidade, não só ausência de endpoint. Consequência: `user_id` usa `ON DELETE RESTRICT` (usuários já são desativados, não excluídos).

## 13. Troca de modelo de embeddings

**Decision**: Cada trecho guarda `embedding_model` (id do modelo usado). No boot, documentos `READY` cujos trechos têm `embedding_model` diferente do configurado passam a `NEEDS_REPROCESS`; a recuperação filtra `WHERE embedding_model = :current`. `POST /knowledge/documents/:id/reprocess` reindexa, a partir do arquivo guardado, um documento por vez. Reprocessamento em lote fica fora desta fase (a base é pequena).

**Rationale**: Impede resultado enganoso (vetores de espaços diferentes não são comparáveis) e atende o edge case da spec sem migração silenciosa.
