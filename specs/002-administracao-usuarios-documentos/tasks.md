---

description: "Task list template for feature implementation"
---

# Tasks: Administração de Usuários e Documentos

**Input**: Design documents from `/specs/002-administracao-usuarios-documentos/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Test tasks are incluídas (backend unit + integração), mesmo padrão da feature 001 (Constituição VIII).

**Organization**: Tasks agrupadas por user story (spec.md P1–P3) para implementação e teste independentes de cada uma.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência de task incompleta)
- **[Story]**: A qual user story a task pertence (US1–US3)
- Caminhos de arquivo exatos em toda descrição

## Path Conventions

Extensão dos projetos já existentes (`plan.md` Project Structure) — nenhum projeto novo, `mobile/`
não é tocado (FR-019):

- `backend/src/auth/`, `backend/src/users/`, `backend/src/documents/` (novo), `backend/src/email/` (novo), `backend/src/database/migrations/`, `backend/test/`
- `frontend/src/features/users/` (novo), `frontend/src/features/documents/` (novo), `frontend/src/features/profile/`, `frontend/src/pages/LoginPage/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependências e configuração compartilhadas pelas 3 user stories

- [ ] T001 Adicionar `nodemailer` + `@types/nodemailer` às dependências de `backend/package.json` (research.md #6)
- [ ] T002 [P] Adicionar as variáveis novas a `backend/.env.example`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` (research.md #6), `DOCUMENTS_STORAGE_PATH`, `DOCUMENTS_MAX_FILE_SIZE_MB` (research.md #4, #8), seguindo o padrão de bloco comentado já usado ali
- [ ] T003 [P] Adicionar o diretório padrão de `DOCUMENTS_STORAGE_PATH` (ex.: `storage/documents/`) a `backend/.gitignore`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestrutura compartilhada pela User Story 1 (reset de senha) e pela User Story 3 (troca da própria senha)

**⚠️ CRITICAL**: Nenhuma das duas pode ser concluída sem esta task

- [ ] T004 Implementar `TokenService.revokeAllForUser(userId: number, exceptTokenHash?: string)` em `backend/src/auth/token.service.ts` (research.md #1); refatorar `UsersService.deactivate()` (`backend/src/users/users.service.ts:138-142`) para chamar esse método em vez da query inline hoje duplicada; testes unitários cobrindo os dois modos (revogar tudo / revogar tudo exceto um hash) em `backend/test/unit/token.service.spec.ts`

**Checkpoint**: Revogação de sessão pronta — User Story 1 (reset) e User Story 3 (troca própria) podem ser implementadas

---

## Phase 3: User Story 1 - Administração de Usuários pela Chefia/Diretor (Priority: P1) 🎯 MVP

**Goal**: Chefia/Diretor cadastra, edita (incluindo perfil), desativa, reativa, troca/adiciona lotação e reseta a senha de qualquer usuário, com e-mail de senha inicial/reset e revogação de sessão.

**Independent Test**: Cadastrar um usuário, editar seu cargo/perfil, desativá-lo, reativá-lo, trocar sua lotação, somar uma lotação nova e resetar sua senha via API, confirmando a cada passo o estado do usuário e a revogação/emissão de sessão (`contracts/users.md`).

### Tests for User Story 1

- [ ] T005 [P] [US1] Testes de integração para os endpoints de `contracts/users.md` (editar, reativar, trocar lotação, adicionar lotação, resetar senha, reenviar e-mail; `403` para não-WARDEN e para auto-alvo; `emailDelivered: false` sem falhar a operação) em `backend/test/integration/users-admin.spec.ts`
- [ ] T006 [P] [US1] Testes unitários do `EmailService` (envio com sucesso, envio com falha sem lançar exceção, retorno booleano) em `backend/test/unit/email.service.spec.ts`

### Implementation for User Story 1

- [ ] T007 [P] [US1] Implementar `EmailModule`/`EmailService` (Nodemailer/SMTP) com `sendPasswordEmail(to, temporaryPassword, kind: 'created' | 'reset')` em `backend/src/email/` (research.md #6; depende de T001, T002)
- [ ] T008 [US1] Trocar `UsersService.create()` (`backend/src/users/users.service.ts:174-189`) para chamar `EmailService.sendPasswordEmail(..., 'created')` em vez de só logar o token de convite (depende de T007)
- [ ] T009 [US1] Implementar `UsersService.update()` + `PATCH /api/v1/users/:id` (name/badgeNumber/jobTitle/role; `403` somente se `:id` for o próprio requisitante **e** o payload mudar o `role` atual — editar os demais campos da própria conta é permitido) em `backend/src/users/`, DTO `update-user.dto.ts` (`contracts/users.md`; depende de T004)
- [ ] T009a [US1] Adicionar a `UsersService.deactivate()` já existente (`backend/src/users/users.service.ts:129-154`) a checagem `403` quando `:id` for o próprio requisitante (regra nova desta fase, FR-008a) — sem alterar o restante do comportamento já implementado na feature 001
- [ ] T010 [US1] Implementar `UsersService.reactivate()` + `PATCH /api/v1/users/:id/reactivate` em `backend/src/users/` — sem restrição de auto-alvo (FR-008a não cobre reativar)
- [ ] T011 [US1] Implementar `UsersService.replaceUnits()` + `PUT /api/v1/users/:id/units` ("Trocar lotação", `403` sempre que `:id` for o próprio requisitante) em `backend/src/users/`, DTO `replace-units.dto.ts`
- [ ] T012 [US1] Implementar `UsersService.addUnits()` + `POST /api/v1/users/:id/units` ("Adicionar lotação", `403` sempre que `:id` for o próprio requisitante) em `backend/src/users/`, DTO `add-units.dto.ts`
- [ ] T013 [US1] Implementar `UsersService.resetPassword()` + `PATCH /api/v1/users/:id/reset-password` (gera senha temporária, chama `EmailService`, chama `TokenService.revokeAllForUser(userId)`) em `backend/src/users/` — sem restrição de auto-alvo, a Chefia/Diretor pode resetar a própria senha (FR-008a não cobre reset) (depende de T004, T007)
- [ ] T014 [US1] Implementar `UsersService.resendPasswordEmail()` + `POST /api/v1/users/:id/resend-password-email` (`409` se não houver senha pendente) em `backend/src/users/` — sem restrição de auto-alvo (depende de T007)
- [ ] T015 [US1] Adicionar `AuditService.record(...)` (`oldData`/`newData`, nunca a senha em texto claro) às mutações novas de `UsersService` e à checagem nova de `deactivate()` (T009a), com `@SkipAutoAudit()` nas rotas do controller (research.md #2, mesmo padrão já usado em `deactivate()`)
- [ ] T016 [P] [US1] Construir a tela web "Administração de Usuários" (cards + modais: editar, trocar lotação com confirmação, adicionar lotação com confirmação explícita distinta, resetar senha) em `frontend/src/features/users/`, incluindo o aviso "e-mail não entregue" + botão "reenviar e-mail" (ligado a T014) quando a criação/reset retornar `emailDelivered: false` — posição exata do aviso/botão a definir na implementação — seguindo `docs/style-guide.md` (FR-021) (depende de T008, T009–T014)
- [ ] T017 [P] [US1] Adicionar rota/item de menu "Administração de Usuários" (somente WARDEN) em `frontend/src/App.tsx` e na navegação do `AppShell` (depende de T016)

**Checkpoint**: User Story 1 totalmente funcional e testável de forma independente

---

## Phase 4: User Story 2 - Biblioteca de Formulários, Modelos e Manuais (Priority: P2)

**Goal**: Chefia/Diretor e Supervisor publicam documentos nas 3 categorias fixas; qualquer usuário autenticado consulta e baixa.

**Independent Test**: Enviar um arquivo em cada categoria e confirmar que aparece como card com download na categoria certa, para os três perfis (`contracts/documents.md`).

### Tests for User Story 2

- [ ] T018 [P] [US2] Testes de integração para os endpoints de `contracts/documents.md` (enviar/listar/baixar/remover, `403` para `PRISON_OFFICER` em escrita, `400` para arquivo com extensão falsificada, `409` para nome duplicado na mesma categoria, `401` para download sem autenticação) em `backend/test/integration/documents.spec.ts`
- [ ] T019 [P] [US2] Testes unitários da verificação de assinatura de arquivo (os 4 formatos aceitos + casos de recusa) em `backend/test/unit/file-signature.spec.ts`

### Implementation for User Story 2

- [ ] T020 [US2] Criar as entities TypeORM `DocumentType`/`Document` em `backend/src/documents/entities/` e a migration `AddDocumentsTables` (constraint única `(document_type_id, name)` + seed das 3 linhas fixas de `DocumentType`) em `backend/src/database/migrations/` (`data-model.md`)
- [ ] T021 [P] [US2] Implementar o utilitário de verificação de assinatura de arquivo em `backend/src/documents/file-signature.ts` (research.md #3)
- [ ] T022 [US2] Implementar `DocumentsModule`/`Controller`/`Service` — `GET /document-types`, `GET /documents`, `GET /documents/:id/download`, `POST /documents`, `DELETE /documents/:id` por `contracts/documents.md` (depende de T020, T021)
- [ ] T023 [US2] Aplicar RBAC (`WARDEN`+`SUPERVISOR` em `POST`/`DELETE`, qualquer autenticado em `GET`) e `FileInterceptor` (Multer) com limite `DOCUMENTS_MAX_FILE_SIZE_MB` aos endpoints de documentos (depende de T022, T002)
- [ ] T024 [US2] Adicionar `AuditService.record(...)` (`INSERT` no envio, `DELETE` com snapshot completo em `oldData` na remoção) a `DocumentsService` (research.md #2, #10)
- [ ] T025 [P] [US2] Construir a tela web "Biblioteca de Documentos" (3 categorias, cards de documento com download, modal de envio restrito a WARDEN/SUPERVISOR) em `frontend/src/features/documents/`, seguindo `docs/style-guide.md` (FR-021) (depende de T022)
- [ ] T026 [P] [US2] Adicionar rotas/itens de menu "Formulários"/"Modelos de Documentos"/"Manuais" em `frontend/src/App.tsx` e na navegação do `AppShell` (depende de T025)

**Checkpoint**: User Story 2 totalmente funcional e testável de forma independente

---

## Phase 5: User Story 3 - Troca de Senha pelo Próprio Usuário (Priority: P3)

**Goal**: Qualquer usuário autenticado troca a própria senha pelo perfil, com revogação das demais sessões; toggle de mostrar/ocultar senha no login e na troca.

**Independent Test**: Logar com um usuário, trocar a senha informando a atual, e confirmar que o login seguinte só funciona com a nova senha e que outra sessão aberta foi encerrada (`contracts/auth.md`).

### Tests for User Story 3

- [ ] T027 [P] [US3] Testes de integração para `PATCH /api/v1/auth/change-password` (senha atual errada, confirmação divergente, senha fraca, revogação de sessão exceto a atual) em `backend/test/integration/change-password.spec.ts`

### Implementation for User Story 3

- [ ] T028 [US3] Implementar `AuthService.changePassword()` + `PATCH /api/v1/auth/change-password` (valida `currentPassword`, política de `newPassword`, chama `TokenService.revokeAllForUser(userId, exceptTokenHash)`) em `backend/src/auth/`, DTO `change-password.dto.ts` (depende de T004)
- [ ] T029 [US3] Adicionar `AuditService.record(...)` (`UPDATE`, sem a senha em texto claro) a `AuthService.changePassword()` (research.md #2)
- [ ] T030 [P] [US3] Construir o modal "Alterar senha" (senha atual/nova/confirmar, ícone de mostrar/ocultar em cada campo) em `frontend/src/features/profile/components/ChangePasswordDialog/`, ligado ao ícone de engrenagem hoje `disabled` em `frontend/src/features/profile/index.tsx:214-230` (depende de T028; FR-018, FR-021)
- [ ] T031 [P] [US3] Adicionar o toggle de mostrar/ocultar senha (`lucide-react` `Eye`/`EyeOff`) ao campo de senha de `frontend/src/pages/LoginPage/index.tsx` (FR-018)

**Checkpoint**: User Story 3 totalmente funcional e testável de forma independente; as 3 user stories completas

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Ajustes que atravessam as 3 user stories

- [ ] T032 [P] Anotações Swagger para todos os endpoints novos (`contracts/users.md`, `contracts/auth.md`, `contracts/documents.md`) em seus controllers
- [ ] T033 Rodar a validação de `quickstart.md` de ponta a ponta (os 3 cenários)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — pode começar imediatamente
- **Foundational (Phase 2)**: Depende do Setup — BLOQUEIA User Story 1 (reset) e User Story 3 (troca própria)
- **User Story 2 (Phase 4)**: Depende só do Setup (T001–T003 para `DOCUMENTS_MAX_FILE_SIZE_MB`/`DOCUMENTS_STORAGE_PATH`) — **não** depende da Phase 2 (Foundational), pode ser implementada em paralelo com US1/US3
- **User Story 1 (Phase 3)** e **User Story 3 (Phase 5)**: Dependem da Phase 2 (Foundational) completa
- **Polish (Phase 6)**: Depende das 3 user stories desejadas estarem completas

### User Story Dependencies

- **User Story 1 (P1)**: Depende de Foundational (T004) — sem dependência de US2/US3
- **User Story 2 (P2)**: Sem dependência de Foundational nem de US1/US3 — pode ser a primeira a ser entregue se a ordem de prioridade não for seguida à risca
- **User Story 3 (P3)**: Depende de Foundational (T004) — sem dependência de US1/US2

### Within Each User Story

- Testes escritos antes da implementação (e devem falhar antes dela)
- Entities/migrations antes de services
- Services antes de endpoints/controllers
- Backend antes do frontend que o consome
- Auditoria (`AuditService.record`) como última etapa de cada mutação, depois do endpoint funcionar

### Parallel Opportunities

- T002 e T003 (Setup) em paralelo
- Depois da Phase 2 (Foundational) pronta: User Story 1 e User Story 3 podem avançar em paralelo (times diferentes); User Story 2 pode começar a qualquer momento, mesmo antes da Phase 2
- Dentro de cada story: testes marcados `[P]` em paralelo entre si; T007/T016/T017 (US1), T021/T025/T026 (US2), T030/T031 (US3) rodam em paralelo por tocarem arquivos diferentes

---

## Parallel Example: User Story 1

```bash
# Testes de US1 em paralelo:
Task: "Testes de integração para contracts/users.md em backend/test/integration/users-admin.spec.ts"
Task: "Testes unitários do EmailService em backend/test/unit/email.service.spec.ts"

# Depois do backend de US1 pronto (T009–T015), frontend em paralelo:
Task: "Tela web Administração de Usuários em frontend/src/features/users/"
Task: "Rota/menu Administração de Usuários em frontend/src/App.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 apenas)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (T004 — bloqueia US1 e US3)
3. Completar Phase 3: User Story 1
4. **PARAR e VALIDAR**: testar User Story 1 de forma independente (`quickstart.md` Cenário 1)
5. Entregar/demonstrar se pronto

### Incremental Delivery

1. Setup + Foundational → base pronta
2. User Story 1 → testar independentemente → entregar (MVP administrativo)
3. User Story 2 → testar independentemente → entregar (biblioteca de documentos)
4. User Story 3 → testar independentemente → entregar (autoatendimento de senha)
5. Cada story agrega valor sem quebrar as anteriores

### Parallel Team Strategy

Com mais de um desenvolvedor:

1. Time completa Setup + Foundational junto
2. Depois disso:
   - Desenvolvedor A: User Story 1
   - Desenvolvedor B: User Story 2 (pode começar antes mesmo, não depende de Foundational)
   - Desenvolvedor C: User Story 3
3. Stories completam e integram de forma independente

---

## Notes

- `[P]` = arquivos diferentes, sem dependência
- Rótulo `[Story]` mapeia a task à user story correspondente, para rastreabilidade
- Cada user story deve ser completável e testável de forma independente
- Confirmar que os testes falham antes de implementar
- Nenhuma tela nova foge do padrão visual/cores/componentes já em uso (`docs/style-guide.md`, FR-021)
- Evitar: tasks vagas, conflito no mesmo arquivo, dependência entre stories que quebre a independência
