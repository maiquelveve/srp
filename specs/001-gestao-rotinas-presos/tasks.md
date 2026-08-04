---

description: "Task list template for feature implementation"
---

# Tasks: Gestão de Rotinas Penitenciárias (SRP)

**Input**: Design documents from `/specs/001-gestao-rotinas-presos/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Test tasks are included (backend unit + integration per `plan.md` Technical Context — Constitution VIII requires critical functionality to have automated tests).

**Organization**: Tasks are grouped by user story (spec.md P1–P6) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US6)
- Exact file paths are included in every description

## Path Conventions

Per `plan.md` Project Structure — three apps sharing one backend/API:

- `backend/src/`, `backend/src/database/`, `backend/test/`
- `frontend/src/`, `frontend/tests/`
- `mobile/src/`, `mobile/tests/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create monorepo structure (`backend/`, `frontend/`, `mobile/`) per `plan.md` Project Structure
- [ ] T002 [P] Initialize `backend/` NestJS + TypeScript (strict) project with module folders: `src/auth`, `src/users`, `src/roles`, `src/units`, `src/galleries`, `src/cells`, `src/inmates`, `src/movements`, `src/routines`, `src/staff`, `src/reports`, `src/audit`, `src/common`, `src/config`
- [ ] T003 [P] Initialize `frontend/` React + Vite + TypeScript project with TailwindCSS, shadcn/ui, TanStack Query, React Hook Form, Zod
- [ ] T004 [P] Initialize `mobile/` React Native + Expo + TypeScript project
- [ ] T005 [P] Configure ESLint + Prettier + Husky + lint-staged for `backend/`, `frontend/`, `mobile/` (Constitution IX — no `any`, no `@ts-ignore`)
- [ ] T006 [P] Create `.env.example` files for `backend/`, `frontend/`, `mobile/` (DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, API base URL)
- [ ] T007 [P] Configure `docker-compose.yml` at repo root for local PostgreSQL
- [ ] T008 Configure TypeORM in `backend/` (`@nestjs/typeorm` + `pg`, `backend/src/database/data-source.ts`, wire `DATABASE_URL`, `synchronize: false`)
- [ ] T009 [P] Configure Swagger/OpenAPI bootstrap under `/api/v1` prefix in `backend/src/main.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T010 Define all TypeORM entities across their owning modules (`<module>/entities/*.entity.ts`) mirroring `docs/srp_spec_database_model.md` (all identifiers in English per Constitution XI) — `Role`, `User`, `UserUnit` (join entity for FR-004a), `RefreshToken` (FR-030…FR-032 auth revocation, research.md #11), `Unit`, `Gallery`, `Cell`, `Inmate`, `InmateCellHistory`, `MovementType`, `Movement`, `Routine`, `RoutineSchedule`, `StaffSchedule`, `MinimumStaffingConfig` (FR-024, research.md #12), `AuditLog`; register all entities on the `DataSource` in `backend/src/database/data-source.ts` (depends on T008)
- [ ] T011 Generate and run the initial TypeORM migration (`typeorm migration:generate` + `migration:run`) in `backend/src/database/migrations/` (depends on T010)
- [ ] T012 [P] Create TypeORM seed script `backend/src/database/seeds/seed.ts` with the 3 roles and one sample user per role, unit, gallery and cell (depends on T011)
- [ ] T013 [P] Implement global `ValidationPipe` + shared DTO base conventions in `backend/src/common/pipes/`
- [ ] T014 [P] Implement global exception filter (consistent error shape) in `backend/src/common/filters/`
- [ ] T015 [P] Implement request logging middleware in `backend/src/common/logging/`
- [ ] T016 Implement `AuditService` + global `AuditInterceptor` writing to `audit_logs` on every state-changing request in `backend/src/audit/`, including a `REDACTED_FIELDS` redaction step (`passwordHash`, `tokenHash`, `@Sensitive()`-marked fields) applied to `oldData`/`newData` before persisting — Constitution II, research.md #6, `/speckit-analyze` finding C1 (depends on T011)
- [ ] T017 [P] Implement Argon2 password hashing utility in `backend/src/auth/hashing/` (depends on T011)
- [ ] T018 Implement JWT access + refresh token strategy in `backend/src/auth/`, persisting refresh tokens as SHA-256 hash in `refresh_tokens` (`userId`, `tokenHash`, `expiresAt`, `revokedAt`) with rotation on `/auth/refresh` — research.md #11, `/speckit-analyze` finding G3 (depends on T017)
- [ ] T019 Implement RBAC + unit-scope guards reading `role` and `units` claims in `backend/src/auth/guards/` (research.md #5; depends on T018)
- [ ] T020 Implement `POST /api/v1/auth/login`, `/refresh`, `/logout` per `contracts/auth.md` in `backend/src/auth/`, rejecting unknown/expired/revoked refresh tokens against `refresh_tokens` and revoking on logout (depends on T018, T016)
- [ ] T020a [P] Implement Users module — `POST /api/v1/users`, `GET /api/v1/users`, `PATCH /api/v1/users/:id/deactivate` per `contracts/structure.md`, restricted to `WARDEN` only — in `backend/src/users/` (FR-030…FR-032, `/speckit-analyze` finding G1; depends on T016, T018, T019)
- [ ] T020b [P] Implement `POST /api/v1/auth/set-initial-password` per `contracts/auth.md` — out-of-band initial-password flow for users created via `POST /api/v1/users` (single-use, short-expiry invite token; password never returned in plaintext by the API) — research.md #10 — in `backend/src/auth/` (depends on T020a)
- [ ] T021 [P] Apply Helmet, CORS allow-list, and `@nestjs/throttler` rate limiting on `/auth/login` in `backend/src/main.ts` (depends on T020)
- [ ] T022 [P] Implement `GET /api/v1/health` health check endpoint in `backend/src/common/health/`
- [ ] T023 [P] Configure `frontend/` API client with token storage/refresh handling in `frontend/src/services/api-client.ts` (depends on T020)
- [ ] T024 [P] Configure `mobile/` API client with token storage/refresh handling in `mobile/src/services/api-client.ts` (depends on T020)
- [ ] T025 [P] Scaffold mobile offline queue infrastructure (SQLite via `expo-sqlite`, idempotency-key generation) in `mobile/src/offline/` (research.md #4)

**Checkpoint**: Foundation ready — user story implementation can now begin (includes user provisioning via T020a/T020b, so subsequent stories are no longer limited to seeded accounts)

---

## Phase 3: User Story 1 - Cadastro e Mapa da Unidade (Priority: P1) 🎯 MVP

**Goal**: Chefia/Diretor e Supervisor cadastram unidades, galerias, celas e presos; policiais e supervisores consultam o mapa da unidade.

**Independent Test**: Cadastrar uma unidade, galeria, cela e preso via API e confirmar que o preso aparece corretamente associado no mapa da unidade (`GET /api/v1/inmates?cellId=`).

### Tests for User Story 1

- [ ] T026 [P] [US1] Backend integration tests for `contracts/structure.md` endpoints (incl. 403 for `PRISON_OFFICER` writes, unit-scope filtering) in `backend/test/integration/structure.spec.ts`
- [ ] T027 [P] [US1] Backend unit tests for Cells capacity validation in `backend/test/unit/cells.service.spec.ts`

### Implementation for User Story 1

- [ ] T028 [P] [US1] Implement Units module (Controller/Service/Repository/DTOs) in `backend/src/units/`
- [ ] T029 [P] [US1] Implement Galleries module in `backend/src/galleries/`
- [ ] T030 [US1] Implement Cells module with capacity validation in `backend/src/cells/` (depends on T029)
- [ ] T031 [US1] Implement Inmates module — create/update/get/list scoped by cela/galeria/unidade in `backend/src/inmates/` (depends on T030)
- [ ] T032 [US1] Apply RBAC (WARDEN-only writes) + unit-scope guard to Units/Galleries/Cells/Inmates endpoints (depends on T019, T028–T031)
- [ ] T033 [P] [US1] Build web frontend Units/Galleries/Cells/Inmates management screens in `frontend/src/features/structure/` (depends on T023, T031)
- [ ] T034 [P] [US1] Build mobile read-only "consultar presos por cela/galeria" screen in `mobile/src/screens/InmatesLookup.tsx` (depends on T024, T031)

**Checkpoint**: User Story 1 fully functional and independently testable

---

## Phase 4: User Story 2 - Registro de Movimentações Temporárias e Status em Tempo Real (Priority: P2)

**Goal**: Policiais penais registram saída/retorno de presos; status em tempo real filtrável por unidade/galeria/cela.

**Independent Test**: Registrar saída de um preso já cadastrado e, em seguida, seu retorno, verificando o status em cada etapa via `GET /api/v1/inmates/:id`.

### Tests for User Story 2

- [ ] T035 [P] [US2] Backend unit tests for open-movement conflict (FR-010) and duplicate-return rejection (FR-009) in `backend/test/unit/movements.service.spec.ts`
- [ ] T036 [P] [US2] Backend integration tests for `contracts/movements.md` temporary-movement flow + `Idempotency-Key` handling in `backend/test/integration/movements-temporary.spec.ts`

### Implementation for User Story 2

- [ ] T037 [P] [US2] Seed/reference-data access for Movement Types in `backend/src/movements/movement-types.service.ts` (depends on T011)
- [ ] T038 [US2] Implement `POST /api/v1/movements` with open-movement conflict check in `backend/src/movements/` (depends on T031, T037)
- [ ] T039 [US2] Implement `PATCH /api/v1/movements/:id/return` with duplicate-return rejection in `backend/src/movements/` (depends on T038)
- [ ] T040 [US2] Implement `Idempotency-Key` handling for offline-submitted movements in `backend/src/movements/` (depends on T038, T039)
- [ ] T041 [US2] Extend Inmates status projection (FR-011, data-model.md `inmates.status`) updated transactionally on movement create/return in `backend/src/inmates/` (depends on T038, T039)
- [ ] T042 [US2] Implement real-time status listing/filtering by unit/gallery/cell in `backend/src/inmates/inmates.controller.ts` (depends on T041)
- [ ] T043 [P] [US2] Build mobile "registrar movimentação" + status screens using the offline queue in `mobile/src/screens/MovementRegister.tsx` (depends on T025, T040)
- [ ] T044 [P] [US2] Build web frontend real-time status/map view in `frontend/src/features/movements/StatusMap.tsx` (depends on T042)
- [ ] T045 [US2] Mobile offline-sync integration test (airplane mode → reconnect, no duplicates) per `quickstart.md` Cenário 7 in `mobile/tests/offline-sync.spec.ts` (depends on T043)

**Checkpoint**: User Stories 1 AND 2 both work independently

---

## Phase 5: User Story 3 - Situações Definitivas (Priority: P3)

**Goal**: Registrar liberdade, tornozeleira, transferência e troca de cela definitiva, atualizando status e histórico de localização.

**Independent Test**: Registrar liberdade de um preso ativo (com alvará) e confirmar que o status muda e a cela é liberada.

### Tests for User Story 3

- [ ] T046 [P] [US3] Backend integration tests for `contracts/movements.md` situações definitivas + `location-history` (incl. cell-capacity edge case) in `backend/test/integration/movements-final.spec.ts`

### Implementation for User Story 3

- [ ] T047 [US3] Implement Cell History open/close tracking on cell change in `backend/src/inmates/cell-history.service.ts` (depends on T031)
- [ ] T048 [US3] Implement `POST /api/v1/movements/final/release` in `backend/src/movements/` (depends on T047)
- [ ] T049 [P] [US3] Implement `POST /api/v1/movements/final/ankle-monitor` in `backend/src/movements/` (depends on T047)
- [ ] T050 [P] [US3] Implement `POST /api/v1/movements/final/transfer` in `backend/src/movements/` (depends on T047)
- [ ] T051 [US3] Implement `POST /api/v1/movements/final/cell-change` with cell-capacity check in `backend/src/movements/` (depends on T047, T030)
- [ ] T052 [US3] Implement `GET /api/v1/inmates/:id/location-history` in `backend/src/inmates/` (depends on T047)
- [ ] T053 [P] [US3] Build web frontend "registrar situação definitiva" screens in `frontend/src/features/movements/FinalSituations.tsx` (depends on T048–T051)

**Checkpoint**: User Stories 1–3 all work independently

---

## Phase 6: User Story 4 - Gestão de Rotinas Operacionais (Priority: P4)

**Goal**: Chefia cria rotinas e define padrões; Supervisor ajusta horários e ativação por dia.

**Independent Test**: Criar uma rotina "Pátio" com horário fixo para uma galeria e confirmar que aparece na programação do turno; desativá-la para um dia específico e confirmar que some apenas nesse dia.

### Tests for User Story 4

- [ ] T054 [P] [US4] Backend integration tests for `contracts/routines.md` (incl. 403 on `locked` routine edited by Supervisor) in `backend/test/integration/routines.spec.ts`

### Implementation for User Story 4

- [ ] T055 [P] [US4] Implement Routines module (Controller/Service/Repository/DTOs) in `backend/src/routines/`
- [ ] T056 [US4] Implement Rotina Horários sub-resource (multiple schedules per day/routine) in `backend/src/routines/` (depends on T055)
- [ ] T057 [US4] Implement `POST /api/v1/routines` (WARDEN only, `locked` flag) in `backend/src/routines/` (depends on T056)
- [ ] T058 [US4] Implement `PATCH /routines/:id/schedule` and `/activation` with blocked-routine guard in `backend/src/routines/` (depends on T057)
- [ ] T059 [US4] Implement `GET /api/v1/routines` with shift/gallery filter in `backend/src/routines/` (depends on T056)
- [ ] T060 [P] [US4] Build web frontend Rotinas management screens in `frontend/src/features/routines/` (depends on T057, T058)
- [ ] T061 [P] [US4] Build mobile "rotinas do turno" read-only screen in `mobile/src/screens/ShiftRoutines.tsx` (depends on T059)

**Checkpoint**: User Stories 1–4 all work independently

---

## Phase 7: User Story 5 - Controle de Efetivo (Priority: P5)

**Goal**: Supervisor cadastra escalas de serviço, registra presença/faltas/abonos/horas extras e consulta efetivo mínimo.

**Independent Test**: Criar uma escala para um policial em turno/data/setor e confirmar que aparece no relatório de efetivo desse turno.

### Tests for User Story 5

- [ ] T062 [P] [US5] Backend integration tests for `contracts/staff.md` (incl. schedule uniqueness conflict, and `PATCH /staff/minimum-staffing-config` 403-for-non-WARDEN + persistence, `/speckit-analyze` finding G1-round2) in `backend/test/integration/staff.spec.ts`

### Implementation for User Story 5

- ~~T063~~ **Removed** (`/speckit-analyze` finding D2, round 3) — redundant with T020a: `GET /api/v1/users?role=&unitId=` (used for the `PRISON_OFFICER` roster, FR-021) is already part of T020a's own contract in `contracts/structure.md`, not a separate increment. No separate Staff entity/module exists (research.md #15).
- [ ] T064 [US5] Implement Schedules (escalas) with `(user, date, shift)` uniqueness constraint, referencing `User` directly, in `backend/src/staff/` (depends on T020a)
- [ ] T065 [US5] Implement `PATCH /schedules/:id/attendance` (presença/falta/abono/horas extras) in `backend/src/staff/` (depends on T064)
- [ ] T065a [P] [US5] Implement `MinimumStaffingConfig` repository/service backed by `minimum_staffing_config` table in `backend/src/staff/` (FR-024, research.md #12, `/speckit-analyze` finding G2; depends on T011)
- [ ] T065b [US5] Implement `PATCH /api/v1/staff/minimum-staffing-config` per `contracts/staff.md`, restricted to `WARDEN` only, in `backend/src/staff/` (depends on T065a, T019)
- [ ] T066 [US5] Implement `GET /schedules/minimum-staffing` report reading configured minimums from `minimum_staffing_config` (no hardcoded default) in `backend/src/staff/` (depends on T064, T065a)
- [ ] T067 [P] [US5] Build web frontend Efetivo/Escalas screens, including minimum-staffing configuration form for `WARDEN`, in `frontend/src/features/staff/` (depends on T065, T065b, T066)

**Checkpoint**: User Stories 1–5 all work independently

---

## Phase 8: User Story 6 - Relatórios e Auditoria (Priority: P6)

**Goal**: Supervisor e Chefia consultam relatórios operacionais e a trilha de auditoria completa.

**Independent Test**: A partir de dados gerados pelas demais stories, confirmar que `GET /reports/movements-by-inmate/:id` e `GET /audit` retornam os registros esperados, e que `PRISON_OFFICER` recebe 403.

### Tests for User Story 6

- [ ] T068 [P] [US6] Backend integration tests for `contracts/reports-audit.md` (incl. 403 for `PRISON_OFFICER`, unit-scope filtering) in `backend/test/integration/reports-audit.spec.ts`

### Implementation for User Story 6

- [ ] T069 [P] [US6] Implement Reports module queries — movements-by-inmate, longest-out-of-cell, inconsistencies, routine-execution, staff-vs-movements, cell-occupancy-history — in `backend/src/reports/` (depends on T042, T052, T059, T066)
- [ ] T070 [US6] Implement `GET /api/v1/audit` read-only endpoint with filters in `backend/src/audit/` (depends on T016)
- [ ] T071 [US6] Apply SUPERVISOR/WARDEN-only + unit-scope guard to all reports/audit endpoints (depends on T019, T069, T070)
- [ ] T072 [P] [US6] Build web frontend Relatórios + Auditoria screens in `frontend/src/features/reports/` (depends on T069, T070)

**Checkpoint**: All user stories independently functional

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T073 [P] Run full `quickstart.md` validation (Cenários 0–8) end-to-end against a seeded environment
- [ ] T074 [P] Audit codebase for Constitution V/IX/XI violations — no `any`/`@ts-ignore`, no business logic in controllers, no direct DB access outside repositories, no Portuguese identifiers in code/schema
- [ ] T074a [P] Set up k6 load-test tooling and script `backend/test/load/shift-change.js` simulating 200 concurrent virtual users against login/inmate-lookup/movement flows, with a `p(95)<500` threshold — research.md #14, `/speckit-analyze` finding G4 (depends on T042, T038, T039)
- [ ] T075 [P] Verify performance targets SC-001/SC-003/SC-004 (movement registration <30s, status lookup <5s, p95 <500ms with 200 concurrent users and no 5xx under load per T074a's k6 script)
- [ ] T076 [P] Complete Swagger/OpenAPI documentation for every `/api/v1` endpoint in `backend/src/`
- [ ] T077 [P] Update project documentation (`README.md`, module docs) to match implemented behavior (Constitution X)
- [ ] T078 Verify production build passes lint + build with zero errors for `backend/`, `frontend/`, `mobile/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3–8)**: All depend on Foundational completion
  - US1 has no dependency on other stories
  - US2–US6 build on entities/endpoints delivered by US1 (Inmates/Cells) but each remains independently testable once US1 exists
  - Recommended order follows priority: US1 → US2 → US3 → US4 → US5 → US6
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Foundational only
- **US2 (P2)**: Foundational + US1 (Inmates/Cells modules)
- **US3 (P3)**: Foundational + US1 + US2 (Movimentação concept)
- **US4 (P4)**: Foundational + US1 (Galleries)
- **US5 (P5)**: Foundational only (independent of US1–US4 domain-wise)
- **US6 (P6)**: Foundational + data-producing stories it reports on (US1–US5)

### Within Each User Story

- Tests written before/alongside implementation, MUST fail before the corresponding task is implemented
- Modules/entities before services; services before controllers/endpoints
- Backend endpoints before frontend/mobile screens that consume them
- Story complete before moving to next priority (for sequential/solo delivery)

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2, respecting the noted `depends on`)
- Once Foundational completes, US1 and US5 can start in parallel (US5 has no dependency on US1)
- Within each story, [P] tasks (different files) can run in parallel
- Frontend/mobile screens for a story ([P]) can run in parallel with each other once their backend endpoint task is done

---

## Parallel Example: User Story 1

```bash
# Launch tests for User Story 1 together:
Task: "Backend integration tests for contracts/structure.md in backend/test/integration/structure.spec.ts"
Task: "Backend unit tests for Cells capacity validation in backend/test/unit/cells.service.spec.ts"

# Launch independent modules for User Story 1 together:
Task: "Implement Units module in backend/src/units/"
Task: "Implement Galleries module in backend/src/galleries/"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run `quickstart.md` Cenário 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 (Cadastro e Mapa) → validate → deploy/demo (MVP)
3. Add US2 (Movimentações) → validate → deploy/demo — the core safety/traceability value from `spec.md`
4. Add US3 (Situações Definitivas) → validate → deploy/demo
5. Add US4 (Rotinas) → validate → deploy/demo
6. Add US5 (Efetivo) → validate → deploy/demo
7. Add US6 (Relatórios e Auditoria) → validate → deploy/demo
8. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers, after Setup + Foundational:

- Developer A: US1 → US2 → US3 (movement/inmate lineage)
- Developer B: US4 (Rotinas) — depends only on Galleries from US1
- Developer C: US5 (Efetivo) — independent of the inmate domain entirely
- US6 (Relatórios) picked up by whoever finishes first, once its data-producing stories land

---

## Notes

- [P] tasks = different files, no unmet dependencies
- [Story] label maps task to specific user story for traceability
- Every write endpoint MUST go through the Foundational `AuditInterceptor` (T016) — Constitution III
- Every endpoint MUST enforce RBAC + unit-scope guards (T019) — Constitution II, FR-004a
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independent testability
