# Data Model: Base de Conhecimento com RAG

Identificadores em inglês (Constituição XI). Colunas em `snake_case` pela `SnakeNamingStrategy` já usada. Nova migration: `<timestamp>-AddKnowledgeBase.ts`.

## Extensão e pré-requisitos

- `CREATE EXTENSION IF NOT EXISTS vector;`

## `knowledge_documents`

Documento carregado para consulta. Separado de `documents` (biblioteca da 002).

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | serial PK | |
| `name` | varchar(200) NOT NULL | Nome de exibição. **UNIQUE** (FR-017). |
| `file_path` | varchar(500) NOT NULL | Caminho relativo em `KNOWLEDGE_STORAGE_PATH`; nome gerado (UUID + extensão); nunca exposto. |
| `pending_file_path` | varchar(500) NULL | Preenchido só durante `UPDATING`. |
| `original_file_name` | varchar(255) NOT NULL | Só para exibição. |
| `file_format` | varchar(10) NOT NULL | `pdf` \| `docx` \| `txt` — o "tipo" exibido (detectado pelo conteúdo). |
| `size_bytes` | int NOT NULL | |
| `status` | enum NOT NULL | `PROCESSING` \| `READY` \| `UPDATING` \| `FAILED` \| `NEEDS_REPROCESS` |
| `failure_reason` | varchar(40) NULL | Código: `NO_EXTRACTABLE_TEXT`, `CORRUPTED_FILE`, `AI_UNAVAILABLE`, `INTERRUPTED`, `UNKNOWN`. Em `READY`, indica falha da última atualização. |
| `chunk_count` | int NOT NULL DEFAULT 0 | Preenchido ao concluir. |
| `uploaded_by_user_id` | int NOT NULL FK → `users(id)` | Autor do envio/última atualização. |
| `created_at` | timestamptz NOT NULL DEFAULT now() | Data de envio. |
| `updated_at` | timestamptz NOT NULL DEFAULT now() | |

### Transições de estado

```text
(upload)            → PROCESSING ──ok──► READY
                          └──erro──► FAILED ──reprocess──► PROCESSING
READY ──update──► UPDATING ──ok──► READY (conteúdo novo)
                      └──erro──► READY (conteúdo antigo, failure_reason preenchido)
READY ──troca de modelo──► NEEDS_REPROCESS ──reprocess──► PROCESSING ──ok──► READY
```

Participa da recuperação apenas `READY` e `UPDATING`.

## `knowledge_document_chunks`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | serial PK | |
| `document_id` | int NOT NULL FK → `knowledge_documents(id)` **ON DELETE CASCADE** | |
| `position` | int NOT NULL | Ordem do trecho no documento (0-based). UNIQUE `(document_id, position)`. |
| `content` | text NOT NULL | Texto do trecho. |
| `word_count` | int NOT NULL | |
| `embedding` | vector(1024) NOT NULL | Dimensão = `EMBEDDING_DIMENSIONS`, validada no boot. |
| `embedding_model` | varchar(100) NOT NULL | Ex.: `ollama:bge-m3`. |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

Índices: `USING hnsw (embedding vector_cosine_ops)`; btree em `document_id`.

## `knowledge_queries` (histórico, imutável)

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | serial PK | |
| `user_id` | int NOT NULL FK → `users(id)` **ON DELETE RESTRICT** | Quem perguntou (exibido a todos, conforme Clarifications). |
| `question` | text NOT NULL | 3–1000 caracteres, validado na entrada. |
| `answer` | text NOT NULL | Resposta entregue, ou "Não foi possível encontrar a resposta", ou os trechos brutos formatados. |
| `outcome` | enum NOT NULL | `ANSWERED` \| `NO_ANSWER` \| `EXCERPTS_ONLY` |
| `sources` | jsonb NOT NULL DEFAULT `[]` | Snapshot: `[{ documentId, documentName, position, excerpt }]`. Sem FK (FR-026). |
| `failure_kind` | varchar(30) NULL | Quando `EXCERPTS_ONLY`: `RATE_LIMIT`, `QUOTA_OR_AUTH`, `UNAVAILABLE`, `TIMEOUT`. Diagnóstico, não exibido como erro. |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

Índice: `created_at DESC`. **Trigger** `knowledge_queries_immutable` (`BEFORE UPDATE OR DELETE OR TRUNCATE`) bloqueia qualquer alteração, igual a `audit_logs`.

## Relacionamentos

```text
users 1───* knowledge_documents 1───* knowledge_document_chunks
users 1───* knowledge_queries            (sources = snapshot, sem FK)
```

## Consulta de recuperação (referência)

```sql
SELECT c.id, c.position, c.content, d.id AS document_id, d.name,
       1 - (c.embedding <=> $1) AS similarity
FROM knowledge_document_chunks c
JOIN knowledge_documents d ON d.id = c.document_id
WHERE d.status IN ('READY', 'UPDATING') AND c.embedding_model = $2
ORDER BY c.embedding <=> $1
LIMIT 5;
```

Trechos com `similarity < KNOWLEDGE_MIN_SIMILARITY` são descartados no service.
