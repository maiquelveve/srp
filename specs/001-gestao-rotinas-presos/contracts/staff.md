# Contract: Controle de Efetivo (`/api/v1/posts`, `/api/v1/schedules`, `/api/v1/staff`)

Cobre User Story 5 (FR-021…FR-024, FR-022a, FR-022b).

**Cadastro de policiais penais (FR-021)**: não existe endpoint próprio nesta seção — um policial
penal **é** um `User` com `role=PRISON_OFFICER` (research.md #15). Cadastro é feito via
`POST /api/v1/users` e o roster é obtido via `GET /api/v1/users?role=PRISON_OFFICER` (ambos em
`contracts/structure.md`), incluindo o campo `jobTitle` (cargo).

**Turnos (FR-022)**: só existem dois, `DAY` (diurno) e `NIGHT` (noturno).

**Postos de serviço (FR-022a)**: o "posto" é onde o policial fica num turno. Nem todo posto é uma
galeria (pórtico, garita, Infopen) e um posto pode cobrir mais de uma galeria (ex.: "A/B"), por
isso é uma entidade própria (`posts`), cadastrada pela Chefia/Diretor (research.md #47).

| Método | Rota | Perfis | Descrição |
|---|---|---|---|
| GET | `/api/v1/posts?unitId=&includeInactive=` | SUPERVISOR, WARDEN | Lista os postos da unidade (só ativos por padrão). |
| POST | `/api/v1/posts` | WARDEN | Cria posto (`unitId`, `name`). |
| PATCH | `/api/v1/posts/:id` | WARDEN | Renomeia e/ou ativa/desativa (`name`, `active`). |
| GET | `/api/v1/schedules?date=&shift=&postId=&unitId=` | SUPERVISOR, WARDEN | Lista escalas de efetivo filtradas (FR-022). |
| POST | `/api/v1/schedules` | SUPERVISOR, WARDEN | Registra o dia de um policial numa única escala: carga horária do dia + posto de cada turno (FR-022). |
| PATCH | `/api/v1/schedules/:id/attendance` | SUPERVISOR, WARDEN | Registra presença/falta (FR-023); vale para todas as escalas do policial na data (FR-023). |
| GET | `/api/v1/schedules/minimum-staffing?date=&shift=&unitId=` | SUPERVISOR, WARDEN | Relatório de efetivo mínimo por turno/posto (FR-024). |
| PATCH | `/api/v1/staff/minimum-staffing-config` | WARDEN | Define o valor mínimo de efetivo por posto/turno (FR-024, research.md #12). |

## Regras

- **Postos**: só `WARDEN` cria, renomeia e desativa (`403` para `SUPERVISOR`/`PRISON_OFFICER`);
  `SUPERVISOR` apenas consulta para escalar policiais. Nome único por unidade (`409`).
  Desativar não apaga nada: o posto deixa de aceitar novas escalas e o mínimo dele deixa de
  contar no relatório, mas as escalas já cadastradas são mantidas.
- `POST /schedules` cria uma escala por item de `assignments` (1 ou 2, um por turno, sem repetir
  turno), **tudo ou nada**: se qualquer item for inválido, nada é criado. `409` se qualquer turno
  pedido já estiver escalado para o policial na data (unicidade `user`, `date`, `shift`);
  `400` se o posto for inativo ou de outra unidade, se o turno se repetir, ou se o usuário não
  for um policial penal ativo da unidade. A resposta é `{ data, total }` com as escalas criadas.
- **Carga horária (FR-022b)**: `workloadHours` é obrigatório (inteiro de 1 a 24) e é a carga do
  **dia** do policial, não do turno. Todas as escalas do mesmo policial na mesma data MUST ter o
  mesmo valor; senão `422`. O posto pode mudar de um turno para o outro. Um turno que ficou de fora
  pode ser escalado depois, numa nova chamada, desde que com a mesma carga horária.
- Endpoints desta seção nunca são acessíveis a `PRISON_OFFICER` (FR-002).
- `PATCH /staff/minimum-staffing-config` MUST responder `403` para qualquer perfil diferente de
  `WARDEN`.
- `GET .../minimum-staffing` retorna, por posto, o efetivo **no posto** versus o mínimo configurado
  em `minimum_staffing_config`, sinalizando déficit. **A falta desconta do efetivo** (não há
  ninguém no posto): escalados com `attendanceStatus` `ABSENT` saem de `staffed` e
  entram em `absent`; presença ainda não registrada conta como escalado. Posto ativo com mínimo
  mas sem ninguém escalado aparece com `staffed: 0`.

## Exemplo — POST /api/v1/posts

Request:
```json
{ "unitId": 1, "name": "A/B" }
```

Response 201:
```json
{ "id": 4, "unitId": 1, "name": "A/B", "active": true }
```

## Exemplo — POST /api/v1/schedules

Um plantão de 24 h de um policial, com o posto mudando de turno, numa única chamada:

Request:
```json
{
  "userId": 12, "unitId": 1, "date": "2026-09-23", "workloadHours": 24,
  "assignments": [
    { "shift": "DAY", "postId": 4 },
    { "shift": "NIGHT", "postId": 7 }
  ]
}
```

Response 201:
```json
{
  "data": [
    {
      "id": 30, "userId": 12, "userName": "Maiquel Leite", "unitId": 1,
      "postId": 4, "postName": "A/B", "date": "2026-09-23", "shift": "DAY", "workloadHours": 24,
      "attendanceStatus": null, "absenceReason": null
    },
    {
      "id": 31, "userId": 12, "userName": "Maiquel Leite", "unitId": 1,
      "postId": 7, "postName": "Pórtico", "date": "2026-09-23", "shift": "NIGHT", "workloadHours": 24,
      "attendanceStatus": null, "absenceReason": null
    }
  ],
  "total": 2
}
```

## Exemplo — PATCH /api/v1/staff/minimum-staffing-config

Request:
```json
{ "postId": 4, "shift": "NIGHT", "minimumHeadcount": 3 }
```

Response 200:
```json
{ "postId": 4, "shift": "NIGHT", "minimumHeadcount": 3 }
```

## Exemplo — GET /api/v1/schedules/minimum-staffing?date=2026-08-02&shift=NIGHT

Response 200:
```json
{
  "date": "2026-08-02",
  "shift": "NIGHT",
  "posts": [
    { "postId": 4, "postName": "A/B", "staffed": 1, "absent": 1, "minimum": 3, "belowMinimum": true }
  ]
}
```
