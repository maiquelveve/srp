# Phase 1 Data Model: Gestão de Rotinas Penitenciárias (SRP)

**Input**: Key Entities em [spec.md](./spec.md), requisitos funcionais FR-001…FR-032, schema de
referência em `docs/srp_spec_database_model.md` (autoritativo para tipos/colunas exatos do
Prisma schema — este documento descreve o modelo em nível de domínio e as regras de negócio que o
schema deve impor).

**Convenção de nomenclatura**: por decisão do usuário do projeto (2026-08-04) e Princípio XI da
Constituição (v1.1.0), todo nome de entidade/campo/enum abaixo é o nome em inglês que será usado
literalmente no `schema.prisma` e no código do backend — não são apenas rótulos de domínio. O
texto explicativo permanece em português (documentação técnica interna); os nomes entre crases
são os identificadores reais.

## Visão geral das relações

```
Role 1───* User *───* Unit (vínculo, FR-004a)
User 1───* RefreshToken
Unit 1───* Gallery 1───* Cell 1───* Inmate
Inmate 1───* CellHistory
Inmate 1───* Movement *───1 MovementType
Gallery 1───* Routine 1───* RoutineSchedule
User(PRISON_OFFICER) 1───* StaffSchedule
Unit/Gallery/Sector/Shift 1───* MinimumStaffingConfig
(qualquer entidade) 1───* AuditLog
```

## Entidades

### Role (`roles`)

Papel de acesso que determina as permissões de um User.

| Campo | Tipo/Regra |
|---|---|
| `name` | `PRISON_OFFICER` \| `SUPERVISOR` \| `WARDEN`, único |
| `description` | texto livre opcional |

- **Regras**: valor fixo entre os três perfis definidos na spec (FR-001); não é editável por
  usuários finais nesta fase (sem UI de criação de novos perfis).

### User (`users`)

Pessoa com acesso ao sistema.

| Campo | Tipo/Regra |
|---|---|
| `name`, `email` (único) | obrigatórios |
| `passwordHash` | obrigatório, Argon2 — **nunca** retornado por nenhuma API nem gravado sem redação em `audit_logs` (research.md #6) |
| `badgeNumber` | único quando presente (matrícula) |
| `jobTitle` | opcional (cargo — relevante sobretudo para `role=PRISON_OFFICER`, FR-021) |
| `role` | referência a Role, obrigatório |
| `units` | 1..N Units, via tabela de junção `user_units` (FR-004a) |
| `active` | boolean, default `true` |

- **Regra (FR-021, research.md #15)**: não existe entidade "Staff"/"Policial" separada — um policial penal **é** um `User` com `role=PRISON_OFFICER`. `StaffSchedule.user` referencia esta mesma entidade diretamente.

- **Regras**: um User Chefia/Diretor (`WARDEN`) ou Supervisor só acessa dados das Units a que está
  vinculado (FR-004a); um User inativo (`active=false`) não autentica.
- **Regra (FR-030…FR-032)**: só `WARDEN` MUST poder criar (`POST /api/v1/users`) ou desativar
  (`PATCH /api/v1/users/:id/deactivate`) outro User; `PRISON_OFFICER` e `SUPERVISOR` MUST receber
  `403` nessas rotas.
- **Validação**: `email` deve ser único e válido; `passwordHash` nunca é exposto/retornado por
  nenhuma API (Constituição II).

### RefreshToken (`refresh_tokens`)

Sessão de refresh persistida para permitir revogação real no logout (research.md #11).

| Campo | Tipo/Regra |
|---|---|
| `user` | referência obrigatória a User |
| `tokenHash` | obrigatório, SHA-256 do refresh token emitido (nunca o token em claro) |
| `expiresAt` | obrigatório |
| `revokedAt` | nulo enquanto válido |

- **Regra**: `POST /auth/refresh` MUST revogar (`revokedAt = now()`) o token usado e emitir um
  novo (rotação); `POST /auth/logout` MUST revogar o token atual. Um token com `tokenHash`
  desconhecido, expirado ou revogado MUST ser rejeitado com `401`.

### Unit (`units`)

| Campo | Tipo/Regra |
|---|---|
| `name`, `code` (único) | obrigatórios |
| `address`, `phone` | opcionais |
| `active` | boolean, default `true` |

### Gallery (`galleries`)

| Campo | Tipo/Regra |
|---|---|
| `unit` | referência obrigatória a Unit |
| `code` | obrigatório, único dentro da unit |
| `type` | ex.: `MALE`/`FEMALE` |
| `active` | boolean, default `true` |

### Cell (`cells`)

| Campo | Tipo/Regra |
|---|---|
| `gallery` | referência obrigatória a Gallery |
| `code` | obrigatório, único dentro da gallery |
| `capacity` | inteiro ≥ 0 |
| `type` | `SHARED`/`INDIVIDUAL` |
| `active` | boolean, default `true` |

- **Regra de capacidade**: uma nova alocação de preso (troca de cela, retorno de movimentação
  definitiva) MUST ser rejeitada se a ocupação atual da cela já atingiu `capacity` (ver Edge
  Cases em spec.md).

### Inmate (`inmates`)

| Campo | Tipo/Regra |
|---|---|
| `name` | obrigatório |
| `registrationId` (RGI) | único quando presente |
| `birthDate`, `custodyRegime`, `photoUrl` | opcionais — `photoUrl` é texto simples (URL); mecanismo/provedor de upload ainda não decidido, ver research.md #13 |
| `status` | `ACTIVE` \| `RELEASED` \| `ANKLE_MONITOR` \| `TRANSFERRED` \| `DECEASED`, default `ACTIVE` |
| `currentCell` | referência obrigatória a Cell enquanto `status = ACTIVE` |

- **Regra (Constituição VI / research.md #9)**: `status` é uma projeção mantida
  transacionalmente junto com cada Movement/situação definitiva — nunca escrita por um fluxo
  independente.
- **State transitions**:
  - `ACTIVE → ACTIVE` (movimentação temporária de saída/retorno, não altera `status`, apenas o
    "em trânsito" observável via Movement em aberto).
  - `ACTIVE → RELEASED | ANKLE_MONITOR | TRANSFERRED` (situação definitiva, FR-012/013/014) —
    libera a cela atual.
  - `ACTIVE → ACTIVE` com troca de `currentCell` (troca de cela definitiva, FR-015).
  - Estados terminais (`RELEASED`, `ANKLE_MONITOR`, `TRANSFERRED`, `DECEASED`) não retornam
    automaticamente a `ACTIVE`; qualquer correção exige novo registro auditado (ver Edge Cases em
    spec.md), não uma edição direta do status.

### CellHistory (`inmate_cell_history`)

Linha do tempo de ocupação de celas por um Inmate, usada para reconstruir localização histórica
(FR-016).

| Campo | Tipo/Regra |
|---|---|
| `inmate`, `cell` | referências obrigatórias |
| `entryDate` | obrigatório |
| `exitDate` | nulo enquanto ocupação corrente |
| `reason` | `CELL_CHANGE` \| `RELEASE` \| `ANKLE_MONITOR` \| `TRANSFER` |
| `user` | responsável pelo registro |

- **Regra**: toda mudança de `currentCell` de um Inmate MUST gerar exatamente um novo registro
  aqui e fechar (`exitDate`) o registro anterior em aberto, na mesma transação.

### MovementType (`movement_types`)

| Campo | Tipo/Regra |
|---|---|
| `name` | único (pátio, corre, faxina, atendimento médico interno/externo, visita, transferência, liberdade, tornozeleira, troca de cela, ...) |
| `category` | `TEMPORARY` \| `PERMANENT` |

### Movement (`movements`)

| Campo | Tipo/Regra |
|---|---|
| `inmate`, `movementType` | referências obrigatórias |
| `originCell` | obrigatória |
| `destinationCell` | apenas para troca de cela |
| `destinationLocation`, `reason`, `notes` | texto livre opcional |
| `exitDateTime` | obrigatória |
| `returnDateTime` | obrigatória apenas para `category = TEMPORARY`, nula até o retorno |
| `user` | responsável pelo registro |
| `idempotencyKey` | UUID gerado pelo cliente (app móvel), único — ver regra offline |

- **Regra (FR-010)**: não pode existir mais de um Movement `TEMPORARY` em aberto
  (`returnDateTime IS NULL`) simultaneamente para o mesmo Inmate.
- **Regra (FR-009)**: registrar retorno de um Movement já retornado MUST ser rejeitado
  (idempotência/edge case).
- **Regra (offline, FR-011a)**: cada Movement criado pelo app móvel carrega `idempotencyKey`
  gerado no cliente; o backend rejeita silenciosamente reenvios com a mesma chave (sem gerar
  duplicata nem erro visível ao usuário após reconexão).

### Routine (`routines`)

| Campo | Tipo/Regra |
|---|---|
| `name` | obrigatório |
| `type` | `DAILY` \| `WEEKDAY` \| `VISIT_DAY` \| `WEEKEND` \| `HOLIDAY` |
| `gallery`/`unit` (escopo) | obrigatório (FR-017) |
| `locked` | boolean — `true` quando definida como padrão pela Chefia/Diretor (FR-018) |
| `active` | boolean, default `true` |
| `createdBy` | User (`WARDEN`) |

- **Regra (FR-019)**: Supervisor pode alterar horários e `active` por dia, mas nunca `locked`
  nem criar novas Routines.

### RoutineSchedule (`routine_schedules`)

| Campo | Tipo/Regra |
|---|---|
| `routine` | referência obrigatória |
| `weekday` | 0–6 ou nulo (todos os dias) |
| `time` | obrigatório |
| `active` | boolean, default `true` |

- **Regra**: combinação (`routine`, `weekday`, `time`) é única.

### StaffSchedule (`staff_schedules`)

| Campo | Tipo/Regra |
|---|---|
| `user` (policial) | referência obrigatória |
| `unit`, `sector` | obrigatório/opcional |
| `date`, `shift` | `MORNING` \| `AFTERNOON` \| `NIGHT`, obrigatórios |
| `attendanceStatus`, `absenceReason`, `overtimeHours` | registrados por escala |

- **Regra**: combinação (`user`, `date`, `shift`) é única — um policial não pode ter duas
  escalas conflitantes no mesmo turno/dia.

### MinimumStaffingConfig (`minimum_staffing_config`)

Valor mínimo de efetivo configurável por setor/turno/unidade (FR-024, research.md #12).

| Campo | Tipo/Regra |
|---|---|
| `unit`, `sector`, `shift` | obrigatórios; combinação única |
| `minimumHeadcount` | inteiro > 0 |
| `updatedBy` | User (`WARDEN`) |

- **Regra**: só `WARDEN` MUST poder criar/alterar (`PATCH /api/v1/staff/minimum-staffing-config`);
  `GET /schedules/minimum-staffing` MUST usar este valor em vez de uma constante fixa.

### AuditLog (`audit_logs`)

| Campo | Tipo/Regra |
|---|---|
| `user` | quem executou a ação |
| `affectedTable`, `recordId` | entidade afetada |
| `action` | `INSERT` \| `UPDATE` \| `DELETE` |
| `oldData`, `newData` | JSON, com campos sensíveis redigidos (research.md #6) |
| `timestamp` | obrigatório |

- **Regra (Constituição III / FR-026/FR-027)**: imutável após criado — nenhuma API expõe
  update/delete para esta entidade; gerado automaticamente pelo `AuditInterceptor`
  (research.md #6) para toda operação de escrita relevante.
- **Regra (Constituição II / research.md #6)**: `oldData`/`newData` MUST substituir o valor de
  campos sensíveis (`passwordHash`, `tokenHash`, e demais marcados `@Sensitive()`) por
  `"[REDACTED]"` antes de persistir.

## Validações cross-entity relevantes ao plano (resumo)

| Regra | Origem |
|---|---|
| Um Movement temporário em aberto bloqueia nova saída para o mesmo Inmate | FR-010 |
| Capacidade da Cell não pode ser excedida em nova alocação | Edge Cases (spec.md) |
| Routine `locked=true` não pode ser excluída/ter tipo alterado por Supervisor | FR-019, Assumptions (spec.md) |
| User só acessa dados de Units a que está vinculado | FR-004a |
| Somente `WARDEN` cria/desativa User | FR-030…FR-032 |
| RefreshToken revogado/expirado/desconhecido é rejeitado | research.md #11 |
| Toda escrita relevante gera AuditLog imutável, com campos sensíveis redigidos | FR-026, FR-027, research.md #6 |
