# Contract: Rotinas (`/api/v1/routines`)

Cobre User Story 4 (FR-017…FR-020).

Rotina é uma atividade **coletiva**, aplicada a uma galeria/unidade inteira num horário
programado (ex.: pátio, corre, faxina, dias de visita) — nunca referencia um preso individual.
Contraste com Movimentação (`contracts/movements.md`), que é sempre o registro individual de UM
preso saindo/retornando (ex.: levar um preso específico até sua visita, atendimento médico).
Ver research.md #26 para a distinção completa.

| Método | Rota | Perfis | Descrição |
|---|---|---|---|
| GET | `/api/v1/routines?galleryId=&shift=today` | qualquer autenticado | Lista rotinas programadas, com filtro por galeria/turno atual (FR-020). |
| POST | `/api/v1/routines` | WARDEN | Cria rotina (nome, tipo, horários, escopo) (FR-017/FR-018). |
| PATCH | `/api/v1/routines/:id/schedule` | SUPERVISOR, WARDEN | Ajusta horários de uma rotina existente (FR-019). |
| PATCH | `/api/v1/routines/:id/activation` | SUPERVISOR, WARDEN | Ativa/desativa a rotina para uma data específica (FR-019). |
| DELETE | `/api/v1/routines/:id` | WARDEN | Remove rotina não bloqueada. |

## Regras

- `PATCH .../schedule` e `PATCH .../activation` MUST responder `403` se a rotina tiver
  `locked=true` e o requisitante for `SUPERVISOR` (FR-019).
- `POST /routines` é o único endpoint que cria um novo *tipo* de rotina; `SUPERVISOR` nunca tem
  acesso a ele (FR-003, FR-019).
- `DELETE` MUST responder `409` se `locked=true`.

## Exemplo — PATCH /api/v1/routines/12/activation

Request:
```json
{ "date": "2026-08-09", "active": false }
```

Response 200:
```json
{ "routineId": 12, "date": "2026-08-09", "active": false }
```

Response 403 (rotina bloqueada, usuário Supervisor):
```json
{ "message": "Rotina padrão não pode ser desativada por este perfil" }
```
