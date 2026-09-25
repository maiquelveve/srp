# Contract: Relatórios e Auditoria (`/api/v1/reports`, `/api/v1/audit`)

Cobre User Story 6 (FR-025…FR-028).

| Método | Rota | Perfis | Descrição |
|---|---|---|---|
| GET | `/api/v1/reports/movements-by-inmate/:inmateId?days=30` | SUPERVISOR, WARDEN | Movimentações de um preso no período (FR-025). |
| GET | `/api/v1/reports/longest-out-of-cell?unitId=&days=30&limit=10` | SUPERVISOR, WARDEN | Presos com maior tempo fora da cela. |
| GET | `/api/v1/reports/inconsistencies?unitId=&thresholdHours=24` | SUPERVISOR, WARDEN | Movimentações sem retorno além do prazo, presos fora da cela sem motivo. `routinesNotExecuted` lista as rotinas que o Supervisor desativou para uma data dos últimos 7 dias (rotinas coletivas não têm registro de execução: sem desativação, conta como executada, FR-025). |
| GET | `/api/v1/reports/routine-execution?unitId=&days=7` | SUPERVISOR, WARDEN | Ocorrências programadas × desativadas por data, por rotina (`executionTracked: false`: não há registro de execução para medir cumprimento/atraso). |
| GET | `/api/v1/reports/staff-vs-movements?date=&unitId=` | SUPERVISOR, WARDEN | Efetivo por turno (diurno 07h–19h, America/Sao_Paulo) versus movimentações realizadas. |
| GET | `/api/v1/reports/cell-occupancy-history?cellId=&from=&to=` | SUPERVISOR, WARDEN | Histórico de ocupação de uma cela/galeria. |
| GET | `/api/v1/audit?table=&recordId=&from=&to=&limit=50&offset=0` | SUPERVISOR, WARDEN | Consulta a trilha de auditoria (FR-026), somente leitura, só de entradas cujo autor pertence às unidades do usuário. |

## Paginação

As listas dos relatórios são paginadas no servidor: `limit` (padrão 25, máximo 100) e `offset` (padrão 0),
com `total` na resposta (`{ data, total }`). Valores fora do intervalo respondem `400`.
`/reports/inconsistencies` tem três listas paginadas de forma independente: `limit`,
`withoutReturnOffset`, `withoutReasonOffset` e `notExecutedOffset`, com `movementsWithoutReturnTotal`,
`inmatesOutWithoutReasonTotal` e `routinesNotExecutedTotal`. `/reports/staff-vs-movements` sempre devolve os dois turnos e não pagina.

## Regras

- Todos os endpoints desta seção MUST responder `403` para `PRISON_OFFICER` (FR-028).
- Todos os relatórios e a auditoria MUST respeitar o escopo de unidade do usuário (FR-004a) — um
  Supervisor/Chefia só vê dados das unidades a que está vinculado.
- `/api/v1/audit` nunca expõe métodos de escrita (imutabilidade, FR-027) — apenas `GET`.
- `oldData`/`newData` retornados por `/api/v1/audit` MUST vir com campos sensíveis já redigidos
  (`"[REDACTED]"`) pelo `AuditService` — nunca em texto claro (research.md #6).

## Exemplo — GET /api/v1/reports/inconsistencies

Response 200:
```json
{
  "movementsWithoutReturn": [
    { "movementId": 5501, "inmateId": 101, "exitDateTime": "2026-08-01T08:00:00Z", "hoursOpen": 29 }
  ],
  "routinesNotExecuted": [
    { "routineId": 12, "routineName": "Pátio", "galleryId": 3, "galleryCode": "A", "date": "2026-08-09" }
  ],
  "routinesNotExecutedTotal": 1
}
```
