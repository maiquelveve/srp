# Contract: Relatórios e Auditoria (`/api/v1/reports`, `/api/v1/audit`)

Cobre User Story 6 (FR-025…FR-028).

| Método | Rota | Perfis | Descrição |
|---|---|---|---|
| GET | `/api/v1/reports/movements-by-inmate/:inmateId?days=30` | SUPERVISOR, CHEFIA_DIRETOR | Movimentações de um preso no período (FR-025). |
| GET | `/api/v1/reports/longest-out-of-cell` | SUPERVISOR, CHEFIA_DIRETOR | Presos com maior tempo fora da cela. |
| GET | `/api/v1/reports/inconsistencies` | SUPERVISOR, CHEFIA_DIRETOR | Movimentações sem retorno, presos fora da cela sem motivo, rotinas não executadas. |
| GET | `/api/v1/reports/routine-execution?unitId=&period=` | SUPERVISOR, CHEFIA_DIRETOR | Cumprimento/atraso/não execução de rotinas por turno/unidade. |
| GET | `/api/v1/reports/staff-vs-movements` | SUPERVISOR, CHEFIA_DIRETOR | Efetivo por turno versus movimentações realizadas. |
| GET | `/api/v1/reports/cell-occupancy-history?cellId=` | SUPERVISOR, CHEFIA_DIRETOR | Histórico de ocupação de uma cela/galeria. |
| GET | `/api/v1/audit?table=&recordId=&from=&to=` | SUPERVISOR, CHEFIA_DIRETOR | Consulta a trilha de auditoria (FR-026), somente leitura. |

## Regras

- Todos os endpoints desta seção MUST responder `403` para `POLICIAL_PENAL` (FR-028).
- Todos os relatórios e a auditoria MUST respeitar o escopo de unidade do usuário (FR-004a) — um
  Supervisor/Chefia só vê dados das unidades a que está vinculado.
- `/api/v1/audit` nunca expõe métodos de escrita (imutabilidade, FR-027) — apenas `GET`.

## Exemplo — GET /api/v1/reports/inconsistencies

Response 200:
```json
{
  "movimentacoesSemRetorno": [
    { "movimentacaoId": 5501, "presoId": 101, "dataHoraSaida": "2026-08-01T08:00:00Z", "horasEmAberto": 29 }
  ],
  "rotinasNaoExecutadas": []
}
```
