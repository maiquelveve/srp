# Contract: Movimentações e Situações Definitivas (`/api/v1/movements`)

Cobre User Story 2 (FR-008…FR-011a) e User Story 3 (FR-012…FR-016c).

> **Nota (research.md #35)**: os endpoints `final/*` de troca de cela desta versão anterior do
> contrato (`POST /movements/final/cell-change`) foram **substituídos** pelos quatro endpoints de
> troca/permuta abaixo — não fazem mais parte do namespace `final/*`, pois não são situação
> terminal de custódia (o preso continua `ACTIVE`).

| Método | Rota | Perfis | Descrição |
|---|---|---|---|
| GET | `/api/v1/movement-types` | qualquer autenticado | Lista tipos de movimentação (referência, seedados) — não estava nesta tabela originalmente, adicionado para alimentar o seletor de tipo dos formulários web/mobile. |
| GET | `/api/v1/movements?inmateId=&open=true` | qualquer autenticado | Lista movimentações; `open=true` filtra as sem retorno registrado. |
| POST | `/api/v1/movements` | PRISON_OFFICER, SUPERVISOR, WARDEN | Registra saída de movimentação temporária (FR-008). |
| PATCH | `/api/v1/movements/:id` | PRISON_OFFICER, SUPERVISOR, WARDEN | Corrige tipo/destino/motivo/observações de uma movimentação `TEMPORARY` ainda em aberto — não estava nesta tabela originalmente, adicionado a pedido do usuário (corrigir erro de digitação sem precisar reverter/recriar). |
| PATCH | `/api/v1/movements/:id/return` | PRISON_OFFICER, SUPERVISOR, WARDEN | Registra retorno de uma movimentação temporária (FR-009). |
| POST | `/api/v1/movements/final/release` | WARDEN | Registra liberdade (FR-012). |
| POST | `/api/v1/movements/final/ankle-monitor` | WARDEN | Registra tornozeleira eletrônica (FR-013). |
| POST | `/api/v1/movements/final/transfer` | WARDEN | Registra transferência (FR-014). |
| POST | `/api/v1/movements/cell-change` | PRISON_OFFICER, SUPERVISOR, WARDEN | Registra troca de cela — mesma galeria, exige vaga (FR-015). |
| POST | `/api/v1/movements/cell-swap` | PRISON_OFFICER, SUPERVISOR, WARDEN | Registra permuta de cela — mesma galeria, dois presos, sem exigir vaga (FR-015a). |
| POST | `/api/v1/movements/gallery-change` | SUPERVISOR, WARDEN | Registra troca de galeria — galerias diferentes, exige vaga (FR-015b). |
| POST | `/api/v1/movements/gallery-swap` | SUPERVISOR, WARDEN | Registra permuta de galeria — galerias diferentes, dois presos, sem exigir vaga (FR-015c). |
| GET | `/api/v1/cells/:id/occupant` | qualquer autenticado | Retorna o preso que ocupa atualmente a cela (ou `null`) — usado pela tela de permuta para exibir o preso do destino escolhido antes da confirmação (FR-015a/FR-015c). Não estava nesta tabela originalmente. |
| GET | `/api/v1/inmates/:id/location-history` | qualquer autenticado | Linha do tempo de localização do preso (FR-016). |

## Idempotência (offline, FR-011a)

- `POST /api/v1/movements` e `PATCH /api/v1/movements/:id/return` aceitam um header
  `Idempotency-Key` (UUID gerado pelo app móvel ao criar o registro offline), persistido em
  `movements.idempotency_key`.
- Reenvio com a mesma `Idempotency-Key` MUST retornar `200` com o recurso já criado, sem duplicar
  nem gerar novo log de auditoria.
- `POST /movements/cell-change` e `/cell-swap` (as duas variações também disponíveis offline no
  app móvel, FR-015/FR-015a) aceitam o mesmo header `Idempotency-Key`, mesma semântica.

## Regras

- `POST /movements` MUST ser rejeitado com `409` se já existir movimentação `TEMPORARY` em aberto
  para o mesmo preso (FR-010).
- **`reason` é obrigatório em TODO endpoint de criação desta seção**, sem exceção — motivo da
  movimentação, texto livre; `notes` é sempre opcional (FR-008a, research.md #35). Nenhum
  endpoint aceita campo estruturado além desses dois (nem alvará, nem dispositivo, nem escolta,
  nem unidade de destino) — informação específica de um tipo entra como texto livre dentro de
  `reason`/`notes`.
- Atividades coletivas aplicadas a uma galeria inteira (pátio, corre, faxina) NUNCA são
  Movimentação — não têm `MovementType` correspondente. São sempre Rotina (US4,
  `contracts/routines.md`), que não referencia nenhum preso individualmente (research.md #26).
- `PATCH /movements/:id` MUST responder `409` se a movimentação já tiver `returnDateTime`
  preenchido — uma vez retornada, a linha é histórico fechado, sem edição. Aceita os mesmos
  campos de `POST /movements` (exceto `inmateId`/`originCellId`, que nunca mudam depois de
  criada), todos opcionais (PATCH parcial); `movementTypeId`, se enviado, segue a mesma regra de
  `POST` (só `TEMPORARY`).
- `PATCH /movements/:id/return` em movimentação já retornada MUST responder `409` (edge case) —
  exceto quando o `Idempotency-Key` enviado é o mesmo já gravado nessa movimentação (retorno já
  processado, replay do mesmo request offline), caso em que responde `200` com o estado atual
  (mesma semântica de idempotência aplicada ao `POST`, ver seção acima; `movements.return_idempotency_key`
  é uma coluna própria, distinta de `idempotencyKey`, já que a chave de saída já identifica a linha).
- `POST /movements/final/release`, `/ankle-monitor` e `/transfer` MUST, na mesma transação:
  atualizar `inmates.status`, fechar o registro de `CellHistory` corrente (FR-016).
- `POST /movements/cell-change` e `/gallery-change` MUST, na mesma transação: atualizar
  `inmates.current_cell_id`, fechar e reabrir o registro de `CellHistory` (FR-016), e MUST ser
  rejeitados com `400` se a cela de destino já estiver na capacidade máxima (data-model.md `Cell`).
  `inmates.status` **não muda** (permanece `ACTIVE`).
- `POST /movements/cell-swap` e `/gallery-swap` MUST, na mesma transação: trocar `current_cell_id`
  dos dois presos envolvidos, gerar dois registros de `Movement` vinculados por `pairedMovement`
  (data-model.md), fechar/reabrir dois registros de `CellHistory` (um por preso). Nunca checam
  capacidade (a troca é direta). Requisição informa `inmateId` + `destinationCellId` (a cela
  atualmente ocupada pelo segundo preso); o cliente MUST ter consultado
  `GET /cells/:id/occupant` antes, para exibir o segundo preso e obter confirmação do usuário —
  o backend MUST responder `409` se, no momento do POST, a cela de destino não estiver mais
  ocupada por um preso `ACTIVE` (edge case de condição de corrida, ver spec.md Edge Cases).
- `/gallery-change` e `/gallery-swap` MUST responder `403` para `PRISON_OFFICER` (RBAC —
  data-model.md, FR-015b/FR-015c).
- Todo endpoint de criação desta seção MUST gerar log de auditoria com valores antigos/novos do
  status e/ou da cela atual do preso (conforme o tipo).

## Exemplo — POST /api/v1/movements

Request:
```json
{
  "inmateId": 101,
  "movementTypeId": 4,
  "originCellId": 42,
  "destinationLocation": "Enfermaria",
  "reason": "Consulta odontológica"
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

## Exemplo — POST /api/v1/movements/cell-swap

Request (`inmateId` é o preso A; `destinationCellId` é a cela atualmente ocupada pelo preso B,
já confirmada via `GET /cells/:id/occupant`):
```json
{
  "inmateId": 101,
  "destinationCellId": 55,
  "reason": "Reorganização a pedido da galeria"
}
```

Response 201 (um por preso, dois registros criados na mesma transação):
```json
[
  { "id": 5601, "inmateId": 101, "destinationCellId": 55, "pairedMovementId": 5602 },
  { "id": 5602, "inmateId": 208, "destinationCellId": 42, "pairedMovementId": 5601 }
]
```

Response 409 (cela de destino não está mais ocupada por um preso ativo):
```json
{ "message": "A cela de destino não está mais ocupada — escolha novamente" }
```
