# Phase 1 Data Model: Gestão de Rotinas Penitenciárias (SRP)

**Input**: Key Entities em [spec.md](./spec.md), requisitos funcionais FR-001…FR-029, schema de
referência em `docs/srp_spec_database_model.md` (autoritativo para tipos/colunas exatos do
Prisma schema — este documento descreve o modelo em nível de domínio e as regras de negócio que o
schema deve impor).

## Visão geral das relações

```
Perfil 1───* Usuário *───* Unidade (vínculo, FR-004a)
Unidade 1───* Galeria 1───* Cela 1───* Preso
Preso 1───* HistóricoDeCela
Preso 1───* Movimentação *───1 TipoDeMovimentação
Galeria 1───* Rotina 1───* HorárioDeRotina
Usuário(Policial) 1───* EscalaDeEfetivo
(qualquer entidade) 1───* LogDeAuditoria
```

## Entidades

### Perfil

Papel de acesso que determina as permissões de um Usuário.

| Campo | Tipo/Regra |
|---|---|
| nome | `POLICIAL_PENAL` \| `SUPERVISOR` \| `CHEFIA_DIRETOR`, único |
| descricao | texto livre opcional |

- **Regras**: valor fixo entre os três perfis definidos na spec (FR-001); não é editável por
  usuários finais nesta fase (sem UI de criação de novos perfis).

### Usuário

Pessoa com acesso ao sistema.

| Campo | Tipo/Regra |
|---|---|
| nome, email (único) | obrigatórios |
| senha_hash | obrigatório, Argon2 |
| matricula | único quando presente |
| perfil | referência a Perfil, obrigatório |
| unidades vinculadas | 1..N Unidades (FR-004a) |
| ativo | boolean, default true |

- **Regras**: um Usuário Chefia/Diretor ou Supervisor só acessa dados das Unidades a que está
  vinculado (FR-004a); um Usuário inativo não autentica.
- **Validação**: email deve ser único e válido; senha nunca é exposta/retornada por nenhuma API
  (Constituição II).

### Unidade Prisional

| Campo | Tipo/Regra |
|---|---|
| nome, codigo (único) | obrigatórios |
| endereco, telefone | opcionais |
| ativo | boolean, default true |

### Galeria

| Campo | Tipo/Regra |
|---|---|
| unidade | referência obrigatória a Unidade |
| codigo | obrigatório, único dentro da unidade |
| tipo | ex.: masculino/feminino |
| ativo | boolean, default true |

### Cela

| Campo | Tipo/Regra |
|---|---|
| galeria | referência obrigatória a Galeria |
| codigo | obrigatório, único dentro da galeria |
| capacidade | inteiro ≥ 0 |
| tipo | coletiva/individual |
| ativo | boolean, default true |

- **Regra de capacidade**: uma nova alocação de preso (troca de cela, retorno de movimentação
  definitiva) MUST ser rejeitada se a ocupação atual da cela já atingiu `capacidade` (ver Edge
  Cases em spec.md).

### Preso

| Campo | Tipo/Regra |
|---|---|
| nome | obrigatório |
| rgi | único quando presente |
| data_nascimento, regime, foto_url | opcionais |
| status | `ATIVO` \| `LIBERDADE` \| `TORNOZELEIRA` \| `TRANSFERIDO` \| `OBITO`, default `ATIVO` |
| cela_atual | referência obrigatória a Cela enquanto `status = ATIVO` |

- **Regra (Constituição VI / research.md #9)**: `status` é uma projeção mantida
  transacionalmente junto com cada Movimentação/Situação Definitiva — nunca escrita por um fluxo
  independente.
- **State transitions**:
  - `ATIVO → ATIVO` (movimentação temporária de saída/retorno, não altera status, apenas o
    "em trânsito" observável via Movimentação em aberto).
  - `ATIVO → LIBERDADE | TORNOZELEIRA | TRANSFERIDO` (situação definitiva, FR-012/013/014) — libera
    a cela atual.
  - `ATIVO → ATIVO` com troca de `cela_atual` (troca de cela definitiva, FR-015).
  - Estados terminais (`LIBERDADE`, `TORNOZELEIRA`, `TRANSFERIDO`, `OBITO`) não retornam
    automaticamente a `ATIVO`; qualquer correção exige novo registro auditado (ver Edge Cases em
    spec.md), não uma edição direta do status.

### Histórico de Cela

Linha do tempo de ocupação de celas por um Preso, usada para reconstruir localização histórica
(FR-016).

| Campo | Tipo/Regra |
|---|---|
| preso, cela | referências obrigatórias |
| data_entrada | obrigatório |
| data_saida | nulo enquanto ocupação corrente |
| motivo | `TROCA_CELA` \| `LIBERDADE` \| `TORNOZELEIRA` \| `TRANSFERENCIA` |
| usuario | responsável pelo registro |

- **Regra**: toda mudança de `cela_atual` de um Preso MUST gerar exatamente um novo registro aqui
  e fechar (`data_saida`) o registro anterior em aberto, na mesma transação.

### Tipo de Movimentação

| Campo | Tipo/Regra |
|---|---|
| nome | único (pátio, corre, faxina, atendimento médico interno/externo, visita, transferência,
  liberdade, tornozeleira, troca de cela, ...) |
| categoria | `TEMPORARIA` \| `DEFINITIVA` |

### Movimentação

| Campo | Tipo/Regra |
|---|---|
| preso, tipo_movimentacao | referências obrigatórias |
| cela_origem | obrigatória |
| cela_destino | apenas para troca de cela |
| local_destino, motivo, observacoes | texto livre opcional |
| data_hora_saida | obrigatória |
| data_hora_retorno | obrigatória apenas para `categoria = TEMPORARIA`, nula até o retorno |
| usuario | responsável pelo registro |

- **Regra (FR-010)**: não pode existir mais de uma Movimentação `TEMPORARIA` em aberto
  (`data_hora_retorno IS NULL`) simultaneamente para o mesmo Preso.
- **Regra (FR-009)**: registrar retorno de uma movimentação já retornada MUST ser rejeitado
  (idempotência/edge case).
- **Regra (offline, FR-011a)**: cada Movimentação criada pelo app móvel carrega um identificador
  idempotente gerado no cliente; o backend rejeita silenciosamente reenvios com o mesmo
  identificador (sem gerar duplicata nem erro visível ao usuário após reconexão).

### Rotina

| Campo | Tipo/Regra |
|---|---|
| nome | obrigatório |
| tipo | `DIARIA` \| `DIA_SEMANA` \| `DIA_VISITA` \| `FINAL_SEMANA` \| `FERIADO` |
| galeria(s)/unidade(s) | escopo obrigatório (FR-017) |
| bloqueada | boolean — `true` quando definida como padrão pela Chefia/Diretor (FR-018) |
| ativa | boolean, default true |
| criada_por | Usuário (Chefia/Diretor) |

- **Regra (FR-019)**: Supervisor pode alterar horários e `ativa` por dia, mas nunca `bloqueada`
  nem criar novas Rotinas.

### Horário de Rotina

| Campo | Tipo/Regra |
|---|---|
| rotina | referência obrigatória |
| dia_semana | 0–6 ou nulo (todos os dias) |
| horario | obrigatório |
| ativo | boolean, default true |

- **Regra**: combinação (`rotina`, `dia_semana`, `horario`) é única.

### Escala de Efetivo

| Campo | Tipo/Regra |
|---|---|
| usuario (policial) | referência obrigatória |
| unidade, galeria/setor | obrigatório/opcional |
| data, turno | `MANHA` \| `TARDE` \| `NOITE`, obrigatórios |
| presença/falta/abono/horas extras | registrados por escala |

- **Regra**: combinação (`usuario`, `data`, `turno`) é única — um policial não pode ter duas
  escalas conflitantes no mesmo turno/dia.

### Log de Auditoria

| Campo | Tipo/Regra |
|---|---|
| usuario | quem executou a ação |
| tabela_afetada, registro_id | entidade afetada |
| acao | `INSERT` \| `UPDATE` \| `DELETE` |
| dados_antigos, dados_novos | JSON, conforme aplicável |
| data_hora | obrigatório |

- **Regra (Constituição III / FR-026/FR-027)**: imutável após criado — nenhuma API expõe
  update/delete para esta entidade; gerado automaticamente pelo `AuditInterceptor`
  (research.md #6) para toda operação de escrita relevante.

## Validações cross-entity relevantes ao plano (resumo)

| Regra | Origem |
|---|---|
| Uma Movimentação temporária em aberto bloqueia nova saída para o mesmo Preso | FR-010 |
| Capacidade da Cela não pode ser excedida em nova alocação | Edge Cases (spec.md) |
| Rotina `bloqueada=true` não pode ser excluída/ter tipo alterado por Supervisor | FR-019, Assumptions (spec.md) |
| Usuário só acessa dados de Unidades a que está vinculado | FR-004a |
| Toda escrita relevante gera Log de Auditoria imutável | FR-026, FR-027 |
