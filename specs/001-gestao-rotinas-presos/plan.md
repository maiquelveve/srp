# Implementation Plan: Gestão de Rotinas Penitenciárias (SRP)

**Branch**: `001-gestao-rotinas-presos` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-gestao-rotinas-presos/spec.md`, technical direction from `docs/srp_plan.md`, and database model from `docs/srp_spec_database_model.md`.

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Substituir o controle em papel das rotinas operacionais do sistema prisional do RS por um sistema digital auditável composto de uma API REST NestJS/Prisma/PostgreSQL, um front-end web React/Vite para Supervisor e Chefia/Diretor, e um aplicativo React Native/Expo com suporte offline para Policiais Penais. A abordagem técnica segue estritamente `docs/srp_plan.md`: autenticação JWT + RBAC por perfil e por unidade, auditoria automática e imutável de toda operação de escrita, migrations exclusivas via Prisma, e módulos com separação Controller/Service/Repository conforme a Constituição do projeto.

## Technical Context

**Language/Version**: TypeScript (modo strict) em todo o stack — Node.js LTS no backend, React 18+ no frontend, React Native (Expo SDK atual) no mobile.

**Primary Dependencies**: Backend: NestJS, Prisma ORM, `@nestjs/jwt` + Passport, Argon2 (hash de senha), `@nestjs/throttler`, Helmet, `@nestjs/swagger`. Frontend web: Vite, TailwindCSS, shadcn/ui, TanStack Query, React Hook Form, Zod. Mobile: Expo, React Navigation, cliente HTTP com fila de sincronização offline.

**Storage**: PostgreSQL, acessado exclusivamente via Prisma; schema espelha `docs/srp_spec_database_model.md`; toda alteração de schema via Prisma Migrate (nenhuma alteração manual no banco).

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
| IV | Data Integrity | PASS — validação de DTOs no backend (independente do cliente), migrations Prisma exclusivas, nenhuma alteração manual no banco. |
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
│   ├── users/              # usuários e vínculo com unidade(s)
│   ├── roles/               # perfis (Policial Penal, Supervisor, Chefia/Diretor)
│   ├── units/                # unidades prisionais
│   ├── galleries/              # galerias
│   ├── cells/                   # celas
│   ├── inmates/                   # presos, status, histórico de cela, situações definitivas
│   ├── movements/                    # movimentações temporárias e definitivas
│   ├── routines/                       # rotinas e horários
│   ├── staff/                            # escalas, presença/faltas, efetivo mínimo (cadastro de policial = users/, research.md #15)
│   ├── reports/                            # relatórios (movimentações, inconsistências, efetivo, ocupação)
│   ├── audit/                                # AuditService + interceptor, leitura de auditoria
│   └── common/, config/                        # DTOs/pipes/filters compartilhados, configuração
├── prisma/
│   ├── schema.prisma       # espelha docs/srp_spec_database_model.md
│   └── migrations/
└── test/
    ├── unit/
    └── integration/

frontend/                    # painel web para Supervisor e Chefia/Diretor
├── src/
│   ├── pages/, layouts/
│   ├── features/            # um diretório por módulo (rotinas, presos, efetivo, relatórios, auditoria)
│   ├── components/, hooks/, services/, contexts/, types/
└── tests/

mobile/                       # app operacional para Policial Penal
├── src/
│   ├── screens/               # registro de movimentação, consulta de presos, rotinas do turno
│   ├── offline/                 # fila local de movimentações pendentes + sincronização
│   ├── components/, hooks/, services/
└── tests/
```

**Structure Decision**: Três projetos independentes compartilhando um único backend/API (`backend/`), conforme exigido por `docs/srp_plan.md` (web para administração/gestão, mobile para operação de plantão). Nenhum dos três acessa o PostgreSQL diretamente — toda persistência passa pela API REST do `backend/`. Módulos do backend seguem exatamente a lista de `docs/srp_plan.md` (auth, users, roles, units, galleries, cells, inmates, movements, routines, staff, reports, audit, common, config), cada um com Controller/Service/Repository/DTOs/Entities/Validators/Tests próprios (Constituição V).

## Complexity Tracking

*Sem violações da Constituição identificadas no Constitution Check — seção não aplicável.*
