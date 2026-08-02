# Quickstart: Gestão de Rotinas Penitenciárias (SRP)

Guia para validar, de ponta a ponta, que o sistema atende às User Stories de
[spec.md](./spec.md). Referências de endpoint em [contracts/](./contracts/), modelo de dados em
[data-model.md](./data-model.md).

## Pré-requisitos

- PostgreSQL disponível e schema aplicado via `prisma migrate deploy` (`backend/prisma/schema.prisma`).
- Backend (`backend/`) rodando localmente com `.env` configurado (`DATABASE_URL`, `JWT_SECRET`,
  `JWT_REFRESH_SECRET`).
- Seed mínimo carregado: 1 Unidade, 1 Galeria, 2 Celas, 3 Usuários (um por Perfil), 3 Tipos de
  Movimentação (ao menos um `TEMPORARIA` e um `DEFINITIVA`).
- Frontend web (`frontend/`) e/ou cliente HTTP (curl/Insomnia) para exercitar a API.

## Cenário 1 — Cadastro e Mapa da Unidade (User Story 1)

1. Login como `CHEFIA_DIRETOR` (`POST /api/v1/auth/login`).
2. Criar uma Galeria (`POST /api/v1/galleries`) e uma Cela (`POST /api/v1/cells`).
3. Criar um Preso associado à Cela (`POST /api/v1/inmates`).
4. **Esperado**: `GET /api/v1/inmates?cellId=<id>` retorna o preso com `status=ATIVO`.
5. Repetir o passo 3 autenticado como `POLICIAL_PENAL`.
   **Esperado**: `403 Forbidden` (FR-002).

## Cenário 2 — Movimentação temporária e status em tempo real (User Story 2)

1. Login como `POLICIAL_PENAL`.
2. `POST /api/v1/movements` para o preso criado no Cenário 1 (categoria temporária, ex.: pátio).
   **Esperado**: `201`, e `GET /api/v1/inmates/:id` passa a mostrar o preso como fora da cela.
3. Repetir o passo 2 para o mesmo preso sem registrar retorno.
   **Esperado**: `409` (FR-010).
4. `PATCH /api/v1/movements/:id/return`.
   **Esperado**: `200`, e o preso volta a aparecer como "na cela".
5. Cronometrar os passos 2–4: cada chamada deve completar em poucos segundos, validando a meta de
   SC-001 (registro em até 30s) no fluxo real da interface móvel.

## Cenário 3 — Situação definitiva (User Story 3)

1. Login como `CHEFIA_DIRETOR`.
2. `POST /api/v1/movements/final/release` para o preso do Cenário 1, com número de alvará.
   **Esperado**: `201`; `presos.status` muda para `LIBERDADE`; a cela é liberada.
3. `GET /api/v1/inmates/:id/location-history`.
   **Esperado**: histórico mostra a entrada original na cela e a saída por liberdade (FR-016).

## Cenário 4 — Gestão de rotinas (User Story 4)

1. Login como `CHEFIA_DIRETOR`; `POST /api/v1/routines` criando uma rotina "Pátio" diária para a
   Galeria do Cenário 1.
2. Login como `SUPERVISOR`; `PATCH /api/v1/routines/:id/activation` desativando a rotina para uma
   data específica (ex.: dia de visita).
   **Esperado**: `GET /api/v1/routines?galleryId=&shift=today` na data desativada não lista a
   rotina; nos demais dias, lista normalmente.
3. Como `SUPERVISOR`, tentar `POST /api/v1/routines` (criar nova rotina).
   **Esperado**: `403` (FR-003/FR-019).

## Cenário 5 — Controle de efetivo (User Story 5)

1. Login como `SUPERVISOR`; `POST /api/v1/staff` (se necessário) e `POST /api/v1/schedules` para
   um policial em um turno/data/setor.
2. `GET /api/v1/schedules/minimum-staffing?date=&shift=`.
   **Esperado**: setor aparece com o total escalado; se abaixo do mínimo configurado,
   `abaixoDoMinimo=true`.

## Cenário 6 — Relatórios e auditoria (User Story 6)

1. Com os dados gerados nos cenários 1–5, login como `SUPERVISOR`.
2. `GET /api/v1/reports/movements-by-inmate/:inmateId?days=30`.
   **Esperado**: lista as movimentações registradas no Cenário 2.
3. `GET /api/v1/audit?table=movimentacoes&recordId=<id>`.
   **Esperado**: mostra ao menos um registro `INSERT` com o usuário responsável e os valores
   gravados, confirmando FR-026 (100% das escritas geram auditoria → SC-002).
4. Repetir o passo 3 autenticado como `POLICIAL_PENAL`.
   **Esperado**: `403` (FR-028).

## Cenário 7 — Sincronização offline do app móvel (FR-011a)

1. No app mobile, desligar a conectividade (modo avião).
2. Registrar uma movimentação temporária de saída para um preso.
   **Esperado**: a movimentação aparece na tela como "pendente de sincronização", armazenada na
   fila local (`expo-sqlite`).
3. Restabelecer a conectividade.
   **Esperado**: a fila sincroniza automaticamente; `GET /api/v1/movements?inmateId=` no backend
   passa a mostrar o registro, sem duplicatas mesmo se o app tentar reenviar o mesmo item (mesma
   `Idempotency-Key`, ver `contracts/movements.md`).

## Critérios de aceite do quickstart

- Todos os cenários acima passam sem intervenção manual no banco de dados.
- Nenhuma chamada de escrita nos Cenários 1–6 deixa de aparecer em `GET /api/v1/audit`.
- Nenhum perfil consegue executar uma ação fora do que está descrito em `spec.md` (todas as
  tentativas negativas retornam `403`, nunca `500`).
