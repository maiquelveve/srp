# Contract: Controle de Efetivo (`/api/v1/staff`, `/api/v1/schedules`)

Cobre User Story 5 (FR-021…FR-024).

| Método | Rota | Perfis | Descrição |
|---|---|---|---|
| GET | `/api/v1/staff` | SUPERVISOR, CHEFIA_DIRETOR | Lista policiais penais cadastrados (FR-021). |
| POST | `/api/v1/staff` | CHEFIA_DIRETOR | Cadastra policial penal. |
| GET | `/api/v1/schedules?date=&shift=&sector=` | SUPERVISOR, CHEFIA_DIRETOR | Lista escalas de efetivo filtradas (FR-022). |
| POST | `/api/v1/schedules` | SUPERVISOR, CHEFIA_DIRETOR | Cria escala (policial, turno, data, setor). |
| PATCH | `/api/v1/schedules/:id/attendance` | SUPERVISOR, CHEFIA_DIRETOR | Registra presença/falta/abono/horas extras (FR-023). |
| GET | `/api/v1/schedules/minimum-staffing?date=&shift=` | SUPERVISOR, CHEFIA_DIRETOR | Relatório de efetivo mínimo por turno/setor (FR-024). |

## Regras

- `POST /schedules` MUST responder `409` em violação de unicidade (`usuario`, `data`, `turno`)
  (data-model.md).
- Endpoints desta seção nunca são acessíveis a `POLICIAL_PENAL` (FR-002).
- `GET .../minimum-staffing` retorna, por setor/turno, o total escalado versus o mínimo
  configurado, sinalizando déficit.

## Exemplo — GET /api/v1/schedules/minimum-staffing?date=2026-08-02&shift=NOITE

Response 200:
```json
{
  "data": "2026-08-02",
  "turno": "NOITE",
  "setores": [
    { "setor": "GALERIA_A", "escalados": 2, "minimo": 3, "abaixoDoMinimo": true }
  ]
}
```
