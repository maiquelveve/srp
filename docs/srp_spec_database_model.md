# Modelo do Banco de Dados

## Tabela `perfis`

```sql
CREATE TABLE perfis (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(50) NOT NULL UNIQUE, -- 'POLICIAL', 'SUPERVISOR', 'DIRETOR'
    descricao TEXT
);
```

## Tabela `usuarios`

```sql
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    matricula VARCHAR(50) UNIQUE,
    perfil_id INTEGER NOT NULL REFERENCES perfis(id),
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Tabela `unidades`

```sql
CREATE TABLE unidades (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    codigo VARCHAR(20) UNIQUE,
    endereco TEXT,
    telefone VARCHAR(50),
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Tabela `galerias`

```sql
CREATE TABLE galerias (
    id SERIAL PRIMARY KEY,
    unidade_id INTEGER NOT NULL REFERENCES unidades(id),
    codigo VARCHAR(50) NOT NULL, -- ex: 'A', 'B', 'TRABALHADORES', 'BRETE', 'TRIAGEM'
    descricao TEXT,
    tipo VARCHAR(50), -- 'MASCULINO', 'FEMININO', etc.
    ativo BOOLEAN DEFAULT TRUE,
    UNIQUE(unidade_id, codigo)
);
```

## Tabela `celas`

```sql
CREATE TABLE celas (
    id SERIAL PRIMARY KEY,
    galeria_id INTEGER NOT NULL REFERENCES galerias(id),
    codigo VARCHAR(20) NOT NULL, -- ex: '01', '02', '03'
    capacidade INTEGER NOT NULL DEFAULT 0,
    tipo VARCHAR(50), -- 'COLETIVA', 'INDIVIDUAL', etc.
    ativo BOOLEAN DEFAULT TRUE,
    UNIQUE(galeria_id, codigo)
);
```

## Tabela `presos`

```sql
CREATE TABLE presos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(200) NOT NULL,
    rgi VARCHAR(50) UNIQUE,
    data_nascimento DATE,
    regime VARCHAR(50), -- 'FECHADO', 'SEMIABERTO', 'ABERTO'
    foto_url TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'ATIVO', -- 'ATIVO', 'LIBERDADE', 'TORNOZELEIRA', 'TRANSFERIDO', 'OBITO'
    cela_atual_id INTEGER NOT NULL REFERENCES celas(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Tabela `preso_cela_historico`

```sql
CREATE TABLE preso_cela_historico (
    id SERIAL PRIMARY KEY,
    preso_id INTEGER NOT NULL REFERENCES presos(id),
    cela_id INTEGER NOT NULL REFERENCES celas(id),
    data_entrada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_saida TIMESTAMP,
    motivo VARCHAR(100), -- 'TROCA_CELA', 'LIBERDADE', 'TORNOZELEIRA', 'TRANSFERENCIA'
    usuario_id INTEGER REFERENCES usuarios(id)
);
```

## Tabela `tipos_movimentacao`

```sql
CREATE TABLE tipos_movimentacao (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    categoria VARCHAR(50) NOT NULL, -- 'TEMPORARIA', 'DEFINITIVA'
    descricao TEXT
);
```

## Tabela `rotinas`

```sql
CREATE TABLE rotinas (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- 'DIARIA', 'DIA_SEMANA', 'DIA_VISITA', 'FINAL_SEMANA', 'FERIADO'
    descricao TEXT,
    galeria_id INTEGER NOT NULL REFERENCES galerias(id), -- sempre obrigatóº´¬rio
    ativa BOOLEAN DEFAULT TRUE,
    bloqueada BOOLEAN DEFAULT FALSE, -- TRUE = rotina padrão, não editáº´vel
    criada_por INTEGER REFERENCES usuarios(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Tabela `rotina_horarios`

```sql
CREATE TABLE rotina_horarios (
    id SERIAL PRIMARY KEY,
    rotina_id INTEGER NOT NULL REFERENCES rotinas(id),
    dia_semana INTEGER, -- 0=DOM, 1=SEG, ..., 6=SAB, NULL = todos os dias
    horario TIME NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    UNIQUE(rotina_id, dia_semana, horario)
);
```

## Tabela `movimentacoes`

```sql
CREATE TABLE movimentacoes (
    id SERIAL PRIMARY KEY,
    preso_id INTEGER NOT NULL REFERENCES presos(id),
    tipo_movimentacao_id INTEGER NOT NULL REFERENCES tipos_movimentacao(id),
    cela_origem_id INTEGER NOT NULL REFERENCES celas(id),
    cela_destino_id INTEGER REFERENCES celas(id), -- para troca de cela
    local_destino TEXT, -- 'ENFERMARIA', 'FORUM', 'HOSPITAL', etc.
    motivo TEXT,
    data_hora_saida TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_hora_retorno TIMESTAMP, -- para temporáº´rias
    observacoes TEXT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Tabela `escalas`

```sql
CREATE TABLE escalas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    unidade_id INTEGER NOT NULL REFERENCES unidades(id),
    galeria_id INTEGER REFERENCES galerias(id),
    data DATE NOT NULL,
    turno VARCHAR(20) NOT NULL, -- 'MANHA', 'TARDE', 'NOITE'
    setor VARCHAR(100), -- 'GALERIA_A', 'PORTARIA', etc.
    UNIQUE(usuario_id, data, turno)
);
```

## Tabela `auditoria_logs`

```sql
CREATE TABLE auditoria_logs (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id),
    tabela_afetada VARCHAR(50),
    registro_id INTEGER,
    acao VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    dados_antigos JSONB,
    dados_novos JSONB,
    data_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Índices

```sql
CREATE INDEX idx_presos_cela_atual ON presos(cela_atual_id);
CREATE INDEX idx_presos_status ON presos(status);
CREATE INDEX idx_movimentacoes_preso ON movimentacoes(preso_id);
CREATE INDEX idx_movimentacoes_data ON movimentacoes(data_hora_saida);
CREATE INDEX idx_movimentacoes_usuario ON movimentacoes(usuario_id);
CREATE INDEX idx_escala_data ON escalas(data);
CREATE INDEX idx_auditoria_data ON auditoria_logs(data_hora);
```

---

## Relacionamentos

- `usuarios.perfil_id` → `perfis.id`
- `galerias.unidade_id` → `unidades.id`
- `celas.galeria_id` → `galerias.id`
- `presos.cela_atual_id` → `celas.id`
- `preso_cela_historico.preso_id` → `presos.id`
- `preso_cela_historico.cela_id` → `celas.id`
- `preso_cela_historico.usuario_id` → `usuarios.id`
- `rotinas.galeria_id` → `galerias.id`
- `rotinas.criada_por` → `usuarios.id`
- `rotina_horarios.rotina_id` → `rotinas.id`
- `movimentacoes.preso_id` → `presos.id`
- `movimentacoes.tipo_movimentacao_id` → `tipos_movimentacao.id`
- `movimentacoes.cela_origem_id` → `celas.id`
- `movimentacoes.cela_destino_id` → `celas.id`
- `movimentacoes.usuario_id` → `usuarios.id`
- `escalas.usuario_id` → `usuarios.id`
- `escalas.unidade_id` → `unidades.id`
- `escalas.galeria_id` → `galerias.id`
- `auditoria_logs.usuario_id` → `usuarios.id`
