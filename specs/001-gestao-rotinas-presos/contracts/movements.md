# Contract: Movimentações e Situações Definitivas (`/api/v1/movements`)

Cobre User Story 2 (FR-008…FR-011a) e User Story 3 (FR-012…FR-016).

| Método | Rota | Perfis | Descrição |
|---|---|---|---|
| GET | `/api/v1/movements?inmateId=&open=true` | qualquer autenticado | Lista movimentações; `open=true` filtra as sem retorno registrado. |
| POST | `/api/v1/movements` | POLICIAL_PENAL, SUPERVISOR, CHEFIA_DIRETOR | Registra saída de movimentação temporária (FR-008). |
| PATCH | `/api/v1/movements/:id/return` | POLICIAL_PENAL, SUPERVISOR, CHEFIA_DIRETOR | Registra retorno de uma movimentação temporária (FR-009). |
| POST | `/api/v1/movements/final/release` | CHEFIA_DIRETOR | Registra liberdade (FR-012). |
| POST | `/api/v1/movements/final/ankle-monitor` | CHEFIA_DIRETOR | Registra tornozeleira eletrônica (FR-013). |
| POST | `/api/v1/movements/final/transfer` | CHEFIA_DIRETOR | Registra transferência (FR-014). |
| POST | `/api/v1/movements/final/cell-change` | CHEFIA_DIRETOR | Registra troca de cela definitiva (FR-015). |
| GET | `/api/v1/inmates/:id/location-history` | qualquer autenticado | Linha do tempo de localização do preso (FR-016). |

## Idempotência (offline, FR-011a)

- `POST /api/v1/movements` e `PATCH /api/v1/movements/:id/return` aceitam um header
  `Idempotency-Key` (UUID gerado pelo app móvel ao criar o registro offline).
- Reenvio com a mesma `Idempotency-Key` MUST retornar `200` com o recurso já criado, sem duplicar
  nem gerar novo log de auditoria.

## Regras

- `POST /movements` MUST ser rejeitado com `409` se já existir movimentação `TEMPORARIA` em aberto
  para o mesmo preso (FR-010).
- `PATCH /movements/:id/return` em movimentação já retornada MUST responder `409` (edge case).
- Qualquer endpoint `final/*` MUST, na mesma transação: atualizar `presos.status`, fechar o
  registro de `Histórico de Cela` corrente e abrir um novo quando aplicável (FR-016), e liberar a
  cela de origem para nova ocupação, respeitando a capacidade da cela destino (data-model.md).
- Todo endpoint desta seção MUST gerar log de auditoria com valores antigos/novos do status do
  preso.

## Exemplo — POST /api/v1/movements

Request:
```json
{
  "presoId": 101,
  "tipoMovimentacaoId": 4,
  "celaOrigemId": 42,
  "localDestino": "PATIO",
  "motivo": "Banho de sol"
}
```

Response 201:
```json
{ "id": 5501, "presoId": 101, "dataHoraSaida": "2026-08-02T13:05:00Z", "dataHoraRetorno": null }
```

Response 409 (já em aberto):
```json
{ "message": "Preso já possui movimentação em aberto" }
```
