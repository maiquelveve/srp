# Contract: Usuários, Cadastro e Mapa da Unidade (`/api/v1/users`, `/units`, `/galleries`, `/cells`, `/inmates`)

Cobre gestão de usuários (FR-030…FR-032) e User Story 1 (FR-005…FR-007). Todas as rotas exigem
autenticação; escritas exigem perfil `WARDEN` (Chefia/Diretor) (FR-004), exceto onde indicado.

| Método | Rota | Perfis (escrita) | Descrição |
|---|---|---|---|
| GET | `/api/v1/users?role=&unitId=` | SUPERVISOR, WARDEN | Lista usuários das unidades acessíveis ao requisitante, filtráveis por perfil (ex.: `role=PRISON_OFFICER` para o roster de policiais penais, FR-021) e unidade (FR-004a). |
| POST | `/api/v1/users` | WARDEN | Cadastra usuário (nome, email, matrícula, cargo, perfil, unidades) (FR-030). |
| PATCH | `/api/v1/users/:id/deactivate` | WARDEN | Desativa usuário; usuário desativado não autentica mais (FR-031). |
| GET | `/api/v1/units` | qualquer autenticado, escopado por FR-004a | Lista unidades acessíveis ao usuário. |
| POST | `/api/v1/units` | WARDEN | Cadastra unidade. |
| PATCH | `/api/v1/units/:id` | WARDEN | Atualiza unidade. |
| GET | `/api/v1/units/:id/galleries` | qualquer autenticado | Lista galerias de uma unidade. |
| POST | `/api/v1/galleries` | WARDEN | Cadastra galeria vinculada a uma unidade. |
| PATCH | `/api/v1/galleries/:id` | WARDEN | Atualiza galeria. |
| GET | `/api/v1/galleries/:id/cells` | qualquer autenticado | Lista celas de uma galeria, com ocupação atual. |
| POST | `/api/v1/cells` | WARDEN | Cadastra cela vinculada a uma galeria. |
| PATCH | `/api/v1/cells/:id` | WARDEN | Atualiza cela. |
| GET | `/api/v1/inmates?galleryId=&cellId=&status=` | qualquer autenticado | Lista presos filtrados por cela/galeria/unidade/status (FR-007). |
| GET | `/api/v1/inmates/:id` | qualquer autenticado | Detalhe de um preso, incluindo status atual. |
| POST | `/api/v1/inmates` | WARDEN | Cadastra preso (FR-006). |
| PATCH | `/api/v1/inmates/:id` | WARDEN | Atualiza dados cadastrais do preso (não altera status/cela — ver contracts/movements.md). |

## Regras

- `POST /users` e `PATCH /users/:id/deactivate` MUST responder `403` para qualquer perfil
  diferente de `WARDEN` (FR-032).
- A senha inicial de um usuário criado via `POST /users` MUST ser gerada pelo backend e nunca
  retornada em texto claro na resposta da API nem persistida sem hash — comunicada via fluxo
  fora de banda (ex.: link de definição de senha com token de uso único), ver research.md #10.
- Todas as respostas de listagem MUST ser filtradas pelo escopo de unidade do usuário autenticado
  (FR-004a), mesmo quando o cliente não envia filtro explícito.
- `POST/PATCH` em qualquer destas rotas MUST gerar log de auditoria (Constituição III), com
  campos sensíveis redigidos (research.md #6).
- `POST /cells` MUST validar `capacity >= 0`; ocupação corrente é calculada, não armazenada
  diretamente nesta entidade.
- `PATCH /units/:id` e `PATCH /galleries/:id` com `active: false` MUST cascatear a desativação
  pra toda a subárvore (Unidade→Galerias→Celas; Galeria→Celas), e MUST responder `409` sem
  alterar nada — nem o próprio registro — se existir qualquer preso `status: ACTIVE` em qualquer
  Cela dentro do escopo sendo desativado (research.md #23). `PATCH /cells/:id` com `active: false`
  aplica a mesma checagem sobre os presos da própria cela, sem cascata (é o nível folha).

## Exemplo — POST /api/v1/users

Request:
```json
{
  "name": "Maria Souza",
  "email": "maria.souza@srp.rs.gov.br",
  "badgeNumber": "PP-4821",
  "jobTitle": "Agente Penitenciário",
  "role": "PRISON_OFFICER",
  "unitIds": [3]
}
```

Response 201:
```json
{ "id": 42, "name": "Maria Souza", "email": "maria.souza@srp.rs.gov.br", "role": "PRISON_OFFICER", "jobTitle": "Agente Penitenciário", "units": [3], "active": true }
```

Response 403 (requisitante não é WARDEN):
```json
{ "message": "Apenas Chefia/Diretor pode cadastrar usuários" }
```

## Exemplo — GET /api/v1/inmates?cellId=42

Response 200:
```json
{
  "data": [
    {
      "id": 101,
      "name": "...",
      "status": "ACTIVE",
      "currentCellId": 42,
      "inMovement": false
    }
  ],
  "total": 1
}
```
