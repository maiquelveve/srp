> **Documento histórico.** Este era o modelo de banco inicial do projeto, anterior ao fluxo spec-kit. Muita coisa aqui já mudou. A fonte de verdade atual é `specs/001-gestao-rotinas-presos/data-model.md`.

# Modelo do Banco de Dados

> Convenção (Constituição v1.1.0, Princípio XI): todo nome de tabela/coluna é em inglês. Este
> documento é a referência autoritativa para tipos/colunas exatos das entities TypeORM
> (ver `specs/001-gestao-rotinas-presos/data-model.md` para as regras de negócio associadas).

## Tabela `roles`

```sql
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE, -- 'PRISON_OFFICER', 'SUPERVISOR', 'WARDEN'
    description TEXT
);
```

## Tabela `users`

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    badge_number VARCHAR(50) UNIQUE,
    job_title VARCHAR(100), -- cargo, FR-021 (relevante sobretudo para role=PRISON_OFFICER)
    role_id INTEGER NOT NULL REFERENCES roles(id),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Tabela `user_units`

Vínculo N:N entre `users` e `units` (FR-004a — escopo de acesso por unidade).

```sql
CREATE TABLE user_units (
    user_id INTEGER NOT NULL REFERENCES users(id),
    unit_id INTEGER NOT NULL REFERENCES units(id),
    PRIMARY KEY (user_id, unit_id)
);
```

## Tabela `refresh_tokens`

Persistência de refresh tokens para permitir revogação real no logout (research.md #11).

```sql
CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    token_hash VARCHAR(255) NOT NULL UNIQUE, -- SHA-256 do refresh token, nunca o token em claro
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Tabela `invite_tokens`

Token de uso único para o novo usuário definir a própria senha inicial fora de banda
(research.md #10, `POST /api/v1/auth/set-initial-password`).

```sql
CREATE TABLE invite_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Tabela `units`

```sql
CREATE TABLE units (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(20) UNIQUE,
    address TEXT,
    phone VARCHAR(50),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Tabela `galleries`

```sql
CREATE TABLE galleries (
    id SERIAL PRIMARY KEY,
    unit_id INTEGER NOT NULL REFERENCES units(id),
    code VARCHAR(50) NOT NULL, -- ex: 'A', 'B', 'WORKERS', 'HOLDING', 'INTAKE'
    description TEXT,
    type VARCHAR(50), -- 'MALE', 'FEMALE', etc.
    active BOOLEAN DEFAULT TRUE,
    UNIQUE(unit_id, code)
);
```

## Tabela `cells`

```sql
CREATE TABLE cells (
    id SERIAL PRIMARY KEY,
    gallery_id INTEGER NOT NULL REFERENCES galleries(id),
    code VARCHAR(20) NOT NULL, -- ex: '01', '02', '03'
    capacity INTEGER NOT NULL DEFAULT 0,
    type VARCHAR(50), -- 'SHARED', 'INDIVIDUAL', etc.
    active BOOLEAN DEFAULT TRUE,
    UNIQUE(gallery_id, code)
);
```

## Tabela `inmates`

```sql
CREATE TABLE inmates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    registration_id VARCHAR(50) UNIQUE, -- RGI
    birth_date DATE,
    custody_regime VARCHAR(50), -- 'CLOSED', 'SEMI_OPEN', 'OPEN'
    photo_url TEXT, -- provedor/mecanismo de upload ainda não decidido (research.md #13)
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'RELEASED', 'ANKLE_MONITOR', 'TRANSFERRED', 'DECEASED'
    current_cell_id INTEGER NOT NULL REFERENCES cells(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Tabela `inmate_cell_history`

```sql
CREATE TABLE inmate_cell_history (
    id SERIAL PRIMARY KEY,
    inmate_id INTEGER NOT NULL REFERENCES inmates(id),
    cell_id INTEGER NOT NULL REFERENCES cells(id),
    entry_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    exit_date TIMESTAMP,
    reason VARCHAR(100), -- 'RELEASE', 'ANKLE_MONITOR', 'TRANSFER', 'CELL_CHANGE', 'CELL_SWAP', 'GALLERY_CHANGE', 'GALLERY_SWAP', 'REVERSAL'
    user_id INTEGER REFERENCES users(id)
);
```

## Tabela `movement_types`

```sql
CREATE TABLE movement_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL, -- 'TEMPORARY', 'PERMANENT'
    description TEXT
);
```

## Tabela `routines`

```sql
CREATE TABLE routines (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'DAILY', 'WEEKDAY', 'VISIT_DAY', 'WEEKEND', 'HOLIDAY'
    description TEXT,
    gallery_id INTEGER NOT NULL REFERENCES galleries(id), -- sempre obrigatório
    active BOOLEAN DEFAULT TRUE,
    locked BOOLEAN DEFAULT FALSE, -- TRUE = rotina padrão, não editável por Supervisor
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Tabela `routine_schedules`

```sql
CREATE TABLE routine_schedules (
    id SERIAL PRIMARY KEY,
    routine_id INTEGER NOT NULL REFERENCES routines(id),
    weekday INTEGER, -- 0=SUN, 1=MON, ..., 6=SAT, NULL = todos os dias
    time TIME NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    UNIQUE(routine_id, weekday, time)
);
```

## Tabela `movements`

```sql
CREATE TABLE movements (
    id SERIAL PRIMARY KEY,
    inmate_id INTEGER NOT NULL REFERENCES inmates(id),
    movement_type_id INTEGER NOT NULL REFERENCES movement_types(id),
    origin_cell_id INTEGER NOT NULL REFERENCES cells(id),
    destination_cell_id INTEGER REFERENCES cells(id), -- para troca de cela
    destination_location TEXT, -- 'INFIRMARY', 'COURT', 'HOSPITAL', etc.
    reason TEXT,
    exit_datetime TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    return_datetime TIMESTAMP, -- para movimentações temporárias
    notes TEXT,
    idempotency_key UUID UNIQUE, -- gerado pelo app móvel (FR-011a)
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Tabela `posts`

Postos de serviço (FR-022a, research.md #47): onde um policial é escalado num turno. Só a
Chefia/Diretor cria, altera e desativa. Não é o mesmo que `galleries`: há postos que não são
galeria (pórtico, garita, Infopen) e um posto pode cobrir mais de uma galeria ("A/B").

```sql
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    unit_id INTEGER NOT NULL REFERENCES units(id),
    name VARCHAR(100) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(unit_id, name)
);
```

## Tabela `staff_schedules`

```sql
CREATE TABLE staff_schedules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    unit_id INTEGER NOT NULL REFERENCES units(id),
    post_id INTEGER NOT NULL REFERENCES posts(id),
    date DATE NOT NULL,
    shift VARCHAR(20) NOT NULL, -- 'DAY', 'NIGHT'
    workload_hours INTEGER NOT NULL, -- carga horária do DIA (1 a 24), igual em todas as escalas do policial na data
    attendance_status VARCHAR(20), -- 'PRESENT', 'ABSENT'
    absence_reason TEXT,
    UNIQUE(user_id, date, shift)
);
```

## Tabela `minimum_staffing_config`

Valor mínimo de efetivo configurável por posto/turno (FR-024, research.md #12).

```sql
CREATE TABLE minimum_staffing_config (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id),
    shift VARCHAR(20) NOT NULL, -- 'DAY', 'NIGHT'
    minimum_headcount INTEGER NOT NULL,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(post_id, shift)
);
```

## Tabela `audit_logs`

```sql
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    affected_table VARCHAR(50),
    record_id INTEGER,
    action VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    old_data JSONB, -- campos sensíveis (password_hash, token_hash, ...) redigidos antes de gravar
    new_data JSONB, -- idem
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Imutável (Constituição III, FR-027): qualquer UPDATE, DELETE ou TRUNCATE falha.
CREATE FUNCTION audit_logs_block_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is immutable: % is not allowed', TG_OP
        USING ERRCODE = 'restrict_violation';
END;
$$;
CREATE TRIGGER audit_logs_immutable
    BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_logs
    FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_block_change();
```

## Tabela `knowledge_documents`

Base de conhecimento (feature 003): documentos PDF/DOCX/TXT carregados para consulta por IA.
Distinta de `documents` (biblioteca de Formulários, Modelos e Manuais da feature 002). Regras de
estado e transições em `specs/003-knowledge-base-rag/data-model.md`.

```sql
CREATE TABLE knowledge_documents (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL, -- nome de exibição, único
    file_path VARCHAR(500) NOT NULL, -- relativo a KNOWLEDGE_STORAGE_PATH; nome gerado (UUID), nunca exposto
    pending_file_path VARCHAR(500), -- arquivo da nova versão, só durante UPDATING
    pending_original_file_name VARCHAR(255), -- nome original do arquivo novo, só durante UPDATING
    original_file_name VARCHAR(255) NOT NULL,
    file_format VARCHAR(10) NOT NULL, -- 'pdf', 'docx', 'txt' (detectado pelo conteúdo)
    size_bytes INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'PROCESSING', 'READY', 'UPDATING', 'FAILED', 'NEEDS_REPROCESS'
    failure_reason VARCHAR(40), -- NO_EXTRACTABLE_TEXT, CORRUPTED_FILE, AI_UNAVAILABLE, UNKNOWN
    chunk_count INTEGER NOT NULL DEFAULT 0,
    uploaded_by_user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX ON knowledge_documents(name);
```

## Tabela `knowledge_document_chunks`

Trechos de cada documento com o vetor de embedding (extensão `pgvector`). Apagados em cascata
com o documento.

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE knowledge_document_chunks (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    position INTEGER NOT NULL, -- ordem no documento, a partir de 0
    content TEXT NOT NULL,
    word_count INTEGER NOT NULL,
    embedding vector(1024) NOT NULL, -- dimensão = EMBEDDING_DIMENSIONS, validada no boot
    embedding_model VARCHAR(100) NOT NULL, -- só trechos do modelo atual entram na busca
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX ON knowledge_document_chunks(document_id, position);
-- Busca por similaridade de cosseno (migration; o TypeORM não descreve este índice)
CREATE INDEX ON knowledge_document_chunks USING hnsw (embedding vector_cosine_ops);
```

## Tabela `knowledge_queries`

Histórico imutável das perguntas e respostas (todos os usuários). `sources` é uma cópia dos
trechos usados, sem FK, para sobreviver à exclusão ou atualização do documento.

```sql
CREATE TABLE knowledge_queries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    outcome VARCHAR(20) NOT NULL, -- 'ANSWERED', 'NO_ANSWER', 'EXCERPTS_ONLY'
    sources JSONB NOT NULL DEFAULT '[]', -- [{ documentId, documentName, position, excerpt }]
    failure_kind VARCHAR(30), -- só EXCERPTS_ONLY: RATE_LIMIT, QUOTA_OR_AUTH, UNAVAILABLE, TIMEOUT
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON knowledge_queries(created_at);
CREATE INDEX ON knowledge_queries(user_id, created_at);

-- Imutável (FR-024): qualquer UPDATE, DELETE ou TRUNCATE falha, no mesmo molde de audit_logs.
CREATE FUNCTION knowledge_queries_block_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'knowledge_queries is immutable: % is not allowed', TG_OP
        USING ERRCODE = 'restrict_violation';
END;
$$;
CREATE TRIGGER knowledge_queries_immutable
    BEFORE UPDATE OR DELETE OR TRUNCATE ON knowledge_queries
    FOR EACH STATEMENT EXECUTE FUNCTION knowledge_queries_block_change();
```

## Índices

```sql
CREATE INDEX idx_inmates_current_cell ON inmates(current_cell_id);
CREATE INDEX idx_inmates_status ON inmates(status);
CREATE INDEX idx_movements_inmate ON movements(inmate_id);
CREATE INDEX idx_movements_date ON movements(exit_datetime);
CREATE INDEX idx_movements_user ON movements(user_id);
CREATE INDEX idx_staff_schedules_date ON staff_schedules(date);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
```

---

## Relacionamentos

- `users.role_id` → `roles.id`
- `user_units.user_id` → `users.id`
- `user_units.unit_id` → `units.id`
- `refresh_tokens.user_id` → `users.id`
- `invite_tokens.user_id` → `users.id`
- `galleries.unit_id` → `units.id`
- `cells.gallery_id` → `galleries.id`
- `inmates.current_cell_id` → `cells.id`
- `inmate_cell_history.inmate_id` → `inmates.id`
- `inmate_cell_history.cell_id` → `cells.id`
- `inmate_cell_history.user_id` → `users.id`
- `routines.gallery_id` → `galleries.id`
- `routines.created_by` → `users.id`
- `routine_schedules.routine_id` → `routines.id`
- `movements.inmate_id` → `inmates.id`
- `movements.movement_type_id` → `movement_types.id`
- `movements.origin_cell_id` → `cells.id`
- `movements.destination_cell_id` → `cells.id`
- `movements.user_id` → `users.id`
- `staff_schedules.user_id` → `users.id`
- `staff_schedules.unit_id` → `units.id`
- `staff_schedules.gallery_id` → `galleries.id`
- `minimum_staffing_config.unit_id` → `units.id`
- `minimum_staffing_config.updated_by` → `users.id`
- `audit_logs.user_id` → `users.id`
- `knowledge_documents.uploaded_by_user_id` → `users.id`
- `knowledge_document_chunks.document_id` → `knowledge_documents.id` (cascade)
- `knowledge_queries.user_id` → `users.id` (restrict)
