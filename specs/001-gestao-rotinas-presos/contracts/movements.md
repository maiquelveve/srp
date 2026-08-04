# Contract: Movimentações e Situações Definitivas (`/api/v1/movements`)

Cobre User Story 2 (FR-008…FR-011a) e User Story 3 (FR-012…FR-016).

| Método | Rota | Perfis | Descrição |
|---|---|---|---|
| GET | `/api/v1/movements?inmateId=&open=true` | qualquer autenticado | Lista movimentações; `open=true` filtra as sem retorno registrado. |
| POST | `/api/v1/movements` | PRISON_OFFICER, SUPERVISOR, WARDEN | Registra saída de movimentação temporária (FR-008). |
| PATCH | `/api/v1/movements/:id/return` | PRISON_OFFICER, SUPERVISOR, WARDEN | Registra retorno de uma movimentação temporária (FR-009). |
| POST | `/api/v1/movements/final/release` | WARDEN | Registra liberdade (FR-012). |
| POST | `/api/v1/movements/final/ankle-monitor` | WARDEN | Registra tornozeleira eletrônica (FR-013). |
| POST | `/api/v1/movements/final/transfer` | WARDEN | Registra transferência (FR-014). |
| POST | `/api/v1/movements/final/cell-change` | WARDEN | Registra troca de cela definitiva (FR-015). |
| GET | `/api/v1/inmates/:id/location-history` | qualquer autenticado | Linha do tempo de localização do preso (FR-016). |

## Idempotência (offline, FR-011a)

- `POST /api/v1/movements` e `PATCH /api/v1/movements/:id/return` aceitam um header
  `Idempotency-Key` (UUID gerado pelo app móvel ao criar o registro offline), persistido em
  `movements.idempotency_key`.
- Reenvio com a mesma `Idempotency-Key` MUST retornar `200` com o recurso já criado, sem duplicar
  nem gerar novo log de auditoria.

## Regras

- `POST /movements` MUST ser rejeitado com `409` se já existir movimentação `TEMPORARY` em aberto
  para o mesmo preso (FR-010).
- `PATCH /movements/:id/return` em movimentação já retornada MUST responder `409` (edge case).
- Qualquer endpoint `final/*` MUST, na mesma transação: atualizar `inmates.status`, fechar o
  registro de `CellHistory` corrente e abrir um novo quando aplicável (FR-016), e liberar a
  cela de origem para nova ocupação, respeitando a capacidade da cela destino (data-model.md).
- Todo endpoint desta seção MUST gerar log de auditoria com valores antigos/novos do status do
  preso.

## Exemplo — POST /api/v1/movements

Request:
```json
{
  "inmateId": 101,
  "movementTypeId": 4,
  "originCellId": 42,
  "destinationLocation": "YARD",
  "reason": "Banho de sol"
}
```

Response 201:
```json
{ "id": 5501, "inmateId": 101, "exitDateTime": "2026-08-02T13:05:00Z", "returnDateTime": null }
```

Response 409 (já em aberto):
```json
{ "message": "Preso já possui movimentação em aberto" }
```
