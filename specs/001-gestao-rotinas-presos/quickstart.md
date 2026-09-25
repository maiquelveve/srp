# Quickstart: Gestão de Rotinas Penitenciárias (SRP)

Guia para validar, de ponta a ponta, que o sistema atende às User Stories de
[spec.md](./spec.md). Referências de endpoint em [contracts/](./contracts/), modelo de dados em
[data-model.md](./data-model.md).

## Pré-requisitos

- PostgreSQL disponível e schema aplicado via `typeorm migration:run` (`backend/src/database/data-source.ts`).
- Backend (`backend/`) rodando localmente com `.env` configurado (`POSTGRES_HOST/PORT/USER/PASSWORD/DB`, `JWT_SECRET`,
  `JWT_REFRESH_SECRET`).
- Seed mínimo carregado: 1 Unit, 1 Gallery, 2 Cells, 3 Users (um por Role: `PRISON_OFFICER`,
  `SUPERVISOR`, `WARDEN`), 3 MovementTypes (ao menos um `TEMPORARY` e um `PERMANENT`).
- Frontend web (`frontend/`) e/ou cliente HTTP (curl/Insomnia) para exercitar a API.

> **Automação**: os cenários 0 a 6 são executados por `backend/test/quickstart/validate-quickstart.js`
> (cabeçalho do arquivo explica como subir um backend isolado) e o cenário 8 por
> `backend/test/load/shift-change.js` (ver `backend/test/load/README.md`). O cenário 7 e o
> cronômetro do cenário 2 são manuais e ficam por conta do emulador, que roda no **Windows**:
> rode o Expo pelo Windows com `EXPO_PUBLIC_API_BASE_URL` apontando para o backend (no emulador
> Android padrão, `http://10.0.2.2:3000/api/v1`).

## Cenário 0 — Gestão de usuários (FR-030…FR-032)

1. Login como `WARDEN` (`POST /api/v1/auth/login`).
2. `POST /api/v1/users` cadastrando um novo `SUPERVISOR` vinculado à Unit do seed.
   **Esperado**: `201`, resposta nunca inclui `passwordHash` nem senha em texto claro.
3. Repetir o passo 2 autenticado como `SUPERVISOR` ou `PRISON_OFFICER`.
   **Esperado**: `403 Forbidden` (FR-032).
4. `PATCH /api/v1/users/:id/deactivate` no usuário criado no passo 2.
   **Esperado**: `200`; login subsequente desse usuário retorna `401`.
5. Com um access token e um refresh token que o usuário já tinha antes da desativação, chamar
   qualquer rota autenticada e `POST /api/v1/auth/refresh`.
   **Esperado**: `401` nos dois casos, na hora, sem esperar o token expirar (FR-031). Coberto por
   `backend/test/integration/users-deactivation.spec.ts`, porque o script do quickstart não tem
   senha do usuário recém-criado (ele entra pelo fluxo de convite).

## Cenário 1 — Cadastro e Mapa da Unidade (User Story 1)

1. Login como `WARDEN` (`POST /api/v1/auth/login`).
2. Criar uma Gallery (`POST /api/v1/galleries`) e uma Cell (`POST /api/v1/cells`).
3. Criar um Inmate associado à Cell (`POST /api/v1/inmates`).
4. **Esperado**: `GET /api/v1/inmates?cellId=<id>` retorna o preso com `status=ACTIVE`.
5. Repetir o passo 3 autenticado como `PRISON_OFFICER`.
   **Esperado**: `403 Forbidden` (FR-002).

## Cenário 2 — Movimentação temporária e status em tempo real (User Story 2)

1. Login como `PRISON_OFFICER`.
2. `POST /api/v1/movements` para o preso criado no Cenário 1 (categoria temporária, ex.: atendimento médico interno).
   **Esperado**: `201`, e `GET /api/v1/inmates/:id` passa a mostrar o preso como fora da cela
   (`inMovement=true`).
3. Repetir o passo 2 para o mesmo preso sem registrar retorno.
   **Esperado**: `409` (FR-010).
4. `PATCH /api/v1/movements/:id/return`.
   **Esperado**: `200`, e o preso volta a aparecer como "na cela" (`inMovement=false`).
5. Cronometrar os passos 2–4: cada chamada deve completar em poucos segundos, validando a meta de
   SC-001 (registro em até 30s) no fluxo real da interface móvel.

## Cenário 3 — Situação definitiva (User Story 3)

1. Login como `WARDEN`.
2. `POST /api/v1/movements/final/release` para o preso do Cenário 1, com número de alvará.
   **Esperado**: `201`; `inmates.status` muda para `RELEASED`; a cela é liberada.
3. `GET /api/v1/inmates/:id/location-history`.
   **Esperado**: histórico mostra a entrada original na cela e a saída por liberdade (FR-016).
   Em seguida, `GET /api/v1/audit?table=movements&recordId=<id da liberdade>`.
   **Esperado**: um registro `INSERT` da própria movimentação, com o motivo (FR-026, SC-002).
4. Como `WARDEN`, `GET /api/v1/movements/definitive-situations?name=<parte do nome do preso>`.
   **Esperado**: `200` com o preso listado como liberdade; como `SUPERVISOR`, `403`. No painel web, a
   mesma consulta é a tela "Situações definitivas" (menu lateral, só Chefia/Diretor), com período
   (padrão 6 meses, 1 ano, 5 anos, todos), nome, matrícula e paginação.
5. Como `SUPERVISOR`, `POST /api/v1/movements/final/reversal` para o mesmo preso.
   **Esperado**: `403` (FR-016a, só a Chefia reverte).
6. Como `WARDEN`, `POST /api/v1/movements/final/reversal` com `inmateId`, `destinationCellId` (cela
   com vaga) e `reason`.
   **Esperado**: `201`; `inmates.status` volta a `ACTIVE`; `GET /api/v1/movements?inmateId=` lista a
   liberdade original e a reversão; repetir a chamada retorna `409` (preso já ativo). O preso deixa de
   aparecer em `definitive-situations`.

## Cenário 4 — Gestão de rotinas (User Story 4)

1. Login como `WARDEN`; `POST /api/v1/routines` criando uma rotina "Pátio" diária para a Gallery
   do Cenário 1.
2. Login como `SUPERVISOR`; `PATCH /api/v1/routines/:id/activation` desativando a rotina para uma
   data específica (ex.: dia de visita).
   **Esperado**: `GET /api/v1/routines?galleryId=&shift=today` na data desativada não lista a
   rotina; nos demais dias, lista normalmente.
3. Como `SUPERVISOR`, tentar `POST /api/v1/routines` (criar nova rotina).
   **Esperado**: `403` (FR-003/FR-019).
4. Como `WARDEN`, `POST /api/v1/routines` com outra rotina no mesmo horário e na mesma galeria.
   **Esperado**: `409` com `details.code = ROUTINE_SCHEDULE_OVERLAP`; repetir com
   `confirmOverlap: true` retorna `201`. O aviso cobre só o mesmo horário de início (a rotina não
   tem duração).

## Cenário 5 — Controle de efetivo (User Story 5)

1. Login como `WARDEN`; `POST /api/v1/posts` para cadastrar os postos da unidade (ex.: "A/B",
   "Pórtico"; FR-022a, research.md #47), e `PATCH /api/v1/staff/minimum-staffing-config` definindo o
   mínimo de um posto/turno (FR-024, research.md #12). Se necessário, `POST /api/v1/users` com
   `role=PRISON_OFFICER` para cadastrar um novo policial (não há endpoint `/staff` separado —
   policial penal é um `User`, research.md #15).
2. Login como `SUPERVISOR`; `GET /api/v1/posts` e `GET /api/v1/users?role=PRISON_OFFICER` para obter
   postos e roster, então `POST /api/v1/schedules` para um desses policiais com `date`, `workloadHours`
   (obrigatório) e `assignments` (um posto por turno `DAY`/`NIGHT`, ex.: o plantão de 24 h nos dois
   turnos, cada um com seu posto). Escalar depois só o outro turno com carga diferente responde
   `422`.
   **Esperado**: `SUPERVISOR` recebe `403` em `POST`/`PATCH /api/v1/posts`.
3. `GET /api/v1/schedules/minimum-staffing?date=&shift=`.
   **Esperado**: posto aparece com o efetivo no posto; se abaixo do mínimo configurado no passo 1,
   `belowMinimum=true`. Depois de `PATCH /api/v1/schedules/:id/attendance` com `ABSENT`, o policial
   sai de `staffed` e entra em `absent`.

## Cenário 6 — Relatórios e auditoria (User Story 6)

1. Com os dados gerados nos cenários 1–5, login como `SUPERVISOR`.
2. `GET /api/v1/reports/movements-by-inmate/:inmateId?days=30`.
   **Esperado**: lista as movimentações registradas no Cenário 2.
3. `GET /api/v1/audit?table=movements&recordId=<id>`.
   **Esperado**: mostra ao menos um registro `INSERT` com o usuário responsável e os valores
   gravados, confirmando FR-026 (100% das escritas geram auditoria → SC-002).
4. `GET /api/v1/audit?table=users&recordId=<id-do-usuario-do-Cenário-0>`.
   **Esperado**: `oldData`/`newData` mostram `passwordHash` como `"[REDACTED]"`, nunca o hash real
   (research.md #6).
5. Repetir o passo 3 autenticado como `PRISON_OFFICER`.
   **Esperado**: `403` (FR-028).
6. `GET /api/v1/reports/inconsistencies` como `SUPERVISOR`, depois de desativar uma rotina para hoje
   (Cenário 4).
   **Esperado**: `routinesNotExecuted` lista essa rotina com a data de hoje (FR-025); uma rotina que
   não foi desativada não aparece.

## Cenário 7 — Sincronização offline do app móvel (FR-011a)

1. No app mobile, desligar a conectividade (modo avião).
2. Registrar uma movimentação temporária de saída para um preso.
   **Esperado**: a movimentação aparece na tela como "pendente de sincronização", armazenada na
   fila local (`expo-sqlite`).
3. Restabelecer a conectividade.
   **Esperado**: a fila sincroniza automaticamente; `GET /api/v1/movements?inmateId=` no backend
   passa a mostrar o registro, sem duplicatas mesmo se o app tentar reenviar o mesmo item (mesma
   `Idempotency-Key`, ver `contracts/movements.md`).
4. Ainda offline, registrar uma **segunda** saída para o mesmo preso.
   **Esperado**: só a mais recente fica na fila (uma pendência por preso; research.md #52).
5. Com uma pendência que o servidor vai recusar (ex.: preso que já tem saída ativa) e outra de um
   preso diferente na mesma fila, sincronizar (automático ou pelo botão "Sincronizar agora" no
   banner da tela de Presos).
   **Esperado**: a pendência válida sincroniza mesmo com a recusada na fila; a recusada continua
   pendente e não trava as demais.

## Cenário 8 — Carga de troca de turno (SC-004)

1. Rodar o script de load-test (`backend/test/load/shift-change.js`, k6 — research.md #14) contra
   um ambiente com dados do seed, simulando 200 usuários virtuais.
   **Esperado**: p95 de latência < 500ms e nenhum erro 5xx atribuível a carga (SC-004).

## Critérios de aceite do quickstart

- Todos os cenários acima passam sem intervenção manual no banco de dados.
- Nenhuma chamada de escrita nos Cenários 0–6 deixa de aparecer em `GET /api/v1/audit`.
- Nenhum registro de auditoria de `users` expõe `passwordHash`/`tokenHash` em texto claro.
- Nenhum perfil consegue executar uma ação fora do que está descrito em `spec.md` (todas as
  tentativas negativas retornam `403`, nunca `500`).
