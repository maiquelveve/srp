# Modelo do Banco de Dados

> Convenção (Constituição v1.1.0, Princípio XI): todo nome de tabela/coluna é em inglês. Este
> documento é a referência autoritativa para tipos/colunas exatos do `schema.prisma`
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
    reason VARCHAR(100), -- 'CELL_CHANGE', 'RELEASE', 'ANKLE_MONITOR', 'TRANSFER'
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

## Tabela `staff_schedules`

```sql
CREATE TABLE staff_schedules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    unit_id INTEGER NOT NULL REFERENCES units(id),
    gallery_id INTEGER REFERENCES galleries(id),
    date DATE NOT NULL,
    shift VARCHAR(20) NOT NULL, -- 'MORNING', 'AFTERNOON', 'NIGHT'
    sector VARCHAR(100), -- 'GALLERY_A', 'FRONT_DESK', etc.
    attendance_status VARCHAR(20), -- 'PRESENT', 'ABSENT', 'EXCUSED'
    overtime_hours NUMERIC(5,2) DEFAULT 0,
    UNIQUE(user_id, date, shift)
);
```

## Tabela `minimum_staffing_config`

Valor mínimo de efetivo configurável por setor/turno/unidade (FR-024, research.md #12).

```sql
CREATE TABLE minimum_staffing_config (
    id SERIAL PRIMARY KEY,
    unit_id INTEGER NOT NULL REFERENCES units(id),
    sector VARCHAR(100) NOT NULL,
    shift VARCHAR(20) NOT NULL, -- 'MORNING', 'AFTERNOON', 'NIGHT'
    minimum_headcount INTEGER NOT NULL,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(unit_id, sector, shift)
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
