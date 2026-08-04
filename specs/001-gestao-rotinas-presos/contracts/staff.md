# Contract: Controle de Efetivo (`/api/v1/schedules`, `/api/v1/staff`)

Cobre User Story 5 (FR-021…FR-024).

**Cadastro de policiais penais (FR-021)**: não existe endpoint próprio nesta seção — um policial
penal **é** um `User` com `role=PRISON_OFFICER` (research.md #15). Cadastro é feito via
`POST /api/v1/users` e o roster é obtido via `GET /api/v1/users?role=PRISON_OFFICER` (ambos em
`contracts/structure.md`), incluindo o campo `jobTitle` (cargo).

| Método | Rota | Perfis | Descrição |
|---|---|---|---|
| GET | `/api/v1/schedules?date=&shift=&sector=` | SUPERVISOR, WARDEN | Lista escalas de efetivo filtradas (FR-022). |
| POST | `/api/v1/schedules` | SUPERVISOR, WARDEN | Cria escala (policial, turno, data, setor). |
| PATCH | `/api/v1/schedules/:id/attendance` | SUPERVISOR, WARDEN | Registra presença/falta/abono/horas extras (FR-023). |
| GET | `/api/v1/schedules/minimum-staffing?date=&shift=` | SUPERVISOR, WARDEN | Relatório de efetivo mínimo por turno/setor (FR-024). |
| PATCH | `/api/v1/staff/minimum-staffing-config` | WARDEN | Define o valor mínimo de efetivo por unidade/setor/turno (FR-024, research.md #12). |

## Regras

- `POST /schedules` MUST responder `409` em violação de unicidade (`user`, `date`, `shift`)
  (data-model.md).
- Endpoints desta seção nunca são acessíveis a `PRISON_OFFICER` (FR-002).
- `PATCH /staff/minimum-staffing-config` MUST responder `403` para qualquer perfil diferente de
  `WARDEN`.
- `GET .../minimum-staffing` retorna, por setor/turno, o total escalado versus o mínimo
  configurado em `minimum_staffing_config`, sinalizando déficit.

## Exemplo — PATCH /api/v1/staff/minimum-staffing-config

Request:
```json
{ "unitId": 1, "sector": "GALLERY_A", "shift": "NIGHT", "minimumHeadcount": 3 }
```

Response 200:
```json
{ "unitId": 1, "sector": "GALLERY_A", "shift": "NIGHT", "minimumHeadcount": 3 }
```

## Exemplo — GET /api/v1/schedules/minimum-staffing?date=2026-08-02&shift=NIGHT

Response 200:
```json
{
  "date": "2026-08-02",
  "shift": "NIGHT",
  "sectors": [
    { "sector": "GALLERY_A", "staffed": 2, "minimum": 3, "belowMinimum": true }
  ]
}
```
