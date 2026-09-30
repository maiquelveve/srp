# Data Model: Administração de Usuários e Documentos

Identificadores em inglês (Constituição XI); rótulos e mensagens ficam em português na camada de
apresentação, nunca no schema.

## Entidades alteradas

### User (`users`, já existente — `backend/src/users/entities/user.entity.ts`)

Nenhuma coluna nova. Esta fase adiciona **comportamento** sobre as colunas já existentes:

| Coluna existente | Uso novo nesta fase |
|---|---|
| `name`, `badgeNumber`, `jobTitle` | Passam a ser editáveis via `PATCH /users/:id` (FR-003) |
| `email` | Passa a ser editável via `PATCH /users/:id` (FR-003, pedido do usuário) — corrige erro de digitação no cadastro; `409` se já pertencer a outro usuário, mesma constraint única já existente |
| `role` | Passa a ser editável via `PATCH /users/:id`, incluindo promover/rebaixar de `WARDEN` (FR-003, Clarifications #1) |
| `active` | Passa a ser reativável via `PATCH /users/:id/reactivate` (FR-004), além de desativável (já existente) |
| `units` (ManyToMany, tabela pivot `user_units`) | Passa a ser alterável por duas operações distintas: substituir (FR-006) ou somar (FR-006a) |
| `passwordHash` | Passa a ser redefinível por terceiro via `PATCH /users/:id/reset-password` (FR-007), além de pela própria pessoa via `PATCH /auth/change-password` (FR-016) |

**Regra de negócio nova (pedido do usuário, ajuste de UI da Phase 3)**: um usuário não pode ter
mais de 3 lotações simultâneas. Checada em `create()` (`dto.unitIds`), `replaceUnits()`
(`dto.unitIds`) e `addUnits()` (união com as unidades já existentes) — `400 Bad Request` se
exceder. `@ArrayMaxSize(3)` nos DTOs é só a primeira barreira (não sabe o estado atual do
usuário); a checagem real, pós-soma, mora no service.

**Regra de negócio nova (FR-008a)**: restrita a exatamente 4 ações sobre a própria conta —
`deactivate` (endpoint já existente, feature 001, que passa a ganhar essa checagem nesta fase),
a mudança de `role` dentro de `update` (rebaixar o próprio perfil), `replaceUnits` e `addUnits` —
nunca podem ter `targetUserId === actingUserId`; reforçado no service (`403`), não só na UI.
`update()` só bloqueia quando o payload muda o próprio `role`; editar nome/matrícula/cargo sem
tocar o `role` é permitido sobre a própria conta. As demais operações (`reactivate`,
`resetPassword`, `resendPasswordEmail`) são permitidas sobre a própria conta — nem FR-008a nem a
Clarification #4 as restringem.

### RefreshToken (`refresh_tokens`, já existente — `backend/src/users/entities/refresh-token.entity.ts`)

Nenhuma coluna nova. `TokenService` ganha o método `revokeAllForUser(userId, exceptTokenHash?)`
(research.md #1), reaproveitado por `deactivate()` (refatorado para usá-lo em vez da query inline),
`resetPassword()` e `changePassword()`.

## Entidades novas

### DocumentType (`document_types`)

| Campo | Tipo | Regras |
|---|---|---|
| `id` | `int` (PK, gerado) | |
| `code` | `varchar(20)`, único | Identificador estável em inglês: `FORM`, `TEMPLATE`, `MANUAL`. Usado pelo frontend para montar o menu/filtro; nunca exposto ao usuário final. |
| `label` | `varchar(50)` | Rótulo em português exibido na interface: "Formulários", "Modelos de Documentos", "Manuais". |

3 linhas fixas, inseridas por migration (seed), sem endpoint de criar/editar/remover — a lista é
fechada por decisão de escopo (`spec.md` FR-009).

### Document (`documents`)

| Campo | Tipo | Regras |
|---|---|---|
| `id` | `int` (PK, gerado) | |
| `name` | `varchar(200)` | Nome de exibição escolhido por quem envia. Único junto com `documentTypeId` (constraint composta, research.md #9). |
| `path` | `varchar(500)` | Caminho relativo do arquivo em `DOCUMENTS_STORAGE_PATH` (nome gerado em disco, não o nome original — research.md #8). Nunca exposto diretamente ao frontend; o download passa pelo endpoint autenticado, não por URL direta ao arquivo. |
| `originalFileName` | `varchar(255)` | Nome do arquivo como enviado (para o navegador nomear o download corretamente), distinto de `path`. |
| `mimeType` | `varchar(100)` | Detectado pela verificação de assinatura (research.md #3), não confiado do header da requisição. |
| `sizeBytes` | `int` | Para exibição (ex.: "1,2 MB" no card) e auditoria. |
| `documentTypeId` | `int` (FK → `document_types.id`) | |
| `uploadedByUserId` | `int` (FK → `users.id`) | Quem enviou (Chefia/Diretor ou Supervisor), para exibir "enviado por" se necessário e para auditoria. |
| `createdAt` | `timestamp` | Data de publicação (usada para ordenar a listagem, mais recente primeiro). |

**Validação em `create` (FR-013, FR-013a, FR-014, FR-010a)**:
1. Extensão declarada ∈ {`.docx`, `.doc`, `.txt`, `.pdf`} → senão `400`.
2. Tamanho ≤ `DOCUMENTS_MAX_FILE_SIZE_MB` → senão `413`.
3. Assinatura real do conteúdo corresponde à extensão (research.md #3) → senão `400`.
4. Não existe outro documento com o mesmo `name` no mesmo `documentTypeId` → senão `409`.

**Remoção (FR-012)**: hard delete da linha + arquivo em disco (research.md #10); `AuditAction.DELETE`
com `oldData` = snapshot completo da linha antes de remover.

## Relações

```text
User ──ManyToMany── Unit           (já existente, tabela pivot user_units)
User ──OneToMany──  RefreshToken   (já existente)
Document ──ManyToOne── DocumentType
Document ──ManyToOne── User (uploadedByUserId)
```

## Migrations previstas

1. `<timestamp>-AddDocumentsTables.ts` — cria `document_types` (+ seed das 3 linhas fixas) e
   `documents` (com a constraint única composta `(document_type_id, name)` e FKs).

Nenhuma migration é necessária em `users`/`refresh_tokens` — todas as colunas usadas já existem.
