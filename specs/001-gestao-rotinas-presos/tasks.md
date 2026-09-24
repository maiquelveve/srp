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

- [X] T001 Create monorepo structure (`backend/`, `frontend/`, `mobile/`) per `plan.md` Project Structure
- [X] T002 [P] Initialize `backend/` NestJS + TypeScript (strict) project with module folders: `src/auth`, `src/users`, `src/roles`, `src/units`, `src/galleries`, `src/cells`, `src/inmates`, `src/movements`, `src/routines`, `src/staff`, `src/reports`, `src/audit`, `src/common`, `src/config`
- [X] T003 [P] Initialize `frontend/` React + Vite + TypeScript project with TailwindCSS, shadcn/ui, TanStack Query, React Hook Form, Zod
- [X] T004 [P] Initialize `mobile/` React Native + Expo + TypeScript project
- [X] T005 [P] Configure ESLint + Prettier + Husky + lint-staged for `backend/`, `frontend/`, `mobile/` (Constitution IX — no `any`, no `@ts-ignore`)
- [X] T006 [P] Create `.env.example` files for `backend/`, `frontend/`, `mobile/` (POSTGRES_HOST/PORT/USER/PASSWORD/DB, JWT_SECRET, JWT_REFRESH_SECRET, API base URL)
- [X] T007 [P] Configure `docker-compose.yml` in `docker/postgres/` for local PostgreSQL (see `docker/README.md` for the convention — each stack gets its own subfolder with its own `.env`)
- [X] T008 Configure TypeORM in `backend/` (`@nestjs/typeorm` + `pg`, `backend/src/database/data-source.ts`, wire `POSTGRES_HOST/PORT/USER/PASSWORD/DB`, `synchronize: false`)
- [X] T009 [P] Configure Swagger/OpenAPI bootstrap under `/api/v1` prefix in `backend/src/main.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T010 Define all TypeORM entities across their owning modules (`<module>/entities/*.entity.ts`) mirroring `docs/srp_spec_database_model.md` (all identifiers in English per Constitution XI) — `Role`, `User`, `UserUnit` (join entity for FR-004a), `RefreshToken` (FR-030…FR-032 auth revocation, research.md #11), `Unit`, `Gallery`, `Cell`, `Inmate`, `InmateCellHistory`, `MovementType`, `Movement`, `Routine`, `RoutineSchedule`, `StaffSchedule`, `MinimumStaffingConfig` (FR-024, research.md #12), `AuditLog`; register all entities on the `DataSource` in `backend/src/database/data-source.ts` (depends on T008)
- [X] T011 Generate and run the initial TypeORM migration (`typeorm migration:generate` + `migration:run`) in `backend/src/database/migrations/` (depends on T010)
- [X] T012 [P] Create TypeORM seed script `backend/src/database/seeds/seed.ts` with the 3 roles and one sample user per role, unit, gallery and cell (depends on T011)
- [X] T013 [P] Implement global `ValidationPipe` + shared DTO base conventions in `backend/src/common/pipes/`
- [X] T014 [P] Implement global exception filter (consistent error shape) in `backend/src/common/filters/`
- [X] T015 [P] Implement request logging middleware in `backend/src/common/logging/`
- [X] T016 Implement `AuditService` + global `AuditInterceptor` writing to `audit_logs` on every state-changing request in `backend/src/audit/`, including a `REDACTED_FIELDS` redaction step (`passwordHash`, `tokenHash`, `@Sensitive()`-marked fields) applied to `oldData`/`newData` before persisting — Constitution II, research.md #6, `/speckit-analyze` finding C1 (depends on T011)
- [X] T017 [P] Implement Argon2 password hashing utility in `backend/src/auth/hashing/` (depends on T011)
- [X] T018 Implement JWT access + refresh token strategy in `backend/src/auth/`, persisting refresh tokens as SHA-256 hash in `refresh_tokens` (`userId`, `tokenHash`, `expiresAt`, `revokedAt`) with rotation on `/auth/refresh` — research.md #11, `/speckit-analyze` finding G3 (depends on T017)
- [X] T019 Implement RBAC + unit-scope guards reading `role` and `units` claims in `backend/src/auth/guards/` (research.md #5; depends on T018)
- [X] T020 Implement `POST /api/v1/auth/login`, `/refresh`, `/logout` per `contracts/auth.md` in `backend/src/auth/`, rejecting unknown/expired/revoked refresh tokens against `refresh_tokens` and revoking on logout (depends on T018, T016)
- [X] T020a [P] Implement Users module — `POST /api/v1/users`, `GET /api/v1/users`, `PATCH /api/v1/users/:id/deactivate` per `contracts/structure.md`, restricted to `WARDEN` only — in `backend/src/users/` (FR-030…FR-032, `/speckit-analyze` finding G1; depends on T016, T018, T019)
- [X] T020b [P] Implement `POST /api/v1/auth/set-initial-password` per `contracts/auth.md` — out-of-band initial-password flow for users created via `POST /api/v1/users` (single-use, short-expiry invite token; password never returned in plaintext by the API) — research.md #10 — in `backend/src/auth/` (depends on T020a)
- [X] T021 [P] Apply Helmet, CORS allow-list, and `@nestjs/throttler` rate limiting on `/auth/login` in `backend/src/main.ts` (depends on T020)
- [X] T022 [P] Implement `GET /api/v1/health` health check endpoint in `backend/src/common/health/`
- [X] T023 [P] Configure `frontend/` API client with token storage/refresh handling in `frontend/src/services/api-client.ts` (depends on T020)
- [X] T024 [P] Configure `mobile/` API client with token storage/refresh handling in `mobile/src/services/api-client.ts` (depends on T020)
- [X] T025 [P] Scaffold mobile offline queue infrastructure (SQLite via `expo-sqlite`, idempotency-key generation) in `mobile/src/offline/` (research.md #4)

**Checkpoint**: Foundation ready — user story implementation can now begin (includes user provisioning via T020a/T020b, so subsequent stories are no longer limited to seeded accounts)

---

## Phase 3: User Story 1 - Cadastro e Mapa da Unidade (Priority: P1) 🎯 MVP

**Goal**: Chefia/Diretor e Supervisor cadastram unidades, galerias, celas e presos; policiais e supervisores consultam o mapa da unidade.

**Independent Test**: Cadastrar uma unidade, galeria, cela e preso via API e confirmar que o preso aparece corretamente associado no mapa da unidade (`GET /api/v1/inmates?cellId=`).

### Tests for User Story 1

- [X] T026 [P] [US1] Backend integration tests for `contracts/structure.md` endpoints (incl. 403 for `PRISON_OFFICER` writes, unit-scope filtering) in `backend/test/integration/structure.spec.ts`
- [X] T027 [P] [US1] Backend unit tests for Cells capacity validation in `backend/test/unit/cells.service.spec.ts`

### Implementation for User Story 1

- [X] T028 [P] [US1] Implement Units module (Controller/Service/Repository/DTOs) in `backend/src/units/`
- [X] T029 [P] [US1] Implement Galleries module in `backend/src/galleries/`
- [X] T030 [US1] Implement Cells module with capacity validation in `backend/src/cells/` (depends on T029)
- [X] T031 [US1] Implement Inmates module — create/update/get/list scoped by cela/galeria/unidade in `backend/src/inmates/` (depends on T030)
- [X] T032 [US1] Apply RBAC (WARDEN-only writes) + unit-scope guard to Units/Galleries/Cells/Inmates endpoints (depends on T019, T028–T031)
- [X] T033 [P] [US1] Build web frontend Units/Galleries/Cells/Inmates management screens in `frontend/src/features/structure/` (depends on T023, T031)
- [X] T034 [P] [US1] Build mobile read-only "consultar presos por cela/galeria" screen in `mobile/src/screens/InmatesLookup.tsx` (depends on T024, T031)

**Checkpoint**: User Story 1 fully functional and independently testable

---

## Phase 3.5: UI/UX Design System & Layout Refinement (Pre-US2)

**Purpose**: US1's screens were built to prove the API end-to-end, not to establish a reusable layout. Before US2–US6 add more screens, establish the shared navigation chrome (sidebar/header, shadcn `dashboard-01` pattern already validated with the user) and a consistent component-organization convention, so later stories don't each reinvent page layout — research.md #16/#17/#18.

**Independent Test**: `StructurePage` and `LoginPage` render through the shared `AppShell`/folder structure with no behavior change (same data, same RBAC-gated actions); `npx tsc -b`, `npx eslint . --max-warnings=0`, `npx vite build` all pass in `frontend/`.

**Folder-per-component convention** (research.md #17): every page and every component — feature-local or shared, single-file or not — lives in its own folder named after the concept (`PascalCase` for components, matching the route/feature name for pages/features), with `index.tsx` as its single entry point. No bare `<Name>.tsx` files at the page/component level, no exceptions based on file count — this trades a few extra folders for zero case-by-case judgment calls about when a component "deserves" its own folder. `types.ts`/`api.ts` (feature-level, not per-component) stay as plain files alongside `index.tsx`, not wrapped in their own folder.

```text
frontend/src/
├── pages/
│   └── LoginPage/
│       └── index.tsx
├── features/
│   └── structure/
│       ├── index.tsx           # the page itself (was StructurePage.tsx)
│       ├── types.ts
│       ├── api.ts
│       └── components/
│           └── StatusBadge/
│               └── index.tsx
```

- [X] T034a [P] Apply the folder-per-component convention above to existing US1 code: move `frontend/src/pages/LoginPage.tsx` → `frontend/src/pages/LoginPage/index.tsx`; move `frontend/src/features/structure/StructurePage.tsx` → `frontend/src/features/structure/index.tsx`; extract `StatusBadge` into `frontend/src/features/structure/components/StatusBadge/index.tsx`; update all importers (`App.tsx`)
- [X] T034b Add any additional shadcn primitives needed for the shell (`avatar`, `dropdown-menu`, `separator`, plus `lucide-react` for icons) via `npx shadcn@latest add`, then build a reusable `AppShell` (sidebar nav + header, shadcn `dashboard-01` pattern) in `frontend/src/layouts/AppShell/index.tsx`, following the same folder-per-component convention. **Revised (same day)**: first pass hand-rolled the inset/canvas CSS effect instead of using the real `Sidebar` primitive — visual testing via Playwright MCP against the actual `dashboard-01` block (temporarily installed at `/dashboard-01-preview` for side-by-side comparison) showed it didn't match; rebuilt on the official `Sidebar`/`SidebarProvider`/`SidebarInset` components with real nav/user data in `layouts/AppShell/components/{NavMain,NavUser,NavDocuments,NavSecondary,SiteHeader}/` — research.md #18 revision. Once the real `AppShell` matched, the comparison route and every block file/dependency that only existed to feed it (`app-sidebar.tsx`, `data-table.tsx`, `chart-area-interactive.tsx`, `section-cards.tsx`, `nav-*.tsx`, `site-header.tsx`, plus `recharts`/`@tanstack/react-table`/`@dnd-kit/*`/`sonner`/`next-themes`/`vaul`/`@tailwindcss/container-queries`) were removed.
- [X] T034c Wire `AppShell` into `frontend/src/App.tsx` as a layout route (`<Outlet />`) nested inside `ProtectedRoute`, around authenticated routes, replacing each page's own ad-hoc `<header>` (depends on T034b)
- [X] T034d Redesign `frontend/src/pages/LoginPage/index.tsx` to match the shadcn login example more closely, reusing existing `Card`/`Input`/`Label`/`Button` — no new business logic (depends on T034a). Landed on the official `login-04` block (two-column card: form left, image right, `bg-muted` page canvas) — dropped the OAuth buttons, "sign up" link, and ToS footer, none of which apply here (no OAuth, no self-registration per FR-030); right column shows the real Polícia Penal RS badge (`frontend/src/assets/logo-pp-rs.png`) instead of a placeholder photo; "Or continue with" + 3 OAuth buttons replaced with a single "Recuperar senha" button (no backend password-reset endpoint yet, so it's a visual placeholder for now, not wired up).
- [X] T034e Redesign `frontend/src/features/structure/index.tsx` unit/gallery/cell navigation and content to follow the `dashboard-01` visual pattern (cards/table instead of the current pill-button drill-down) (depends on T034a, T034c). Landed on: `StructureFilters` (unit `Select` auto-picked to the user's first unit + galleries multi-select `DropdownMenu`, both pre-selected/auto-searched on load, "Pesquisar" re-applies the gallery selection) driving `GalleryCards` — one card per selected Galeria (aggregate occupancy in the header), Celas listed compactly inside with a table-like column header (Cela/Ocupação/Vagas/Status, all centered, fixed-width Status column so rows/header stay pixel-aligned regardless of badge text length), row click expands inline to that cell's inmates. Inmate list (inside the expanded Cela) got its own column header (Nome/Matrícula/Ações — no Regime or Status columns: every preso reachable from a Cela is by definition ACTIVE + regime fechado, so both would just repeat the same value on every row) plus two icon-only action buttons per row (Mover preso, Alterar situação — tooltipped, not wired up yet) and a WARDEN-only `InmateDialog` (unified create/edit form: Cela and Regime shown locked/read-only, Nome/Matrícula/Data de nascimento editable) reached either by clicking a preso row (edit) or the small "Cadastrar preso" button below the list (create) — both via `POST`/`PATCH /inmates` per cela, never a cross-cela picker. Galeria/Cela/Unidade creation (originally a floating "Novo" button here, `CreateEntityDialog`) was removed in T034g — see there and research.md #21. research.md #20 documents the resulting "every `Button` gets `active:scale-95`" rule that came out of iterating on this screen's "Pesquisar" button.
- [X] T034f [P] Document the layout/component-organization decision in `research.md` (#17 folder-per-component convention, #18 `AppShell` layout-route convention) (depends on T034a)
- [X] T034g Remove the floating "Novo" button (`CreateEntityDialog`) from `frontend/src/features/structure/index.tsx` — Unidade/Galeria/Cela creation is moving to the new `/configuracoes` screen (T034h), Mapa da Unidade keeps only preso creation/edit (`InmateDialog`, already cell-scoped). Rebalance `StructureFilters` now that the row has one less neighboring action: "Unidade"/"Galerias" go from fixed `w-56` to `flex-1 min-w-[200px]` so the filter bar fills the row instead of leaving empty space on the right (depends on T034e). research.md #21.
- [X] T034h Build the `/configuracoes` screen in `frontend/src/pages/SettingsPage/index.tsx` (or `frontend/src/features/settings/`, folder-per-component per T034a) — Units/Galleries/Cells management (list + create), reusing `structureApi.createGallery`/`createCell` and the existing `CreateEntityDialog` component (`frontend/src/features/structure/components/CreateEntityDialog/`, currently unused after T034g — either move it under the new feature folder or import it from there, whichever keeps `structureApi` as the single source of truth for these mutations) plus a Units list/create UI (`structureApi.createUnit` already exists in `api.ts` but has no UI consumer yet). Wire the real route in `frontend/src/App.tsx` replacing the `/configuracoes` catch-all placeholder (research.md #18). WARDEN-only, same RBAC pattern as T034e (depends on T034g, T023). **Landed on**: `frontend/src/features/settings/index.tsx` — three-section drill-down (Unidades table → pick a Unit → Galerias table → pick a Gallery → Celas table), each section with its own "Nova X" button. Whole page gates on `user.role === 'WARDEN'` (this screen is 100% mutations, unlike T034e's per-action gating) showing a plain "Acesso restrito" message otherwise. `CreateEntityDialog` moved (not imported cross-feature) to `frontend/src/features/settings/components/CreateEntityDialog/` since only Settings uses it now — kept importing `structureApi`/types from `features/structure/` as the single source of truth per the move-vs-import discussion. Simplified while moving: dropped the old in-dialog entity-type `Select` (dead now that every call site already knows its type via a fixed `entityType` prop — discriminated union `'unit' | 'gallery' | 'cell'`) and added the missing `unit` branch (name + optional code, no parent id) alongside the existing `gallery`/`cell` ones. `npx tsc -b`, `npx eslint . --max-warnings=0`, `npx vite build` all pass; verified live via Playwright (login → navigate → create a test cell → toast + table update with no reload → row deleted from DB afterward to keep the seeded environment clean).

  **Revised (same day, user feedback on first pass)**: three stacked cards read as cluttered — replaced with a single `Card` + shadcn `Tabs` (`npx shadcn@latest add tabs alert-dialog`), one table visible at a time (Unidades/Galerias/Celas). Added an "Ações" column (`Editar`/`Desativar` icon buttons, `RowActionButton` — a `forwardRef` component, required since it's used as `DialogTrigger`/`AlertDialogTrigger`'s direct `asChild` child) to every row. `CreateEntityDialog` renamed to `EntityDialog` and extended to double as an edit form (same create-or-edit-in-one-form shape as `InmateDialog`) — prefilled from the row's data when an `entity` prop is passed. "Excluir" is a soft `active: false` deactivate everywhere, confirmed via shadcn `AlertDialog`, never a hard DELETE (Unit→Gallery→Cell→Inmate chain off each other and off the audit log; mirrors the existing `PATCH /users/:id/deactivate` pattern) — user-confirmed decision.
  **Known gap, backend-blocked (do not forget)**: the backend only has `PATCH /api/v1/units/:id` — Units' Editar/Desativar are real. **Galleries and Cells have no `PATCH` endpoint at all** (`galleries.controller.ts`/`cells.controller.ts` are `POST` + `GET` only), so `structureApi.updateGalleryMock`/`updateCellMock` (`frontend/src/features/structure/api.ts`) are client-side mocks — they resolve after a fake delay and never touch the network. `EntityDialog`'s edit path and `DeactivateAlert` both detect this (`entityType !== 'unit'`) and show a distinct "simulado — backend ainda não implementado" info toast instead of a success one, and skip cache invalidation, so the UI never lies about data being persisted. User-approved stopgap (2026-08-12): ship the UI now, wire it to real endpoints once `PATCH /galleries/:id` and `PATCH /cells/:id` exist — grep `Mock` in `frontend/src/features/structure/api.ts` to find both call sites to swap.
  Unit selector on the Galerias tab: when the WARDEN only has one accessible unit (`GET /units` is already scoped server-side, so this is the common case), show the name as plain text instead of a one-option `Select` — user feedback, not generalized to the Celas tab's gallery selector since that wasn't asked for.

  **Revised again (same day, second round of user feedback)**: idle-state `RowActionButton`s were plain `outline` (no color until hovered) — added a `TONE_CLASS` map (`primary`/`destructive`) giving Editar/Desativar a light tint at rest, hover keeps the previously-approved full-fill treatment unchanged. Replaced the Galerias-tab unit `Select` entirely (superseding the single-unit-as-text tweak above) with click-to-select rows on the Unidades tab itself — clicking a row sets it as the shared `unitId` state, shown with a `text-success` `CheckCircle2Icon` in a new leading column (Ações cell stops click propagation so Editar/Desativar don't also select the row); the Galerias tab now just displays that selection as a read-only label (same icon + name), no dropdown regardless of unit count. Restyled the shared `components/ui/tabs.tsx` primitive itself (affects any future usage, not just this screen) from the stock shadcn muted-pill look to an underline style (`border-b`, active tab gets a `bg-primary` underline via `::after` + bold text) with a `lucide-react` icon per tab (`Building2Icon`/`Rows3Icon`/`DoorClosedIcon`). Cells table's Código column now shows the bare code (`cell.code`) instead of `Cela {cell.code}` — the "Cela" word was redundant with the tab/section context. Also added a one-way "reativar" control inside `EntityDialog`'s unit edit form (a clickable `Badge`, visible only when the unit is currently inactive) — discovered missing when live-testing surfaced that the user's own manual testing had deactivated the seeded Unidade Central with no UI path back; deactivating still only happens through the confirmed `DeactivateAlert` flow, this only ever turns `active` back on.
  **Discovered while testing, not yet acted on**: the user created a second real unit ("PEC II", `units.id=2`) via "Nova Unidade" while testing, but it never appeared in any list — `GET /units` scopes by the JWT's baked-in `units` claim (`currentUser.units`, set at login from the `UserUnit` join table), and creating a Unit does not add the creating WARDEN to it. So a WARDEN can create a unit they can then never see or manage themselves without a separate (currently nonexistent) step associating their user with it. Flagged to the user; not fixed here — needs a product decision (auto-associate the creator? require an explicit "associate user to unit" step elsewhere?) before it's worth a task entry. Confirmed the row-click-select mechanism works correctly with 2+ real units: created a second unit ("Unidade Sul", `units.id=3`) via the UI and manually inserted a `user_units` row (`user_id=3, unit_id=3`) + re-logged in to refresh the JWT's `units` claim so it would actually appear — clicking between the two rows correctly moved the check icon and updated the Galerias tab's label.

  **Revised a third time (same day, third round of user feedback)**: the tab underline's width was computed via `after:inset-x-4` matching the trigger's own `px-4` padding — worked out to be mathematically exact per `getComputedStyle` measurements, but per-tab visual drift was still reported (worst on "Celas", underline stopping short of the label). Root cause: matching two independent Tailwind tokens (`px-4` on the button, `inset-x-4` on the pseudo-element) is fragile by construction — anything that changes one without the other (or subpixel layout rounding across different label widths) breaks the assumption. Fixed structurally instead of numerically: the underline now lives on an inner `<span>` (`relative inline-flex items-center gap-2`, zero padding of its own) wrapping just the icon+label, with `after:inset-x-0` — so its width is *always* exactly the rendered content width by construction, no token-matching required. Active-state styling moved to a `group`/`group-data-[state=active]:` pair (outer button carries `group` + `data-state`, inner span reacts to it) since the color/opacity change needed to stay on the wrapper.
  Also relocated the "?" help tooltip (`CircleHelpIcon`) on the Unidades tab — it sat alone to the left of "Nova Unidade" with a large empty gap in between, reported as looking "solto" (orphaned). Moved into the previously-unlabeled leading `TableHead` (the same column the green `CheckCircle2Icon` lives in, per row) — user picked this over alternatives (grouped next to "Nova Unidade", inside the `TabsTrigger` itself, or reverting to always-visible text) specifically because it anchors the "?" to the exact column it explains instead of floating in open toolbar space.

  **Revised a fourth time (same day, fourth round of user feedback)**: the "exactly matches content width" underline fix from the third round was still reported as shorter than the tab label (worst on "Celas" again) despite `getComputedStyle`/`Range.getBoundingClientRect()` measurements proving pixel-exact equality in this Chromium instance — exact equality is inherently one browser/font/DPI rounding difference away from reading as short again, so chasing pixel-perfect measurement further wasn't going to be robust. Switched `after:inset-x-0` → `after:-inset-x-1` on the inner span: the underline now deliberately overshoots the icon+label by 4px on each side instead of trying to match it exactly, so it always reads as *at least* as long as the text regardless of what's rendering it.
  The "?" tooltip button (relocated into the `TableHead` last round) was reported as not vertically aligned with the other column headers ("Nome"/"Código"/etc.) — it was a bare `<button>` with no flex layout, so its icon sat inside the button's own default line-height leading instead of being centered in the button's box; the `TableHead`'s `align-middle` was centering that whole (slightly-off) box, not the icon itself. Fixed by adding `inline-flex items-center` to the button, matching how every other icon-only trigger in this codebase (`RowActionButton`, shadcn `Button size="icon"`) is already built.

  **Revised a fifth time (same day, fifth round of user feedback)**: the fixed `-inset-x-1` overshoot from round four still read as too short specifically on "Galerias"/"Celas" (fine on "Unidades") — user correctly called out that a fixed-pixel CSS value chasing a per-label, per-font, per-browser target was never going to hold up ("não deixe de forma fixa pois quando diminuir a tela vai dar problema"). Replaced the whole per-trigger CSS pseudo-element approach with a single JS-measured sliding indicator on `TabsList` (`components/ui/tabs.tsx`): each `TabsTrigger`'s content is wrapped in a `[data-tab-label]` span, and `TabsList` reads that span's real `getBoundingClientRect()` off the currently-`data-state=active` trigger to position/size one shared `<span>` underline via inline `style={{ left, width }}` — a `ResizeObserver` on the list and a `MutationObserver` watching `data-state` keep it correct on tab switch, window resize, sidebar collapse, or zoom, since it's reading the actual rendered box every time instead of assuming a padding/inset relationship that only happened to hold for one label. Verified by resizing the viewport to 700px (sidebar auto-collapses) and switching tabs — indicator stayed pixel-accurate on every tab at both widths, 0 console errors.

  **Revised a sixth time (same day, sixth round of user feedback)**: four unrelated fixes in one pass. (1) Table headers/cells (`components/ui/table.tsx`) were left-aligned by default — changed `TableHead`/`TableCell` to `text-center` (the only consumer today is `/configuracoes`, so this is safe project-wide). The Ações column initially kept a `text-right` override (header text + `flex justify-end` button row) inherited from before this change — inconsistent with every other now-centered column, and reported as such next round (see below). (2) Removed `TabsList`'s `border-b border-border` (the full-width gray line under all three tabs) now that the sliding yellow indicator from the fifth revision is the only underline signal needed. (3) User caught that the Galerias/Celas tables render a "Tipo" column that no create/edit form ever offered a way to set — legitimate confusion, not an invented field: `type?: string` is a real optional column on both entities (`CreateGalleryDto`/`CreateCellDto`, `structureApi.createGallery`/`createCell` already accepted it), just never wired to an input. Added a "Tipo (opcional)" text field to `EntityDialog` for both `gallery`/`cell` (placeholder hints at the seeded values, `MALE`/`FEMALE` and `SHARED`/`INDIVIDUAL`, since there's no backend enum constraining it — free text). (4) Rebuilt the "?" tooltip on shadcn's newer "base" Tooltip pattern (ui.shadcn.com/docs/components/base/tooltip): added an exported `TooltipArrow` (`components/ui/tooltip.tsx`, wraps `TooltipPrimitive.Arrow`, defaults to `fill-popover` so other tooltips in the app are unaffected unless they opt in), shrank `TooltipContent`'s default sizing (`px-3 py-1.5 text-sm` → `px-2 py-1 text-xs`), and switched the "?" tooltip specifically to `side="top"` with `<TooltipArrow className="fill-accent" />` (matching its `bg-accent` override) — user explicitly asked to keep the existing colors, only the shape/position/size changed. Caught and fixed a knock-on bug from this: `TooltipContent`'s `overflow-hidden` was clipping the Arrow (Radix positions it straddling the content box's edge on purpose) — removed `overflow-hidden` from the shared component; confirmed via DOM measurement (`getBoundingClientRect` on the arrow SVG) since the rendered triangle is small (10×5px) and easy to miss in a screenshot at this dark-on-dark contrast.

  **Revised a seventh time (same day, seventh round of user feedback)**: (1) Ações column — dropped the leftover `text-right`/`flex justify-end` from before the sixth revision's table-wide centering change (all three tables: Unidades/Galerias/Celas) so the "Ações" header and its button row are centered like every other column, closing the inconsistency flagged above. (2) The leading unlabeled column on the Unidades tab (holds the "?" tooltip in the header, the green `CheckCircle2Icon` per row) — user wanted it flush against the table's left edge rather than carrying the same `px-4` inset as content columns; added a `pl-0` override to both its `TableHead` and `TableCell`. (3) User flagged "texto em português na UI, lembra" — audited `features/settings/` for stray English strings (none found; every visible label was already Portuguese) but caught two `sr-only` (screen-reader-only, invisible but real UI text) instances of the shadcn-vendored `dialog.tsx`/`sheet.tsx` close-button — hardcoded English "Close" — translated both to "Fechar". Pre-existing in the vendored primitives, unrelated to this feature's own code, but a real Portuguese-UI gap now that a screen-reader user would hit it through any `Dialog`/`Sheet` in the app, not just this screen.

  **Revised an eighth time (same day, eighth round of user feedback)**: (1) `MALE`/`FEMALE`/`SHARED`/`INDIVIDUAL` — the seeded English tokens in the Tipo column — flagged as English text in the UI. `type` is genuinely free text server-side (no enum to translate at the source), so added `GALLERY_TYPE_LABEL`/`CELL_TYPE_LABEL` display-only lookup maps in `features/settings/index.tsx` (same pattern as `StatusBadge`'s `STATUS_LABEL`), falling back to the raw value for anything not in the map. Also switched `EntityDialog`'s "Tipo" placeholder from the English examples (`Ex.: MALE, FEMALE`) to Portuguese ones (`Ex.: Masculina, Feminina` / `Ex.: Compartilhada, Individual`) — new data entered from here on lands in Portuguese already, needing no lookup entry; the maps exist to translate the legacy seeded English tokens. (2) The leading Unidades-tab column (check icon / "?") still didn't visually line up between header and body — round seven's `pl-0` alone wasn't enough because both cells still inherited the table-wide `text-center` from the sixth revision, so each centered independently within slightly different available widths. Added an explicit `text-left` to both the `TableHead` and `TableCell`, overriding the shared default for this one column only (every other column stays centered, per explicit instruction) — flush-left alignment removes the centering math entirely, so header and body content now start at the identical x position by construction, not by coincidence.

  **Revised a ninth time (same day, ninth round of user feedback)**: (1) User pushed back on the eighth revision's `GALLERY_TYPE_LABEL`/`CELL_TYPE_LABEL` display-mapping approach for the English seed tokens — correctly, since `type` has no real constraint (free text), a hardcoded 2-entry lookup implicitly bakes in an assumption ("it's always exactly one of these two values") that a genuinely free-text field doesn't guarantee, even though the code's `?? gallery.type` fallback technically degraded safely for anything unmapped. Decision: don't paper over an unconstrained field with a translation table now — reverted to showing the raw DB value as-is (`gallery.type ?? '—'`), reverted `EntityDialog`'s placeholder back to the English examples matching what's actually stored (`Ex.: MALE, FEMALE` / `Ex.: SHARED, INDIVIDUAL`), and deferred the real fix to **T034h-type-enum** below — a backend enum is the correct place to constrain this to exactly two options, at which point the frontend switches from a free-text `Input` to a `Select` and can render fixed Portuguese labels safely. (2) Re-verified the leading Unidades-tab column (check icon / "?") is flush with the table's own left edge — `getBoundingClientRect()` on the table, the header cell, and the button all returned identical `left` values (0px gap) confirming round eight's `text-left` fix already holds; no further change needed here. (3) Removed the "Ocupação" column from the Celas tab entirely (header + `cell.occupancy` cell, `colSpan` on the empty-state row adjusted 6→5) — this is a cadastro (create/manage) screen, not a live-occupancy view (that's Mapa da Unidade's job), so showing current occupancy here was out of place.

  **Revised a tenth time (same day, tenth round of user feedback)**: round nine's "leading column" fix targeted the wrong column — user's screenshots clarified "primeira coluna" meant **Nome** (the first *named* column), not the unlabeled check-icon column before it, which was never the complaint. Nome's `TableHead`/`TableCell` had inherited the table-wide `text-center` from the sixth revision same as every other content column, leaving a large gap between the check column and "Unidade Central"/"Unidade Sul" instead of sitting right beside it. Added `text-left` to Nome's `TableHead` and `TableCell` only (Código/Status/Ações untouched, stay centered, per explicit instruction) — kept the default `px-4` left padding (didn't `pl-0` it) so Nome doesn't crowd directly against the check column.

  **Revised an eleventh time (same day, eleventh round of user feedback)**: left-aligning Nome/Código (rounds ten/this one) made the gap to the *next* column look too wide, since `table-layout: auto` was letting those columns claim as much width as their content needed (which, for text sitting left-aligned in an over-wide cell, just becomes trailing whitespace instead of centered whitespace). Added an explicit `w-*` cap alongside each: `w-64` on Unidades' Nome, `w-48` on Galerias' Código, `w-32` on Celas' Código — narrower for Celas since cell codes (`01`, `Z01`) are much shorter than gallery codes ("Galeria A") or unit names. Same reasoning as the existing `w-10` on the check column, just sized to each column's actual content instead of forcing all name/code columns to share one width.

- [X] T034h-type-enum [P] Add a real backend enum constraining Gallery `type` to exactly `MALE`/`FEMALE` and Cell `type` to exactly `SHARED`/`INDIVIDUAL` (`CreateGalleryDto`/`CreateCellDto` currently accept arbitrary free text — `@IsString() @MaxLength(50) type?: string`, no `@IsIn`/enum). Once the backend constrains it, swap `EntityDialog`'s free-text "Tipo" `Input` for a `Select` with the fixed options, and re-add Portuguese display labels (`Masculina`/`Feminina`, `Compartilhada`/`Individual`) in `/configuracoes`'s Galerias/Celas tables — safe to do only once the value space is actually closed (depends on T034h). **Landed on**: `GalleryType`/`CellType` TS enums added directly in `galleries/entities/gallery.entity.ts`/`cells/entities/cell.entity.ts` (same convention as `MovementCategory`/`RoleName`/`InmateStatus` — column stays `varchar`, no migration needed, enum is a TS/validation-layer constraint only), `CreateGalleryDto`/`CreateCellDto` switched `@IsString()` → `@IsEnum(...)`, response DTOs typed accordingly. `seed.ts` updated to reference `GalleryType.MALE`/`CellType.SHARED`/`CellType.INDIVIDUAL` (raw string literals no longer type-check against an enum-typed property). Frontend: `features/structure/types.ts` gained `GalleryType`/`CellType` string-union types, `structureApi`'s create/mock-update signatures narrowed from `type?: string` to the matching union, `EntityDialog`'s free-text Input replaced with a `Select` (`GALLERY_TYPE_OPTIONS`/`CELL_TYPE_OPTIONS`, values cast at the mutation boundary since the shared `type` state is a plain string covering both enums), and `/configuracoes`'s Galerias/Celas tables got `GALLERY_TYPE_LABEL`/`CELL_TYPE_LABEL` display maps back — now a *total* mapping (no fallback branch needed) since every value that can reach the table came from the `Select`. Verified: `curl` against a live-reloaded backend confirmed `POST /galleries` with `type: "BOGUS"` → `400` and `type: "FEMALE"` → `201`; backend unit + integration suites green; full create flow tested live via Playwright (Nova Galeria → Select → Feminina → toast → table shows "Feminina", row cleaned up after). **Side quest**: caught two stale/duplicate backend processes fighting over port 3000 (a leftover `node dist/src/main` from an earlier manual run shadowing the actual `nest start --watch`, which had itself silently stopped listening) — user approved killing both and restarting a clean `npm run start:dev`; same root-cause shape as the frontend's earlier stray-port issue (T034h, first round).

  **Revised (same day, pre-commit review)**: user caught two more gaps before this landed. (1) `type` was still nullable/optional on both entities — genuinely wrong for a field now backed by a 2-member enum with no meaningful "unset" state; made it required end to end: entity columns `nullable: true` → dropped (with the TS type going from `X | null` to `X`), `CreateGalleryDto`/`CreateCellDto` dropped `@IsOptional()`, response DTOs and services updated to match. Existing rows predating this constraint had `type IS NULL` (1 gallery, 6 cells — some pre-existing dev fixtures, some accumulated from live-testing this feature) — added migration `1786582681472-RequireGalleryAndCellType` backfilling NULLs to each enum's first member (`MALE`/`SHARED`) before `ALTER COLUMN ... SET NOT NULL`, run against the dev DB. Frontend: `Gallery`/`Cell` types dropped the `| null`, `structureApi.createGallery`/`createCell` made `type` a required input field, `EntityDialog`'s `canSubmit` now requires a type selection for gallery/cell (button stays disabled until one is picked — verified live), "Tipo" label dropped its "(opcional)" suffix, and the settings-page display maps became total lookups (no more `? ... : '—'` fallback branch, matches the type no longer being nullable). Fixed two now-required-field fallout spots in backend tests (`structure.spec.ts`'s two `POST /galleries`/`POST /cells` calls, `cells.service.spec.ts`'s three `service.create(...)` calls) that previously omitted `type`. (2) Renamed the Cela type label "Compartilhada" → "Coletiva" (`CELL_TYPE_OPTIONS` in `EntityDialog`, `CELL_TYPE_LABEL` in `/configuracoes`) — display wording only, the underlying enum member stays `CellType.SHARED` to match already-stored data. Full validation re-run after: backend `tsc`/lint/unit+integration tests and frontend `tsc`/lint/build all green; live-tested the disabled-Salvar-until-Tipo-chosen behavior and the "Coletiva" label on both pre-existing and migration-backfilled rows.
- [X] T034h-backend [P] Implement `PATCH /api/v1/galleries/:id` and `PATCH /api/v1/cells/:id` (WARDEN-only, mirroring `UnitsController.update`/`UpdateUnitDto`) so the mocked Editar/Desativar on the `/configuracoes` Galerias/Celas tabs can call the real API. Swap `structureApi.updateGalleryMock`/`updateCellMock` (`frontend/src/features/structure/api.ts`) for real `apiClient.patch` calls once these land, and drop the "simulado" branch in `EntityDialog`/`DeactivateAlert` (depends on T034h). **Landed on**: `UpdateGalleryDto`/`UpdateCellDto` (all fields optional, same shape as `UpdateUnitDto` — `code`/`type`/`active` for galleries, plus `capacity` for cells; `type` stays `@IsEnum`, not free text), `GalleriesService.update`/`CellsService.update` reuse each service's existing `findEntityInScope` for the unit-scope check (no new scope logic needed), `Object.assign` + save, same pattern as `UnitsService.update`. `CellsService.update` re-applies the `capacity >= 0` defense-in-depth check from `create()` when `capacity` is provided. Controllers got `@Patch(':id')` + `@Roles(RoleName.WARDEN)`, mirroring `UnitsController`. Documented both routes in `contracts/structure.md`. Frontend: `structureApi.updateGalleryMock`/`updateCellMock` replaced by real `updateGallery`/`updateCell` (`apiClient.patch`); `EntityDialog`/`DeactivateAlert` dropped the `isMock`/"simulado" branch entirely — both now always show a success toast and invalidate the relevant list query (`['galleries', unitId]`/`['cells', galleryId]`), which `DeactivateAlert` wasn't doing before for gallery/cell (previously only `unit` invalidated on deactivate; the mock never needed to, since it never touched the cache either way). Verified: new integration tests in `structure.spec.ts` (PATCH gallery/cell 200 + field update, PATCH both as `PRISON_OFFICER` → 403) — 7/7 passing against a real Postgres test DB; backend/frontend `tsc`, `eslint --max-warnings=0`, backend unit tests (4/4), and `vite build` all green. Noted, not fixed: `npm run test:integration` occasionally throws an unhandled `QueryFailedError: Connection terminated` *after* Jest reports all tests passing (exit 0) — a pre-existing race between the fire-and-forget `AuditInterceptor`/`AuditService.record` write and `app.close()` in the test teardown, not specific to this task; reproduced once in 4 runs, harmless to CI (exit code stays 0) but worth a real fix later.
- [X] T034i [P] Document the finished `/configuracoes` screen and its final component layout in `research.md` #21 once T034h lands (depends on T034h). **Landed on**: documented the final `Card` + `Tabs` layout, the unified `EntityDialog`/`DeactivateAlert` pattern, and — since T034h-backend closed the last gap — the removal of the `updateGalleryMock`/`updateCellMock` client-side mocks and the "simulado" toast branch now that `PATCH /galleries/:id`/`PATCH /cells/:id` are real. No known gaps remain on this screen.
- [X] T034j Add an "Início" page + nav item: `frontend/src/pages/HomePage/index.tsx` (folder-per-component per T034a) as a **blank placeholder** — no dashboard/widgets/shortcuts content yet, content is an explicitly deferred product decision (research.md #22). Add it as the first item in `AppShell`'s `NAV_ITEMS` (`frontend/src/layouts/AppShell/index.tsx`), wire the real route in `frontend/src/App.tsx` (currently falls to the `/mapa-da-unidade` catch-all — decide there whether "Início" becomes the new default redirect target, or stays a separate route alongside it). No RBAC restriction (every authenticated role should land somewhere) (depends on T034a, T034c). **Landed on**: `HomePage` is a blank `<div className="p-6" />` inside `AppShell`, route `/inicio`, first `NavMainItem` (`HomeIcon`). User decision (2026-08-14): "Início" is the new default — `App.tsx` redirects `/` → `/inicio`, and `LoginPage` navigates there on successful login instead of `/mapa-da-unidade`. Discovered mid-implementation that the catch-all `*` route's silent `<Navigate to="/mapa-da-unidade" />` fallback needed to become a real 404 page — tracked as new task **T034j-404page** below (not in the original task description, added and implemented same day per user instruction). Verified live via Playwright: `/` → `/inicio` (full `AppShell`, "Início" selected in nav); login → `/inicio`; unknown route → `NotFoundPage`; its "Voltar para o Início" link → `/inicio`; an unimplemented nav item (e.g. Movimentações) now hits the same 404 instead of silently falling back to Mapa da Unidade (expected/accepted side effect — more honest than pretending the route exists). `tsc`/`eslint --max-warnings=0`/`vite build` all green.
- [X] T034j-404page Replace `App.tsx`'s catch-all `<Navigate to="/mapa-da-unidade" replace />` with a real `NotFoundPage` (`frontend/src/pages/NotFoundPage/index.tsx`, folder-per-component) — "404" + message + a button linking to `/inicio`. Rendered standalone, outside `AppShell`/`ProtectedRoute`, so an unauthenticated visitor hitting an invalid URL sees the 404 too (the "Voltar para o Início" link still routes them through the normal `ProtectedRoute` → `/login` flow if unauthenticated) (depends on T034j, research.md #22)
  **Revised (same day, user feedback)**: first pass read as cramped (small `404`/heading/text bunched together with little breathing room). Scaled everything up and added spacing — `text-6xl` → `text-9xl` on "404", `text-xl` → `text-3xl` on the heading, body text `text-lg` with a `max-w-md` cap so it wraps into a readable paragraph instead of one long line, outer `gap-4` → `gap-8`, button `size="lg"`. Also swapped the second sentence — "ou foi movido" felt off ("foi movido" implied a redirect/alias that doesn't exist in this app) — keeping "O endereço acessado não existe." as the first sentence and replacing only what followed with the user's picked wording: **"O endereço acessado não existe. Verifique o endereço ou entre em contato com o administrador do sistema."** Verified visually via Playwright screenshot.
  **Revised again (same day, user feedback)**: scaling *everything* up (previous round) missed the actual ask — only the "404" number itself should stand out to grab attention, the rest of the page should read at a normal size. Dialed back: "404" `text-9xl` → `text-8xl` (still the clear visual anchor, just not as extreme), heading `text-3xl` → `text-2xl`, body copy dropped `text-lg` (back to default size), button dropped `size="lg"` (back to default), outer `gap-8` → `gap-6`. Verified visually via Playwright screenshot — "404" now reads as the one enlarged, attention-grabbing element instead of the whole page being oversized.
  **Revised a third time (same day, user feedback)**: `text-8xl` (previous round) didn't read as visibly bigger than before — Tailwind's default scale tops out at `text-9xl` (8rem/128px), too close to the prior size to register as a real change. Went past the built-in scale with an arbitrary value, `text-[11rem]` (176px, `leading-none` added so the taller glyph doesn't add extra vertical gap) — only the "404" span touched, heading/body/button left exactly as the previous round set them. Verified visually via Playwright screenshot — "404" now reads as clearly, deliberately larger.
- [X] T034k [P] Document the finished "Início" page content/layout in `research.md` #22 once its content is designed and T034j is extended past the blank-placeholder stage (depends on T034j). **Landed on (2026-09-21)**: decisão do dono do produto — nada de dashboard/atalhos/widgets, só o logo da Polícia Penal RS centralizado com "Sistema de Rotinas Penitenciárias" abaixo (mesmo par logo+nome de `LoginPage`/`AppShell`). `frontend/src/pages/HomePage/index.tsx` passou de `<div className="p-6" />` pra `flex flex-1 flex-col items-center justify-center`, preenchendo a área de conteúdo do `AppShell`. `tsc`/`eslint --max-warnings=0`/`vite build` verdes.

**Checkpoint**: Shared layout foundation and folder convention ready — Phase 4+ screens (movements, routines, staff, reports) reuse `AppShell` and follow the same folder-per-component convention instead of one-off page layouts

---

## Phase 4: User Story 2 - Registro de Movimentações Temporárias e Status em Tempo Real (Priority: P2)

**Goal**: Policiais penais registram saída/retorno de presos; status em tempo real filtrável por unidade/galeria/cela.

**Independent Test**: Registrar saída de um preso já cadastrado e, em seguida, seu retorno, verificando o status em cada etapa via `GET /api/v1/inmates/:id`.

### Tests for User Story 2

- [X] T035 [P] [US2] Backend unit tests for open-movement conflict (FR-010) and duplicate-return rejection (FR-009) in `backend/test/unit/movements.service.spec.ts`
- [X] T036 [P] [US2] Backend integration tests for `contracts/movements.md` temporary-movement flow + `Idempotency-Key` handling in `backend/test/integration/movements-temporary.spec.ts`

### Implementation for User Story 2

- [X] T037 [P] [US2] Seed/reference-data access for Movement Types in `backend/src/movements/movement-types.service.ts` (depends on T011). **Landed on**: also added a `GET /api/v1/movement-types` endpoint (`movement-types.controller.ts`) — not in the original contract table, but the web/mobile "registrar movimentação" forms need a way to populate a type picker instead of hardcoding ids; documented in `contracts/movements.md`.
- [X] T038 [US2] Implement `POST /api/v1/movements` with open-movement conflict check in `backend/src/movements/` (depends on T031, T037). Rejects non-`TEMPORARY` movement types with `400` (this endpoint is exit-only; `final/*` situações definitivas are US3/Phase 5). Reused `InmatesService.findEntityInScope`/`CellsService.findEntityInScope` (the former made `public`, was `private`) for scope checks instead of re-deriving them.
- [X] T039 [US2] Implement `PATCH /api/v1/movements/:id/return` with duplicate-return rejection in `backend/src/movements/` (depends on T038)
- [X] T040 [US2] Implement `Idempotency-Key` handling for offline-submitted movements in `backend/src/movements/` (depends on T038, T039). **Landed on**: `POST /movements` dedupes via the existing `movements.idempotency_key` column (returns `200` with the existing row instead of `201` on replay). `PATCH .../return` needed a *second*, dedicated `return_idempotency_key` column (new migration `1786896816132-AddMovementReturnIdempotencyKey`) — the exit's key already identifies the row, so a retried return needs its own key to be told apart from a genuine second (rejected, FR-009) return attempt; documented in `contracts/movements.md`.
- [X] T041 [US2] Extend Inmates status projection (FR-011, data-model.md `inmates.status`) updated transactionally on movement create/return in `backend/src/inmates/` (depends on T038, T039). **Landed on**: `inmates.status` itself is untouched by temporary movements (research.md #9's projection column is reserved for the US3 terminal states — RELEASED/ANKLE_MONITOR/TRANSFERRED — where it's genuinely transactional). "Fora da cela"/"na cela" is instead a derived-at-read `inMovement`/`currentMovement` pair on `InmateResponseDto`, computed by joining open `TEMPORARY` movements live (`InmatesService.openMovementByInmateId`, pre-existing pattern from US1 scaffolding, extended here to also return the open movement's id/type name/exit time instead of a bare boolean) — no second write path to keep in sync, no drift risk, and it already existed for `inMovement: boolean` before this task, so this task only added the richer `currentMovement` detail FR-011 asks for ("em rotina, em atendimento, em visita").
- [X] T042 [US2] Implement real-time status listing/filtering by unit/gallery/cell in `backend/src/inmates/inmates.controller.ts` (depends on T041). Added a `unitId` query param to `ListInmatesQueryDto`/`GET /inmates` (gallery/cell filters already existed from US1) so a WARDEN/SUPERVISOR scoped to multiple units can narrow the view to one.
- [X] T043 [P] [US2] Build mobile "registrar movimentação" + status screens using the offline queue in `mobile/src/screens/MovementRegister.tsx` (depends on T025, T040). **Landed on**: `InmatesLookup` rows are now pressable, navigating to the new `MovementRegister` screen (added to `RootStackParamList`) with the tapped `Inmate` + `cellId`; shows "Registrar saída" (type picker sourced from `features/movements/api.ts`'s `GET /movement-types`, cached to `AsyncStorage` for offline use — research.md #4) when the preso is in the cell, or the open movement's details + "Confirmar retorno" when already out. Every write goes through `enqueueMovement`/`enqueueReturn` (never a direct `apiClient` call) so the same code path works online or offline, then immediately kicks off a best-effort `syncPendingMovements()`. Extended the offline scaffolding (T025) to support returns, not just exits: `database.ts` gained a `pending_returns` table (mirrors `pending_movements`, its own idempotency key), `offline-queue.ts` gained `enqueueReturn`/`getPendingReturns`/`markReturnSynced`/`countPending`, `sync-service.ts` flushes movements then returns. Also wired `startOfflineSyncListener()` into `App.tsx` (defined in T025 but never actually called until now) plus a one-shot flush on app start, and added an amber "N movimentações pendentes de sincronização" banner on `InmatesLookup` (refetched on screen focus) — quickstart.md Cenário 7's "aparece na tela como pendente de sincronização" expectation.
- [X] T044 [P] [US2] Build web frontend real-time status/map view in `frontend/src/features/movements/StatusMap.tsx`, inside `AppShell` per Phase 3.5 (depends on T042, T034e). **Landed on**: no separate `StatusMap.tsx` page — Mapa da Unidade (`features/structure/index.tsx`/`GalleryCards`) already *is* the real-time status/map view (per-cela inmate list with unit/galeria filtering from Phase 3.5), and its "(fora da cela)" badge was already scaffolded ahead of this task waiting on `inMovement`. Adding a second, separate map page would fragment the one place officers already look. Instead: `frontend/src/features/movements/` (`api.ts`, `types.ts`, `components/MovementDialog/`) wires the existing no-op "Mover preso" icon button in `GalleryCards` to a real dialog — registers a temporary exit (type/destino/motivo, type list from the new `GET /movement-types`) when the preso is in the cell, or shows the open movement's details + a "Confirmar retorno" button when already out; success invalidates `['inmates', cellId]` so the list/badge update live with no reload. Unlike every other action on this screen, "Mover preso" is **not** WARDEN-gated (contracts/movements.md allows all 3 roles) — `InmateActionButton` was converted to a `forwardRef` component (same reason as `/configuracoes`'s `RowActionButton`, tasks.md T034h) so it can be `MovementDialog`'s `DialogTrigger asChild` child. The badge text now shows the open movement's actual type (`(Pátio)`) instead of a generic "(fora da cela)" when available. Verified live via Playwright as PRISON_OFFICER (not WARDEN, confirming the role gate): registered a Pátio exit on a real seeded preso → toast + badge appeared with no reload → registered the return → toast + badge cleared, button reverted to "Mover preso". `tsc -b`, `eslint --max-warnings=0`, `vite build` all green.
- [X] T045 [US2] Mobile offline-sync integration test (airplane mode → reconnect, no duplicates) per `quickstart.md` Cenário 7 in `mobile/tests/offline-sync.spec.ts` (depends on T043). **Landed on**: `mobile/` had no working Jest config at all before this (`jest`/`jest-expo` were installed as deps but package.json had no `"jest"` block) — added one (`preset: "jest-expo"`, `@/` path alias, `testMatch` scoped to `tests/**/*.spec.ts`) plus the missing `@types/jest` devDependency. The test mocks `services/api-client` and `offline/database` (in-memory fake replacing real `expo-sqlite`) so it exercises the actual ordering/idempotency logic in `sync-service.ts`/`offline-queue.ts`, not SQLite/network themselves: queuing offline doesn't call the API; reconnect syncs using the row's `Idempotency-Key` and a second sync pass never resends an already-synced item (movements and returns both, each with their own key); a failure mid-sync stops and preserves order for the next retry instead of skipping ahead. 4/4 passing.

**Checkpoint**: User Stories 1 AND 2 both work independently

---

## Phase 5: User Story 3 - Situações Definitivas (Priority: P3)

**Goal**: Registrar liberdade, tornozeleira, transferência e troca de cela definitiva, atualizando status e histórico de localização.

**Independent Test**: Registrar liberdade de um preso ativo (com alvará) e confirmar que o status muda e a cela é liberada.

### Tests for User Story 3

- [X] T046 [P] [US3] Backend integration tests for `contracts/movements.md` situações definitivas + `location-history` (incl. cell-capacity edge case) in `backend/test/integration/movements-final.spec.ts`

### Implementation for User Story 3

- [X] T047 [US3] Implement Cell History open/close tracking on cell change in `backend/src/inmates/cell-history.service.ts` (depends on T031). **Landed on**: also opens the very first entry at `InmatesService.create()` time (wrapped in a transaction) — otherwise there would be no open entry for a final/* situation to ever close, leaving `location-history` permanently incomplete for the initial cell. Close-only situations (liberdade/tornozeleira/transferência) keep `Inmate.currentCell` pointing at the last occupied cell as a historical marker instead of nulling it — `CellsService.occupancyOf` already filters by `status = ACTIVE`, so the cell is correctly freed without a schema change (Constitution VI).
- [X] T048 [US3] Implement `POST /api/v1/movements/final/release` in `backend/src/movements/` (depends on T047)
- [X] T049 [P] [US3] Implement `POST /api/v1/movements/final/ankle-monitor` in `backend/src/movements/` (depends on T047)
- [X] T050 [P] [US3] Implement `POST /api/v1/movements/final/transfer` in `backend/src/movements/` (depends on T047)
- [X] T051 [US3] Implement `POST /api/v1/movements/final/cell-change` with cell-capacity check in `backend/src/movements/` (depends on T047, T030). **Landed on**: all four `final/*` endpoints share one private `MovementsService.registerFinal()` transactional core (Movement insert + `inmates.status`/`currentCell` update + `CellHistoryService.closeAndMaybeOpen`, all in one `dataSource.transaction`), plus an explicit `AuditService.record()` call with the inmate's old/new status (contract's own wording — the generic `AuditInterceptor` always logs `oldData: null`), same precedent as `UsersService.deactivate`; controllers are `@SkipAutoAudit()` to avoid a second, less informative log. WARDEN-only per contract. Added 3 new seeded `PERMANENT` movement types (Tornozeleira eletrônica/Transferência/Troca de cela) alongside the existing Liberdade, in both `seed.ts` and `setup-test-db.ts`/`fixtures.ts`.
- [X] T052 [US3] Implement `GET /api/v1/inmates/:id/location-history` in `backend/src/inmates/` (depends on T047)
- [X] T053 [P] [US3] Build web frontend "registrar situação definitiva" screens in `frontend/src/features/movements/FinalSituations.tsx` (depends on T048–T051). **Landed on**: no separate `FinalSituations.tsx` page — same reasoning as T044 (Phase 3.5/US2's `StatusMap.tsx`): the already-scaffolded "Alterar situação" icon button in `GalleryCards` (Mapa da Unidade) is wired to a new `FinalSituationDialog` (`frontend/src/features/movements/components/FinalSituationDialog/`), one dialog that switches form by situation type (Liberdade/Tornozeleira/Transferência/Troca de cela), same single-dialog-multiple-shapes pattern as `InmateDialog`/`EntityDialog`/`MovementDialog` (`docs/style-guide.md` §5). Troca de cela adds a galeria→cela destination picker (cela Select filtered to `active && occupancy < capacity`) fed by the `galleries` list already loaded by `GalleryCards`, threaded down through `GalleryCard`/`CellRowInmates`. Verified live via Playwright as WARDEN: registered a troca de cela on a real seeded preso (Galeria C → Galeria B) — toast + both cells' occupancy updated live with no reload, preso moved off the old cell's row into the new one. `tsc -b`, `eslint --max-warnings=0`, `vite build` all green. **Superseded by T091/T092 below (research.md #35)** — "Troca de cela" as an option inside this dialog is being replaced by a dedicated flow.

### Redesign — Motivo/Observação genéricos + Troca/Permuta de Cela e Galeria (research.md #35, FR-008a/FR-015–FR-015c)

Revisão pós-implementação decidida com o usuário do projeto depois de T046–T053 já entregues: `reason`/`notes` viram os únicos campos livres em qualquer Movimentação (sem campo estruturado por tipo); liberdade/tornozeleira/transferência ficam estruturalmente idênticas; "troca de cela" vira quatro tipos (troca/permuta de cela, troca/permuta de galeria), com RBAC por perfil (não por cliente) e disponibilidade em mobile pela primeira vez em US3. Ver research.md #35 para o raciocínio completo, `contracts/movements.md` para os endpoints, `data-model.md` para o schema.

#### Tests

- [X] T079 [P] [US3] Backend integration tests for `contracts/movements.md` cell-change/cell-swap/gallery-change/gallery-swap + `GET /cells/:id/occupant` (incl. capacity edge case for troca/troca de galeria, RBAC 403 for PRISON_OFFICER on gallery-*, race-condition 409 for swap on a destination that stopped being occupied) in `backend/test/integration/movements-cell-transfer.spec.ts`. **Landed on**: also split the old `movements-final.spec.ts` — its "Troca de cela definitiva" describe block moved here (the endpoint it tested no longer exists); `location-history` test there updated to call `cell-change`.

#### Backend — schema e tipos

- [X] T080 [US3] Migration: add `movements.paired_movement_id` (nullable self-FK to `movements.id`, unique when set) in `backend/src/database/migrations/` (depends on T079)
- [X] T081 [P] [US3] Update `Movement` entity (`pairedMovement` self-relation) and `CellHistoryReason` enum (`RELEASE`/`ANKLE_MONITOR`/`TRANSFER`/`CELL_CHANGE`/`CELL_SWAP`/`GALLERY_CHANGE`/`GALLERY_SWAP`, replacing the old single `CELL_CHANGE`) in `backend/src/movements/entities/movement.entity.ts` / `backend/src/inmates/entities/inmate-cell-history.entity.ts` (depends on T080)
- [X] T082 [P] [US3] Update seed data with new `MovementType`s (Troca de cela, Permuta de cela, Troca de galeria, Permuta de galeria — all `PERMANENT`) in `backend/src/database/seeds/seed.ts` and `backend/test/integration/setup-test-db.ts`/`fixtures.ts`

#### Backend — implementação

- [X] T083 [US3] Simplify `FinalReleaseDto`/`FinalAnkleMonitorDto`/`FinalTransferDto` — drop `destinationLocation` from transfer, all three become identical (`reason`/`notes`/`exitDateTime`) in `backend/src/movements/dto/` (depends on T081)
- [X] T084 [US3] Remove `POST /movements/final/cell-change` (superseded by T085–T088) in `backend/src/movements/movements.controller.ts`/`movements.service.ts` (depends on T083)
- [X] T085 [P] [US3] Implement `POST /api/v1/movements/cell-change` (FR-015) — any role, capacity-checked — in `backend/src/movements/` (depends on T084)
- [X] T086 [P] [US3] Implement `POST /api/v1/movements/cell-swap` (FR-015a) — any role, two paired `Movement` rows, `409` if destination stopped being occupied by an `ACTIVE` inmate — in `backend/src/movements/` (depends on T084)
- [X] T087 [P] [US3] Implement `POST /api/v1/movements/gallery-change` (FR-015b) — SUPERVISOR/WARDEN only, capacity-checked — in `backend/src/movements/` (depends on T084)
- [X] T088 [P] [US3] Implement `POST /api/v1/movements/gallery-swap` (FR-015c) — SUPERVISOR/WARDEN only, two paired `Movement` rows — in `backend/src/movements/` (depends on T084)
- [X] T089 [P] [US3] Implement `GET /api/v1/cells/:id/occupant` in `backend/src/cells/` (depends on T081). **Landed on**: response body serialized manually via `res.json()` — a handler that just `return`s `null` gets Nest's "empty body" shortcut instead of the JSON literal `null`, breaking the documented contract. **Removed in T100 below (research.md #36)** — a shared cell can have more than one ACTIVE occupant, so "the" occupant is ambiguous; superseded by listing all occupants via the existing `GET /inmates?cellId=&status=ACTIVE` and letting the user pick.
- [X] T090 [US3] Make `CreateMovementDto.reason` required (FR-008a) — update `POST /movements` (US2) and its existing tests (`backend/test/integration/movements-temporary.spec.ts`) in `backend/src/movements/dto/create-movement.dto.ts`. **Landed on**: `registerChange`/`registerSwap` (T085–T088) re-fetch origin/destination cells via `CellsService.findEntityInScope` instead of trusting `inmate.currentCell` directly — `InmatesService.findEntityInScope` only `leftJoin`s (not `leftJoinAndSelect`) the cell's gallery for its own scope filter, so `inmate.currentCell.gallery` is never hydrated on the returned entity; comparing galleries off it crashed with a 500. Verified: `tsc -b`, `eslint --max-warnings=0`, `nest build`, full unit (14) + integration (47) suites all green.

#### Frontend web

- [X] T091 [US3] Simplify `FinalSituationDialog` — drop the "Troca de cela" option and its galeria/cela picker; Liberdade/Tornozeleira/Transferência become one uniform `reason`/`notes` form in `frontend/src/features/movements/components/FinalSituationDialog/` (depends on T083). **Landed on**: also made `CreateMovementDto`/`MovementDialog` (US2 "Mover preso") require `reason` in the UI (`canSubmit`), matching the now-required backend field (T090).
- [X] T092 [P] [US3] Build `CellTransferDialog` — card selector (Troca de cela / Permuta de cela / Troca de galeria / Permuta de galeria, filtered to the current user's role) wired to a new third row action in `GalleryCards`; permuta flow queries `GET /cells/:id/occupant` to show the destination's current occupant before confirming — in `frontend/src/features/movements/components/CellTransferDialog/` (depends on T085–T089). **Landed on**: `GalleryCards` now threads the *full* (unfiltered) `galleries` list down (not just the ones matching the current search), so troca/permuta de galeria can target any gallery in the unit; `INMATE_ROW_GRID`'s action column widened (`4.5rem` → `7rem`) for the third button. Verified live via Playwright as WARDEN: registered a troca de galeria on a real seeded preso (Galeria A → Galeria C) — toast + both galleries' occupancy updated live with no reload; confirmed `FinalSituationDialog` now shows only 3 options. `tsc -b`, `eslint --max-warnings=0`, `vite build` all green.

#### Mobile — primeira tela de US3 (troca/permuta de cela são acessíveis ao Policial Penal)

- [X] T093 [P] [US3] Build mobile "Trocar de cela" entry point — row action between "Detalhes" and "Saída" on the inmate list — plus a type-selection screen (2 cards: Troca de cela / Permuta de cela — gallery variants never show on mobile, FR-015b/FR-015c are web-only) in `mobile/src/features/movements/screens/CellTransferSelect/` (depends on T085, T086). **Landed on**: `RootStackParamList.Inmates` (and `CellsScreen`'s navigation into it) gained a `galleryId` field — it only carried `galleryCode` (string) before, but troca/permuta de cela need the numeric id to query `structureApi.listCells(galleryId)`. Third `InmateRow` action is icon-only (`Shuffle`, outline/neutral) between "Detalhes" and the movement button — three full-text buttons side by side didn't fit the row.
- [X] T094 [P] [US3] Build mobile Troca de cela screen (single-inmate flow, destination cell picker within the same gallery) in `mobile/src/features/movements/screens/CellChange/` (depends on T093)
- [X] T095 [P] [US3] Build mobile Permuta de cela screen (choose destination cell → show occupant via `GET /cells/:id/occupant` → confirm) in `mobile/src/features/movements/screens/CellSwap/` (depends on T093). **Landed on**: added `movementsApi.cellChange`/`cellSwap`/`cellOccupant` (mobile) and registered the 3 new screens in `RootNavigator`. **Verification note**: this Linux/WSL sandbox's `mobile/node_modules` is incomplete pre-existing (`lucide-react-native`, `@rn-primitives/*`, `nativewind` unresolved — affects every file, not just these, and breaks `tsc --noEmit`/`jest` project-wide) — `npm run lint` passes clean, but full typecheck/on-device verification was not possible here; per the user, that happens on a separate Windows-side instance. **Redesigned in T100 below.**

#### Correções pós-implementação #2 (revisão do usuário sobre T091–T095, research.md #36–#39)

Segunda rodada de revisão pós-implementação — o usuário testou o Mapa da Unidade e o fluxo de
troca/permuta na web e reportou bugs/ajustes um de cada vez. Todas as tasks abaixo já entregues e
verificadas na web (Playwright) e no backend (suítes de integração/unitárias); mobile ainda
pendente de validação manual (T104).

- [X] T096 [US3] Fix: listagem de presos de uma cela não filtrava `status=ACTIVE` — presos com
  situação definitiva já registrada (liberado/tornozeleira/transferido/óbito) continuam com
  `currentCellId` apontando pra última cela (timeline de FR-016) e apareciam na lista junto com os
  ativos, embora a ocupação numérica (`X/Y`) já fosse calculada só com `ACTIVE` e estivesse
  correta — a UI simplesmente mostrava mais presos do que a ocupação informada, parecendo um bug
  de contagem. Corrigido em `frontend/src/features/structure/components/GalleryCards/index.tsx`
  (web, `CellRowInmates`) e `mobile/src/features/structure/api.ts` (`structureApi.listInmates`).
- [X] T097 [P] [US3] `CellTransferDialog`: os 4 cards de tipo (troca/permuta cela/galeria) ficam
  desabilitados com badge "Indisponível" + tooltip explicando o motivo quando não há destino
  possível pro tipo (nenhuma cela com vaga, ou nenhuma cela ocupada, na galeria atual/demais
  galerias) — evita abrir o formulário e só descobrir no select vazio, que parecia bug. Checagem
  reaproveita as mesmas queries `['cells', galeriaId]` já cacheadas pelo Mapa da Unidade.
- [X] T098 [P] [US3] `CellTransferDialog`: select "Galeria de destino" (troca/permuta de galeria)
  filtrado só às galerias que de fato têm uma cela elegível pro tipo escolhido (com vaga pra
  troca, ocupada pra permuta) — antes listava todas as galerias da unidade, inclusive as sem
  destino possível.
- [X] T099 [US3] Bloqueio de troca/permuta/situação definitiva quando o preso tem movimentação
  `TEMPORARY` em aberto (research.md #38) — `MovementsService.assertNoOpenTemporaryMovement()`
  chamado em `registerFinal` (cobre `final/*`, `cell-change`, `gallery-change`) e `registerSwap`
  (`cell-swap`/`gallery-swap`, nos dois presos), `409` em `backend/src/movements/movements.service.ts`.
  Espelhado na UI: botões "Trocar de cela"/"Alterar situação" desabilitados com tooltip em
  `GalleryCards` (web); botão "Trocar de cela" esmaecido + toast de aviso ao toque (sem tooltip no
  mobile) em `InmatesScreen` (`mobile/src/features/structure/screens/InmatesScreen/`). Testes de
  integração novos cobrindo os 3 pontos de entrada em `movements-cell-transfer.spec.ts` e
  `movements-final.spec.ts`.
- [X] T100 [US3] `destinationInmateId` obrigatório em permuta (research.md #36) — cela
  compartilhada pode ter mais de um preso `ACTIVE`, então "quem está na cela" sozinho não
  identifica ninguém pra troca; `GET /cells/:id/occupant` (T089) removido, substituído por
  `GET /inmates?cellId=&status=ACTIVE` (já existente) pra listar todos os candidatos.
  `CellTransferDto` ganha `destinationInmateId`, validado em `registerSwap`
  (`backend/src/movements/movements.service.ts`, `409` se o preso não estiver mais `ACTIVE`
  naquela cela). Web (`CellTransferDialog`) e mobile (`CellSwap`, novo componente `InmateOption`)
  passam a listar os ocupantes ativos da cela de destino e exigir escolha explícita — inclusive
  com 1 candidato só, eliminando a ambiguidade por completo. Candidato com `inMovement=true`
  aparece na lista mas bloqueia o Confirmar (mesma regra de T099). Testes de integração novos:
  permuta contra cela com múltiplos ocupantes troca com o escolhido (não "qualquer um"), `400` sem
  `destinationInmateId`, `409` de condição de corrida.
- [X] T101 [US3] Fix de layout: nome do preso ficava com 0px de largura (invisível, não truncado)
  em viewports em torno de 945px — `GalleryCards` só vira 2 colunas a partir de `lg` (1024px, não
  mais `md`), indentação da lista de presos reduzida de `ml-10 mr-16` pra `ml-6 mr-6`, e
  `INMATE_ROW_GRID`/`CELL_ROW_GRID` passam a `minmax(0,1fr)` em vez de `1fr` cru (research.md #37).
- [X] T102 [US3] Polimento de UI (research.md #39, web only): título dos modais de movimentação
  (`CellTransferDialog`/`FinalSituationDialog`/`MovementDialog`) redesenhado — `DialogTitle` com a
  ação, `DialogDescription` com ícone + nome do preso, sem travessão; nome do preso sempre em
  maiúsculo em toda exibição web (lista de presos, cabeçalhos de modal, combobox); select de
  "Preso de destino" da permuta virou combobox com busca (`Popover`+`Command`/cmdk, componentes
  shadcn novos — `command`, `popover`, `docs/style-guide.md` atualizado), com fix do filtro fuzzy
  padrão do cmdk (trocado por substring simples) e estilo global de barra de rolagem
  (`frontend/src/index.css`) nos tokens de cor do tema.
- [X] T103 [US3] Seed manual de dados de teste (não é código — via API, script descartável) na
  Galeria D: reativada (estava inativa/sem celas), 5 celas ("1"–"5", capacidade 10), 48 presos
  (4 celas cheias + 1 com 8/10) com nome/sobrenome/matrícula/nascimento completos, pra testar
  troca/permuta com volume real de candidatos. **Decisão do usuário (2026-09-06)**: Galeria D
  permanece ativa como dado de exemplo permanente — não é revertida/desativada após os testes.
- [X] T104 [US3] Validar manualmente no mobile (instância Windows, fora deste sandbox Linux/WSL —
  mesma limitação de T095) as mudanças de T096/T099/T100 acima: `InmatesScreen` (lista da cela só
  ACTIVE; botão "Trocar de cela" esmaecido + toast quando `inMovement`), `CellSwap`/Permuta de
  cela (novo picker `InmateOption` entre os ocupantes da cela de destino; candidato `inMovement`
  aparece mas bloqueia Confirmar), e um smoke test de `CellChange`/Troca de cela (não alterada
  nesta rodada, mas compartilha navegação/tipos com as telas acima). **Validado (2026-09-06)** —
  troca de cela, permuta de cela e o filtro `ACTIVE` testados de ponta a ponta no app mobile real,
  tudo OK. A validação encontrou dois bugs novos, corrigidos na mesma rodada
  (`mobile/src/features/structure/screens/CellsScreen/viewmodel.ts`,
  `mobile/src/features/structure/screens/InmatesScreen/viewmodel.ts`, commit `eb61515`):
  (1) o card de cela em `CellsScreen` não atualizava o label/ocupação após uma troca (só após
  sair de Galerias e voltar) — `useQuery(['cells', galleryId])` nunca era invalidada ao focar a
  tela, diferente do padrão já usado em `InmatesScreen`; corrigido com o mesmo `useFocusEffect`
  de invalidação. Na permuta o bug não aparecia por coincidência (ocupação de origem/destino não
  muda numa troca 1-por-1). (2) o contador "X/Y presos" no cabeçalho de `InmatesScreen` vinha de
  `route.params.occupancy`, congelado no valor de quando a tela foi empilhada (native-stack não a
  desmonta ao voltar de uma troca); trocado para ler `inmatesQuery.data?.total` (contagem viva,
  já filtrada por `ACTIVE`, mesmo critério de `CellsService.occupancyOf` no backend).
  Aproveitando a validação, também foi feito um polimento de layout em `InmateRow`
  (`mobile/src/features/structure/screens/InmatesScreen/components/InmateRow/index.tsx`, mesmo
  commit) a pedido do usuário: o botão "Detalhes" (que dividia a linha de ações com o ícone de
  troca de cela e ficava apertado) virou um ícone de olho sobreposto no canto do avatar; o botão
  de troca de cela deixou de ser ícone-só (`Shuffle`) e passou a ocupar o lugar de "Detalhes" —
  mesmo estilo `outline` dourado, texto "Trocar cela" — deixando a linha de ações com só dois
  botões (Trocar cela / Saída-Retorno).

**Checkpoint**: User Stories 1–3 all work independently

---

## Phase 6: User Story 4 - Gestão de Rotinas Operacionais (Priority: P4)

**Goal**: Chefia cria rotinas e define padrões; Supervisor ajusta horários e ativação por dia.

**Independent Test**: Criar uma rotina "Pátio" com horário fixo para uma galeria e confirmar que aparece na programação do turno; desativá-la para um dia específico e confirmar que some apenas nesse dia.

### Tests for User Story 4

- [X] T054 [P] [US4] Backend integration tests for `contracts/routines.md` (incl. 403 on `locked` routine edited by Supervisor) in `backend/test/integration/routines.spec.ts`

### Implementation for User Story 4

- [X] T055 [P] [US4] Implement Routines module (Controller/Service/Repository/DTOs) in `backend/src/routines/`. **Landed on**: `Routine`/`RoutineSchedule` entities already existed from Phase 2 (T010); added a new `RoutineDateOverride` entity (`routine_date_overrides`, migration `AddRoutineDateOverrides`) not in the original `docs/srp_spec_database_model.md` — needed to make `PATCH .../activation`'s "ativar/desativar para uma data específica" (contracts/routines.md) win over `Routine.active` for exactly one calendar date without touching the routine's own default or its weekday-recurring schedules. Also implemented `DELETE /routines/:id` (WARDEN, `409` if `locked`) — in the contract table but not its own task line; folded into this one since it's part of the same module scaffold.
- [X] T056 [US4] Implement Rotina Horários sub-resource (multiple schedules per day/routine) in `backend/src/routines/` (depends on T055). **Landed on**: `RoutineScheduleItemDto` (`weekday`/`time`/`active`) reused by both `POST /routines` (initial schedules) and `PATCH .../schedule` (full replace — delete-all-then-reinsert in a transaction).
- [X] T057 [US4] Implement `POST /api/v1/routines` (WARDEN only, `locked` flag) in `backend/src/routines/` (depends on T056)
- [X] T058 [US4] Implement `PATCH /routines/:id/schedule` and `/activation` with blocked-routine guard in `backend/src/routines/` (depends on T057). WARDEN can always edit even when `locked=true`; only `SUPERVISOR` gets `403` on a locked routine (contracts/routines.md).
- [X] T059 [US4] Implement `GET /api/v1/routines` with shift/gallery filter in `backend/src/routines/` (depends on T056). **Landed on**: `Routine` has no `shift` concept of its own (only weekday/time via `RoutineSchedule`) — `shift=today` from the contract's own example is accepted as a literal alias for "use today's date" (already the default), and an additional `date=YYYY-MM-DD` param lets a caller check any specific day (needed by quickstart.md Cenário 4's "nos demais dias, lista normalmente" check). Only routines with a schedule matching that date's weekday AND an effective active state of `true` (override for that date, else the routine's stored `active`) are returned; `active`/`schedules` on the list response reflect that per-date resolution, not the raw stored defaults.
- [X] T060 [P] [US4] Build web frontend Rotinas management screens in `frontend/src/features/routines/` (depends on T057, T058). **Landed on**: `/rotinas` route (nav item already existed in `AppShell`, unwired until now), filter bar (Unidade/Galeria selects + a "Data" date input, defaulting to today — style-guide.md §4 pattern) driving one `Card`+`Table` (Nome/Tipo/Horários/Padrão/Ações). No PATCH exists for a routine's own base fields (name/type/description/locked) — only `/schedule` and `/activation` — so `RoutineDialog` is create-only (`docs/style-guide.md`'s create-and-edit-in-one-form convention doesn't apply here, unlike `EntityDialog`/`InmateDialog`); `ScheduleDialog` and `ActivationDialog` are separate per-row dialogs matching those two endpoints, and `DeleteRoutineAlert` is a real hard-delete confirmation (not the soft `active:false` pattern used for Unit/Gallery/Cell — Rotina has no such persisted state). Schedule/activation action buttons are pre-disabled with a tooltip when `routine.locked && user.role === 'SUPERVISOR'`, mirroring the backend's own 403 rule instead of letting the request round-trip just to fail. Added the `checkbox` shadcn primitive (`npx shadcn@latest add checkbox`, first real use in the codebase — needed a genuine boolean toggle for "Definir como rotina padrão" in `RoutineDialog`, not a fake-toggle Badge like `EntityDialog`'s one-way reactivate). Verified live via Playwright as WARDEN: create → edit schedule (live update, no reload) → deactivate for one specific date → confirmed the row disappears from that date's filtered view and reappears on any other date (proves the deactivation is scoped per-date, not to the routine's base `active`) → delete. 0 console errors across every step. `tsc -b`, `eslint --max-warnings=0`, `vite build` all green.
- [X] T061 [P] [US4] Build mobile "rotinas do turno" read-only screen in `mobile/src/screens/ShiftRoutines.tsx` (depends on T059). **Landed on**: folder-per-component convention (research.md #27) put it at `mobile/src/features/routines/screens/ShiftRoutines/` instead of the literal path in this task's description — same override already applied to every other mobile screen since T093. New "Rotinas" `OptionCard` on `HomeScreen` (alongside "Selecionar Unidade"/"Movimentação"/"Perfil") navigates to it with the globally-selected `unitId` (`UnitContext`, research.md #29) — falls back to `SelectUnit` first if none chosen yet, same guard as `goToMovement`. Screen shows the unit's galleries as a horizontal chip row (new `GalleryChip` component — no existing chip/segmented-control pattern in the codebase to reuse) defaulting to the first gallery, with today's routines for the selected gallery listed below (`RoutineListItem`, `CellCard`-style row). Read-only by design (contracts/routines.md restricts write endpoints to web-reachable roles/flows) — no create/edit/activation UI on mobile. **Update (research.md #46)**: cards now show schedules on a single truncated line (uniform height) and open a new read-only `RoutineDetail` screen (description, general info, up to 3 schedules with independent scroll). **Verification note**: same pre-existing Linux/WSL sandbox limitation as T095 (`mobile/node_modules` incomplete — `lucide-react-native`, `@rn-primitives/*`, `nativewind`, `expo-linear-gradient` types unresolved project-wide, breaking `tsc --noEmit`/`jest` for every file, old and new) — `npm run lint` passes clean; full typecheck/on-device verification deferred to the separate Windows-side instance per the user's established workflow for this project.

### Correções pós-implementação (revisão do usuário sobre T060, research.md #41)

Usuário testou a tela `/rotinas` manualmente e reportou 5 pontos; 2 eram bugs reais, 3 eram falta de
clareza na UI (respondidos e corrigidos abaixo, sem task numerada própria — mesmo padrão de US3's
"Correções pós-implementação").

- Bug: `ActivationDialog`'s "Status nesta data" `Select` estava fixo em "Inativa" por padrão,
  independente do estado real da rotina — fazia parecer que toda rotina nascia desativada. Corrigido
  para partir de `routine.active` (uma rotina nova é `active: true` por padrão; desativar por data é
  a exceção pontual, não o estado inicial).
- Bug: coluna "Ações" tinha os ícones desalinhados com o cabeçalho (`flex items-center gap-1`
  faltava `justify-center`, mesmo bug já corrigido em `/configuracoes` no research.md #39-round7).
  Corrigido.
- Falta de clareza: coluna "Padrão" sozinha não explicava o que `locked=true` bloqueia (edição por
  Supervisor E exclusão por qualquer perfil) — adicionado "?" tooltip no cabeçalho, mesmo padrão
  já usado em `/configuracoes` (research.md #39-round3).
- Falta de clareza: não havia como ver se uma rotina está ativa/inativa numa data — `GET /routines`
  simplesmente omitia rotinas inativas da data consultada (correto pra consulta somente-leitura do
  mobile, ruim pra gestão: a linha sumia sem explicação). Novo parâmetro `includeInactive=true`
  (`backend/src/routines/`) faz a tela web listar todas as rotinas da galeria com o status real por
  data, e uma nova coluna "Status" (badge Ativa/Inativa) exibe isso.
- Pedido de UX: ícone de "Editar horários" era um relógio isolado, pouco claro como ação de edição —
  virou relógio + lápis sobreposto (`EditScheduleIcon`, `frontend/src/features/routines/index.tsx`).
- Todos os 5 pontos verificados via Playwright (WARDEN): criar rotina → confirmar Status "Ativa" por
  padrão no diálogo de ativação → desativar numa data futura → confirmar que a linha continua
  visível nessa data com badge "Inativa" (não some mais) → volta pra "Ativa" em outra data → excluir.
  0 erros de console. Backend: 10/10 testes de integração de `routines.spec.ts` (incl. novo caso
  `includeInactive=true`), lint/build/unit/integration completos verdes.

**Rodada 2** (mesmo dia, `research.md` #42): campo de hora nativo (`<input type="time">`) trocado por
`TimeInput` (máscara + validação, "HORA INVÁLIDA" abaixo do campo), campo de data nativo continuou
`<input type="date">` mas ganhou `DateInput` (`showPicker()` em qualquer clique, não só no ícone),
`color-scheme: dark` + espaçamento do botão "Adicionar horário" ajustado. Verificado via Playwright,
0 erros de console — exceto o popup do calendário nativo continuar renderizando claro no Chromium
automatizado apesar do `color-scheme` correto (sinalizado como possível limite do ambiente de teste,
a confirmar num Chrome/Edge real).

**Rodada 3** (mesmo dia, revisão do usuário sobre a Rodada 2, `research.md` #43): usuário confirmou
que o fundo escuro do calendário funcionou no navegador real dele, mas reportou 4 pontos novos —
todos corrigidos:
- Cor de destaque do calendário (dia selecionado/botões) ainda azul (padrão do navegador), devia ser
  dourada — `accent-color: hsl(var(--primary))` adicionado globalmente (`body`, `@layer base`),
  propriedade herdada que também tinge checkbox/radio/range nativos, não só o calendário.
- Campo de data ainda aceitava digitação manual mesmo já podendo escolher pelo calendário — `DateInput`
  ganhou um `onKeyDown` que bloqueia toda tecla exceto Tab (navegação) e Enter/Espaço (abre o
  calendário, mesmo efeito do clique); o valor só muda pela seleção no calendário.
- Mensagem "HORA INVÁLIDA" (tudo maiúsculo, o usuário explicou que era só ênfase na própria
  mensagem pra mim, não um requisito de design) — trocada por "Hora inválida." e restilizada pra
  seguir exatamente o padrão já usado em `LoginPage` (`text-sm text-destructive`, sem borda vermelha
  no input), em vez do estilo inventado (`text-xs font-medium` + borda) da primeira versão.
- Horário sempre exibido com segundos vindos do backend (`HH:mm:ss`, round-trip da coluna TIME do
  Postgres) — `toHHMM()` (`frontend/src/features/routines/time.ts`) descarta os segundos em toda
  exibição (tabela "Horários", prefill do `ScheduleDialog`).
- Pedido adicional, mesma rodada: "ao clicar [no campo de hora], deixe a máscara fixa" — `TimeInput`
  reescrito do zero: em vez de reformatar uma string digitada livremente, mantém uma máscara
  `__:__` sempre visível, cada dígito digitado preenche o próximo espaço em branco via `onKeyDown`
  (Backspace/Delete limpa o último preenchido), texto colado ou letras são ignorados — máscara de
  verdade, não mais heurística de string.
- Todos os pontos verificados via Playwright: máscara preenchendo dígito a dígito, backspace
  limpando da direita pra esquerda, colar texto sendo rejeitado, "Hora inválida." no estilo correto,
  data rejeitando digitação mas aceitando seleção via calendário (inclusive por teclado dentro do
  popup), sem segundos em nenhuma exibição. Cor dourada do calendário: `accent-color` computado
  corretamente (confirmado via `getComputedStyle`), mas o popup nativo do Chromium automatizado
  continuou mostrando azul — mesma limitação de ambiente de teste da Rodada 2, não algo corrigível
  do lado da aplicação; usuário deve reconfirmar no navegador real (onde o fundo escuro já
  funcionou). 0 erros de console em toda a rodada. `tsc`/`eslint --max-warnings=0`/`vite build`
  verdes.

**Rodada 4** (mesmo dia, `research.md` #44): usuário testou no navegador real e o dia selecionado
continuou azul mesmo com `accent-color` direto no elemento (não era questão de herança — esse
navegador simplesmente não aplica a propriedade ao popup nativo). Sem mais alavanca de CSS,
decisão do usuário: trocar o `<input type="date">` nativo por um calendário customizado de
verdade. `npx shadcn@latest add calendar` (`react-day-picker@^10` + `date-fns@^4`) — novo
`DatePicker` (`Popover` + `Calendar`, `frontend/src/features/routines/components/DatePicker/`)
substitui `DateInput` (removido) nos dois campos de data da Fase 6. Cores do tema já vêm certas por
padrão (o `Calendar` do shadcn usa `bg-primary`/`text-primary-foreground`, DOM/CSS normal, sem
depender de nenhuma propriedade nativa do navegador), `locale={ptBR}` garante mês/dias da semana em
português, e o campo virou um botão (nunca mais um campo de texto — sem superfície de digitação
nenhuma). Verificado via Playwright, 9/9 itens passando (popup é DOM real, português confirmado,
dia selecionado dourado via `getComputedStyle`, seleção por clique funcionando, nenhuma digitação
possível, fluxo completo criar→ativar→excluir sem erros de console). `tsc`/
`eslint --max-warnings=0`/`vite build` verdes. `docs/style-guide.md` atualizado com o novo
componente e a regra de preferir `Popover`+`Calendar` a `<input type="date">` nativo.

**Checkpoint**: User Stories 1–4 all work independently

---

## Phase 7: User Story 5 - Controle de Efetivo (Priority: P5)

**Goal**: Supervisor cadastra escalas de serviço, registra presença/faltas e consulta efetivo mínimo.

**Independent Test**: Criar uma escala para um policial em turno/data/setor e confirmar que aparece no relatório de efetivo desse turno.

### Tests for User Story 5

- [X] T062 [P] [US5] Backend integration tests for `contracts/staff.md` (incl. schedule uniqueness conflict, and `PATCH /staff/minimum-staffing-config` 403-for-non-WARDEN + persistence, `/speckit-analyze` finding G1-round2) in `backend/test/integration/staff.spec.ts`
- [X] T062a [P] [US5] Backend integration tests for Postos de serviço (`POST`/`PATCH`/`GET /api/v1/posts`: WARDEN-only writes, `403` for SUPERVISOR, unique name per unit, deactivation) in `backend/test/integration/posts.spec.ts` (FR-022a, research.md #47)

> **Revisão 2026-09-21 (feedback do usuário ao testar a US5)**: só há dois turnos (diurno/noturno); a carga horária é do dia e obrigatória na escala; "setor" virou "posto de serviço", entidade própria cadastrada só pelo Diretor (research.md #47). T062/T064/T065a/T065b/T066/T067 foram ajustados e T062a/T064a/T067a acrescentados. Segunda revisão (mesmo dia): escala do dia numa única chamada com um posto por turno e falta descontando do efetivo (research.md #48).

### Implementation for User Story 5

- ~~T063~~ **Removed** (`/speckit-analyze` finding D2, round 3) — redundant with T020a: `GET /api/v1/users?role=&unitId=` (used for the `PRISON_OFFICER` roster, FR-021) is already part of T020a's own contract in `contracts/structure.md`, not a separate increment. No separate Staff entity/module exists (research.md #15).
- [X] T064 [US5] Implement Schedules (escalas) with `(user, date, shift)` uniqueness constraint, referencing `User` directly, in `backend/src/staff/` (depends on T020a)
- [X] T064a [US5] Implement Posts module (`ServicePost` entity, `/api/v1/posts`) in `backend/src/posts/` and migration `AddPostsAndWorkload` (posts table; `post_id` + `workload_hours` on schedules; `post_id` on minimum staffing config; DAY/NIGHT shifts; data-preserving) — FR-022a/FR-022b, research.md #47
- [X] T065 [US5] Implement `PATCH /schedules/:id/attendance` (presença/falta) in `backend/src/staff/` (depends on T064)
- [X] T065a [P] [US5] Implement `MinimumStaffingConfig` repository/service backed by `minimum_staffing_config` table in `backend/src/staff/` (FR-024, research.md #12, `/speckit-analyze` finding G2; depends on T011)
- [X] T065b [US5] Implement `PATCH /api/v1/staff/minimum-staffing-config` per `contracts/staff.md`, restricted to `WARDEN` only, in `backend/src/staff/` (depends on T065a, T019)
- [X] T066 [US5] Implement `GET /schedules/minimum-staffing` report reading configured minimums from `minimum_staffing_config` (no hardcoded default) in `backend/src/staff/` (depends on T064, T065a)
- [X] T067 [P] [US5] Build web frontend Efetivo/Escalas screens, including minimum-staffing configuration form for `WARDEN`, in `frontend/src/features/staff/` (depends on T065, T065b, T066)
- [X] T067a [US5] Build web Postos de Serviço screen (WARDEN-only create/rename/deactivate/reactivate) in `frontend/src/features/staff/posts/`, plus `Posto` and required `Carga horária do dia` fields in Nova escala (FR-022a/FR-022b)

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
- **UI/UX Design System (Phase 3.5)**: Depends on US1 (Phase 3) completion — frontend-only, doesn't touch `backend/`, so it does NOT block starting US2's backend tasks (T035–T042) in parallel; it BLOCKS US2's frontend task (T044), which should reuse `AppShell`
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
