# Implementation Plan: Gestão de Rotinas Penitenciárias (SRP)

**Branch**: `001-gestao-rotinas-presos` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-gestao-rotinas-presos/spec.md`, technical direction from `docs/srp_plan.md`, and database model from `docs/srp_spec_database_model.md`.

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Substituir o controle em papel das rotinas operacionais do sistema prisional do RS por um sistema digital auditável composto de uma API REST NestJS/TypeORM/PostgreSQL, um front-end web React/Vite para Supervisor e Chefia/Diretor, e um aplicativo React Native/Expo com suporte offline para Policiais Penais. A abordagem técnica segue estritamente `docs/srp_plan.md`: autenticação JWT + RBAC por perfil e por unidade, auditoria automática e imutável de toda operação de escrita, migrations exclusivas via TypeORM, e módulos com separação Controller/Service/Repository conforme a Constituição do projeto.

## Technical Context

**Language/Version**: TypeScript (modo strict) em todo o stack — Node.js LTS no backend, React 18+ no frontend, React Native (Expo SDK atual) no mobile.

**Primary Dependencies**: Backend: NestJS, TypeORM, `@nestjs/typeorm`, `pg` (driver PostgreSQL), `@nestjs/jwt` + Passport, Argon2 (hash de senha), `@nestjs/throttler`, Helmet, `@nestjs/swagger`. Frontend web: Vite, TailwindCSS, shadcn/ui, TanStack Query, React Hook Form, Zod. Mobile: Expo, React Navigation, cliente HTTP com fila de sincronização offline.

**Storage**: PostgreSQL, acessado exclusivamente via TypeORM (Repository pattern nativo do NestJS, `@InjectRepository` por módulo); entities espelham `docs/srp_spec_database_model.md`; toda alteração de schema via migrations TypeORM geradas por `typeorm migration:generate` (nenhuma alteração manual no banco).

**Testing**: Backend — Jest (padrão NestJS) para testes unitários de services/controllers e Supertest para testes de integração de endpoints. Frontend web — Vitest + React Testing Library para componentes e fluxos principais. Mobile — Jest + React Native Testing Library para lógica de fila offline e telas críticas.

**Target Platform**: Backend como serviço Linux (containerizado); frontend web em navegadores modernos; mobile em iOS e Android via Expo.

**Project Type**: Web application (backend REST + frontend web) + aplicativo mobile dedicado — três projetos compartilhando um único backend/API.

**Performance Goals**: Registro de movimentação em até 30s (SC-001); consulta de status de preso em até 5s (SC-003); sistema responsivo com ao menos 200 usuários simultâneos durante troca de turno (SC-004).

**Constraints**: App mobile MUST operar offline para registro de movimentações, com fila local e sincronização automática sem perda/duplicação (FR-011a); toda rota protegida por autenticação e autorização (RBAC + escopo por unidade, FR-004a); logs de auditoria imutáveis (FR-026/FR-027); TypeScript strict sem `any`/`@ts-ignore`; nenhuma lógica de negócio em controllers nem acesso a banco fora de repositories.

**Scale/Scope**: Sistema estadual (RS) com múltiplas unidades prisionais, cada uma com várias galerias/celas e centenas de presos; Chefia/Diretor com acesso restrito à(s) unidade(s) vinculada(s) (FR-004a); retenção de dados indefinida (FR-029).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Avaliação |
|---|-----------|-----------|
| I | Domain First | PASS — todo módulo do plano mapeia 1:1 para uma User Story/FR de `spec.md`; nenhuma funcionalidade fora da especificação é proposta. |
| II | Security First | PASS — JWT + RBAC + escopo por unidade em todas as rotas, Argon2, rate limiting, Helmet, CORS restrito (ver research.md). |
| III | Auditability | PASS — `AuditService` centralizado via interceptor cobre toda operação de escrita; tabela `auditoria_logs` sem endpoints de update/delete (ver research.md). |
| IV | Data Integrity | PASS — validação de DTOs no backend (independente do cliente), migrations TypeORM exclusivas, nenhuma alteração manual no banco. |
| V | Clean Architecture | PASS — cada módulo backend segue Controller → Service → Repository conforme `docs/srp_plan.md`; regra de negócio nunca em controller. |
| VI | Single Source of Truth | PASS com nota — `inmates.status` é uma projeção mantida transacionalmente a partir de `movements`/`inmate_cell_history` (não uma segunda fonte independente), necessária para atender SC-003 (consulta de status em até 5s); ver research.md. |
| VII | Consistency | PASS — API REST versionada `/api/v1/`, DTOs padronizados, Swagger/OpenAPI, tratamento de erros consistente. |
| VIII | Testability | PASS — testes unitários e de integração obrigatórios no backend; testes de componente/fluxo no frontend; nenhuma redução de cobertura permitida. |
| IX | Maintainability | PASS — ESLint/Prettier/Husky/lint-staged, TypeScript strict, proibição explícita de `any`/`@ts-ignore`/lógica de negócio em controller/acesso direto ao banco. |
| X | Documentation | PASS — Swagger obrigatório por endpoint; critérios de conclusão do plano exigem documentação atualizada por funcionalidade. |
| XI | Language Convention | PASS — `data-model.md`, `docs/srp_spec_database_model.md` e todos os `contracts/*.md` foram alinhados a identificadores em inglês (`inmates`, `movements`, `routines`, `users`, ...); Project Structure abaixo já usa nomes de módulo em inglês desde a primeira versão do plano. |

Nenhuma violação identificada — Complexity Tracking não é necessário.

**Re-check pós-Phase 1**: `research.md`, `data-model.md`, `contracts/` e `quickstart.md` foram
revisados contra a tabela acima após o design detalhado. Nenhuma decisão de design introduziu
violação nova: a projeção `inmates.status` (nota do princípio VI) está documentada e justificada em
`research.md` §9; a auditoria centralizada via interceptor (princípio III) está refletida em todos
os contratos de escrita em `contracts/`, agora com redação explícita de campos sensíveis
(`research.md` §6, achado C1 do `/speckit-analyze`); o escopo por unidade (FR-004a, princípio II)
está presente em todo endpoint de leitura/escrita listado; a gestão de usuários (FR-030…FR-032,
achado G1) foi adicionada restrita ao perfil `WARDEN`. Gate mantém-se **PASS**.

**Re-check pós-`/speckit-analyze` (2026-08-04, 1ª rodada)**: achados G1 (gestão de usuários), C1
(redação de dados sensíveis em auditoria), G2 (config de efetivo mínimo), G3 (revogação de
refresh token) e A1 (SC-004 sem métrica objetiva) foram resolvidos em `spec.md`, `research.md`,
`data-model.md`, `docs/srp_spec_database_model.md` e `contracts/`. G4 (ferramenta de load test)
resolvido via research.md §14 (k6). Gate mantém-se **PASS**.

**Re-check pós-`/speckit-analyze` (2026-08-04, 2ª rodada)**: a 1ª remediação deixou resíduo em
`tasks.md` (identificadores antigos `CHEFIA_DIRETOR`/`POLICIAL_PENAL`/`bloqueada` sobrevivendo em
7 linhas — achado C1-round2, violação do Princípio XI) e uma ambiguidade de modelagem entre
`POST /users` e `POST /staff` (achado I1 — risco ao Princípio VI). Ambos corrigidos: `tasks.md`
alinhado a `WARDEN`/`PRISON_OFFICER`/`locked`; decisão "Policial Penal = User" registrada em
research.md §15, removendo a entidade/endpoint `Staff` duplicado. Gate mantém-se **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/001-gestao-rotinas-presos/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── auth/              # login, refresh token, guards, RBAC + escopo por unidade
│   ├── users/              # usuários e vínculo com unidade(s) — entities/user.entity.ts, entities/refresh-token.entity.ts, entities/user-unit.entity.ts
│   ├── roles/               # perfis (Policial Penal, Supervisor, Chefia/Diretor) — entities/role.entity.ts
│   ├── units/                # unidades prisionais — entities/unit.entity.ts
│   ├── galleries/              # galerias — entities/gallery.entity.ts
│   ├── cells/                   # celas — entities/cell.entity.ts
│   ├── inmates/                   # presos, status, histórico de cela, situações definitivas — entities/inmate.entity.ts, entities/inmate-cell-history.entity.ts
│   ├── movements/                    # movimentações temporárias e definitivas — entities/movement.entity.ts, entities/movement-type.entity.ts
│   ├── routines/                       # rotinas e horários — entities/routine.entity.ts, entities/routine-schedule.entity.ts
│   ├── staff/                            # escalas, presença/faltas, efetivo mínimo (cadastro de policial = users/, research.md #15) — entities/staff-schedule.entity.ts, entities/minimum-staffing-config.entity.ts
│   ├── reports/                            # relatórios (movimentações, inconsistências, efetivo, ocupação)
│   ├── audit/                                # AuditService + interceptor, leitura de auditoria — entities/audit-log.entity.ts
│   ├── database/                               # data-source.ts (TypeORM DataSource/config), migrations/, seeds/seed.ts
│   └── common/, config/                        # DTOs/pipes/filters compartilhados, configuração
└── test/
    ├── unit/
    ├── integration/
    └── load/
```

Cada módulo de negócio contém sua(s) própria(s) entity(ies) TypeORM em `<módulo>/entities/*.entity.ts` (Constituição V — "Entities" já listada como arquivo padrão por módulo em `docs/srp_plan.md`), decoradas com `@Entity`/`@Column`/`@ManyToOne` etc.; nenhuma entity ou repository vive fora do módulo a que pertence.

```text
frontend/                    # painel web para Supervisor e Chefia/Diretor
├── src/
│   ├── pages/                # telas sem chrome próprio (ex.: LoginPage/) — sempre 1 pasta por rota
│   │   └── LoginPage/
│   │       └── index.tsx
│   ├── layouts/               # AppShell (sidebar + header, shadcn dashboard-01) e demais casings de página — Phase 3.5
│   │   └── AppShell/
│   │       └── index.tsx
│   ├── features/            # um diretório por módulo (rotinas, presos, efetivo, relatórios, auditoria)
│   │   └── structure/
│   │       ├── index.tsx        # a página em si
│   │       ├── types.ts
│   │       ├── api.ts
│   │       └── components/       # UI local à feature (não reaproveitada em outro lugar)
│   │           └── StatusBadge/
│   │               └── index.tsx
│   ├── components/ui/        # componentes shadcn/ui (vendored via CLI, não editar a lógica de variantes manualmente além de extensões pontuais como `success`/`warning` no Badge)
│   ├── components/, hooks/, services/, contexts/, types/
└── tests/

mobile/                       # app operacional para Policial Penal
├── global.css                 # tokens de cor (custom properties HSL, research.md #16/#28) — fonte primária de estilo, mesmos valores de frontend/src/index.css
├── tailwind.config.js, metro.config.js, nativewind-env.d.ts   # NativeWind v4 (research.md #28)
├── src/
│   ├── pages/                 # telas SEM domínio de negócio próprio (research.md #31/#33): LoginScreen/, HomeScreen/, ProfileScreen/ — nome "pages" (não "screens") de propósito, pra não colidir com features/<domínio>/screens/ (significado diferente: aqui 1 tela = 1 domínio isolado)
│   │   ├── LoginScreen/
│   │   │   ├── index.tsx         # a tela em si (View, só JSX — MVVM, research.md #29)
│   │   │   ├── viewmodel.ts      # hook use<Screen>ViewModel com toda lógica/estado/navegação
│   │   │   └── model.ts          # Model da tela (research.md #32/#33) — só existe se houver ≥1 função pura de domínio (ex.: validateEmail/validatePassword); não é obrigatório por tela. Como a tela não compartilha domínio com nenhuma outra, ela É o próprio domínio — não é exceção à regra de #33, é a mesma regra aplicada a um domínio de tamanho 1
│   │   └── HomeScreen/{index.tsx, viewmodel.ts, components/OptionCard/index.tsx}   # sub-componente usado só por esta tela (research.md #34) — nunca função solta dentro do index.tsx da tela
│   ├── features/
│   │   ├── structure/
│   │   │   ├── api.ts, types.ts
│   │   │   ├── model.ts            # Model do domínio "estrutura" (research.md #32/#33) — TODA função pura do domínio mora aqui, nunca dentro de screens/<Tela>/, mesmo se só uma tela usar hoje (findUnitById, filterUnitsByIds, inmateStatusLine, inmateMovementActionLabel), zero React/HTTP
│   │   │   └── screens/            # telas do domínio "estrutura" (research.md #31): SelectUnitScreen/, GalleriesScreen/, CellsScreen/, InmatesScreen/{index.tsx, viewmodel.ts, components/InmateRow/}, InmateDetailScreen/{index.tsx, viewmodel.ts, components/DetailRow/} — mesmo par index.tsx+viewmodel.ts de pages/, sub-componente privado em components/ (research.md #34)
│   │   └── movements/
│   │       ├── api.ts, types.ts, model.ts     # idem (research.md #32) — filterTemporaryMovementTypes, canSubmitExitMovement
│   │       └── screens/MovementRegister/{index.tsx, viewmodel.ts, components/{FieldLabel,ReadOnlyValue}/}    # consome movementsApi + fila offline; sub-componentes privados em components/ (research.md #34)
│   ├── offline/                 # fila local de movimentações pendentes + sincronização
│   ├── theme/                    # colors.ts — tokens de cor só pra props nativas que não aceitam className (ex.: ActivityIndicator.color); estilo de componente usa global.css/Tailwind (research.md #28)
│   ├── lib/                        # utils.ts — cn() (clsx + tailwind-merge); toast.ts — store de toast própria (research.md #29); initials.ts — formatação cross-domain (não pertence a um `model.ts` de feature, research.md #32)
│   ├── components/ui/                # react-native-reusables vendorizado (button/input/text/card/label/avatar/badge/icon/alert) — arquivo plano, exceção à pasta-por-componente igual frontend/src/components/ui/ (research.md #28/#30)
│   ├── components/                     # componentes próprios compartilhados entre telas — pasta-por-componente (research.md #27): ScreenHeader/, ConfirmSheet/, Toaster/, etc.
│   ├── contexts/, hooks/, services/, navigation/, assets/    # UnitContext/useUnit (unidade global, research.md #29) segue o mesmo split de AuthContext/useAuth; assets/ tem o brasão da PPRS (research.md #30)
└── tests/
```

**Structure Decision**: Três projetos independentes compartilhando um único backend/API (`backend/`), conforme exigido por `docs/srp_plan.md` (web para administração/gestão, mobile para operação de plantão). Nenhum dos três acessa o PostgreSQL diretamente — toda persistência passa pela API REST do `backend/`. Módulos do backend seguem exatamente a lista de `docs/srp_plan.md` (auth, users, roles, units, galleries, cells, inmates, movements, routines, staff, reports, audit, common, config), cada um com Controller/Service/Repository/DTOs/Entities/Validators/Tests próprios (Constituição V). Em `frontend/` e `mobile/`, todo componente compartilhado — de feature ou de uso geral, com um arquivo só ou vários — vive em sua própria pasta nomeada pelo conceito, com `index.tsx` como ponto de entrada único, sem exceção por tamanho (research.md #17, estendida ao mobile pela #27); `components/ui/` é a única exceção nos dois clientes, por ser código vendorizado do shadcn/ui (`frontend/`) / react-native-reusables (`mobile/`) — arquivo plano, não editar a lógica de variantes manualmente além de extensões pontuais (research.md #28); `types.ts`/`api.ts` de uma feature ficam soltos ao lado do `index.tsx` da feature, não dentro de pasta própria. Telas de rota seguem a mesma regra de pasta própria nos dois clientes (`frontend/src/pages/<Nome>/index.tsx`; `mobile/src/pages/<Nome>/index.tsx` + `viewmodel.ts` colocado do lado, research.md #31/#33). A diferença entre os dois clientes é só onde a pasta da tela mora: se a tela depende de um domínio com `api.ts`/`types.ts` próprios, ela mora dentro de `features/<domínio>/` (mobile: `features/<domínio>/screens/<Tela>/`, um nível a mais que o frontend porque cada domínio no mobile é uma sequência de telas em pilha, não uma página só com filtro); telas sem domínio (login, hub, perfil) ficam soltas em `pages/` — nome escolhido de propósito (igual ao `frontend/`) pra não colidir com o `screens/` aninhado da feature, que tem um significado diferente (research.md #33). O Model (regra de negócio pura, sem React/HTTP) segue a mesma raiz do domínio que o possui: `features/<domínio>/model.ts` quando várias telas compartilham o domínio, ou `pages/<Tela>/model.ts` quando a tela não compartilha domínio com nenhuma outra — nesse caso a própria tela é o domínio (research.md #32/#33). Tema escuro + paleta preto/dourado (research.md #16) é compartilhado pelos dois clientes; no mobile, a fonte primária é `mobile/global.css` (NativeWind/Tailwind, research.md #28) — `mobile/src/theme/colors.ts` sobrevive só pras poucas props nativas que não aceitam `className`.

## Complexity Tracking

*Sem violações da Constituição identificadas no Constitution Check — seção não aplicável.*
