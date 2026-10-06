# Contract: Administração de Usuários (`/api/v1/users`)

Estende `contracts/structure.md` da feature 001 (que já define `GET /api/v1/users`,
`POST /api/v1/users` e `PATCH /api/v1/users/:id/deactivate`). Todo endpoint aqui exige
`Authorization: Bearer <access_token>` de um usuário com perfil `WARDEN` (Chefia/Diretor),
exceto onde indicado.

| Método | Rota | Perfis | Descrição |
|---|---|---|---|
| PATCH | `/api/v1/users/:id` | WARDEN | Edita dados cadastrais do usuário: `name`, `email`, `badgeNumber`, `jobTitle`, `role` (FR-003). |
| PATCH | `/api/v1/users/:id/reactivate` | WARDEN | Reativa um usuário desativado (FR-004). |
| PUT | `/api/v1/users/:id/units` | WARDEN | **Trocar lotação**: substitui a(s) unidade(s) do usuário pela(s) informada(s) (FR-006). |
| POST | `/api/v1/users/:id/units` | WARDEN | **Adicionar lotação**: soma uma ou mais unidades às já vinculadas, sem remover as existentes (FR-006a). |
| PATCH | `/api/v1/users/:id/reset-password` | WARDEN | Gera senha temporária, envia por e-mail, invalida a anterior e revoga todas as sessões do usuário (FR-007). |
| POST | `/api/v1/users/:id/resend-password-email` | WARDEN | Reenvia o e-mail de senha inicial ou de reset ainda pendente (FR-002a, FR-007a). |

## Alterações a `GET /api/v1/users` (pedido do usuário, ajuste de UI da Phase 3)

- Novos parâmetros opcionais: `active` (`'true'`/`'false'`, omitido lista os dois), `search`
  (substring case-insensitive contra `name`/`email`/`badgeNumber`), `limit` (1–100, default 20),
  `offset` (paginação, junto com `total` já existente na resposta).
- A resposta NUNCA inclui o próprio requisitante (edição da própria conta é resolvida pela tela de
  perfil, não por esta administração).

## Máximo de 3 lotações simultâneas (pedido do usuário, ajuste de UI da Phase 3)

- `POST /users`, `PUT /users/:id/units` e `POST /users/:id/units` MUST responder `400` se o
  resultado final (após a operação) deixar o usuário com mais de 3 unidades vinculadas.

## Regras

- Todos os 6 endpoints acima MUST responder `403` para qualquer perfil diferente de `WARDEN`
  (FR-008).
- FR-008a/Clarifications #4 restringem exatamente 4 ações sobre a própria conta (`:id` igual ao
  `sub` do JWT do requisitante) — as demais são permitidas sobre si mesmo:
  - `PATCH /api/v1/users/:id/deactivate` (`contracts/structure.md`, feature 001) MUST responder
    `403` quando `:id` for o próprio requisitante — regra nova introduzida por esta fase.
  - `PATCH /api/v1/users/:id` MUST responder `403` quando `:id` for o próprio requisitante **e**
    o payload alterar o `role` atual — editar nome/matrícula/cargo sem tocar o `role` é permitido
    sobre a própria conta.
  - `PUT /api/v1/users/:id/units` e `POST /api/v1/users/:id/units` MUST responder `403` quando
    `:id` for o próprio requisitante, sempre (não têm sub-caso permitido).
  - `PATCH /api/v1/users/:id/reactivate`, `PATCH /api/v1/users/:id/reset-password` e
    `POST /api/v1/users/:id/resend-password-email` MUST permitir `:id` igual ao próprio
    requisitante — nenhuma restrição de auto-alvo nesses três.
- `PUT /api/v1/users/:id/units` e `POST /api/v1/users/:id/units` MUST responder `403` se alguma
  unidade de `unitIds` estiver fora do escopo de unidade do próprio requisitante (FR-004a, mesma
  regra já aplicada a `POST /users` via `assertUnitScope`) — a Chefia/Diretor só pode lotar alguém
  numa unidade a que ela própria está vinculada.
- `PATCH /users/:id` permite alterar `role` para/de `WARDEN` livremente sobre outro usuário
  (FR-003, Clarifications #1); sobre a própria conta, ver regra acima.
- `PATCH /users/:id` MUST responder `409` se `email` for alterado para um valor que já pertence a
  outro usuário (mesma regra de unicidade de `POST /users`, FR-003) — corrige um erro de digitação
  no cadastro sem deixar o usuário original órfão no banco.
- `PUT /api/v1/users/:id/units` e `POST /api/v1/users/:id/units` MUST responder `400` se
  `unitIds` vier vazio.
- `PATCH /users/:id/reset-password` e `POST /users/:id/create` (contracts/structure.md) MUST
  concluir a operação mesmo que o envio do e-mail falhe — a resposta inclui `emailDelivered: false`
  em vez de erro `5xx` (FR-002a, FR-007a). O frontend usa esse campo para mostrar o aviso e o botão
  "reenviar e-mail".
- `POST /users/:id/resend-password-email` MUST responder `409` se o usuário já trocou a senha
  desde a última senha temporária gerada (nada pendente para reenviar).
- Toda chamada bem-sucedida aos 6 endpoints acima MUST gerar uma entrada de auditoria
  (`AuditAction.UPDATE`) com `oldData`/`newData` (research.md #2); `reset-password` MUST reter
  em `newData` só a informação de que a senha foi alterada, nunca a senha em texto claro
  (Princípio II — Security First, nenhuma informação sensível em log).

## Exemplo — PATCH /api/v1/users/:id

Request:
```json
{ "name": "...", "email": "...", "badgeNumber": "...", "jobTitle": "...", "role": "SUPERVISOR" }
```

Response 200:
```json
{ "id": 12, "name": "...", "role": "SUPERVISOR", "active": true, "units": [3] }
```

Response 403 (requisitante não é WARDEN, ou `:id` é a própria conta):
```json
{ "message": "Apenas outra Chefia/Diretor pode fazer essa alteração" }
```

## Exemplo — PUT /api/v1/users/:id/units (Trocar lotação)

Request:
```json
{ "unitIds": [5] }
```

Response 200:
```json
{ "id": 12, "units": [5] }
```

## Exemplo — POST /api/v1/users/:id/units (Adicionar lotação)

Request:
```json
{ "unitIds": [7] }
```

Response 200:
```json
{ "id": 12, "units": [5, 7] }
```

## Exemplo — PATCH /api/v1/users/:id/reset-password

Response 200 (e-mail entregue):
```json
{ "message": "Senha redefinida e enviada por e-mail", "emailDelivered": true }
```

Response 200 (e-mail falhou, operação concluída mesmo assim):
```json
{ "message": "Senha redefinida, mas o e-mail não pôde ser entregue", "emailDelivered": false }
```
