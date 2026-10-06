# Implementation Plan: Administração de Usuários e Documentos

**Branch**: `002-administracao-usuarios-documentos` | **Date**: 2026-09-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-administracao-usuarios-documentos/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Estender o painel web existente (backend NestJS/TypeORM/PostgreSQL + frontend React/Vite) com três capacidades administrativas, sem nenhum alcance no aplicativo móvel: (1) o módulo `users/` ganha edição completa (incluindo perfil), reativação, troca/adição de lotação e reset de senha administrativo, com envio de e-mail via um novo `EmailService` (SMTP/Nodemailer) e revogação de sessão reaproveitando/generalizando a lógica de revogação de refresh tokens já usada em `deactivate()`; (2) um módulo novo `documents/` guarda três categorias fixas de documentos (Formulários, Modelos de Documentos, Manuais), com upload validado por assinatura real de arquivo (não só extensão) e nome único por categoria, armazenado em disco local; (3) o módulo `auth/` ganha um endpoint de troca de senha pelo próprio usuário, que revoga as demais sessões preservando a atual, e o frontend ganha o toggle de mostrar/ocultar senha (login e troca) usando os ícones já disponíveis via `lucide-react`.

## Technical Context

**Language/Version**: TypeScript (modo strict) em todo o stack — Node.js LTS no backend, React 18+ no frontend. Mobile fica fora do escopo desta fase (FR-019).

**Primary Dependencies**: Backend (adições a `backend/package.json`): `nodemailer` + `@types/nodemailer` (envio de e-mail via SMTP, substitui o log-only atual documentado em `users.service.ts` linha ~186); nenhuma biblioteca nova para upload (`@nestjs/platform-express` já expõe `FileInterceptor`/Multer) nem para verificação de assinatura de arquivo — implementada como utilitário interno (ver research.md #3, decisão que evita dependência ESM-only). Frontend: nenhuma dependência nova — `lucide-react` (já instalado) fornece os ícones `Eye`/`EyeOff`; `@radix-ui/react-dialog`, `react-hook-form` e `zod` (já instalados) cobrem os novos modais/formulários.

**Storage**: PostgreSQL via TypeORM, como no restante do projeto (entities novas: `Document`, `DocumentType`; extensão de uso do `RefreshToken` já existente). Arquivos de documento em disco local do servidor backend, fora do controle de versão, em diretório configurável (`DOCUMENTS_STORAGE_PATH`); o banco guarda só metadados e o caminho relativo — nenhum novo serviço de storage externo (S3 etc.) é introduzido nesta fase.

**Testing**: Backend — Jest (unitário) + Supertest (integração), mesmo padrão de `backend/test/`. Frontend — Vitest + React Testing Library, mesmo padrão de `frontend/tests` (a suíte de componentes existente).

**Target Platform**: Backend como serviço Linux (mesmo container/processo já existente); frontend web em navegadores modernos. Sem app mobile nesta fase.

**Project Type**: Web application (extensão do backend REST + frontend web já existentes) — nenhum projeto novo é criado; os três módulos afetados (`users/`, novo `documents/`, `auth/`) vivem no mesmo `backend/` monolítico.

**Performance Goals**: Sem metas numéricas novas além das já vigentes no sistema; a biblioteca de documentos é de baixo volume (dezenas de arquivos, não milhares) e não tem requisito de latência distinto do resto do painel web.

**Constraints**: Upload aceita somente DOCX/DOC/TXT/PDF verificados por conteúdo real, não só extensão (FR-013a, research.md #3); tamanho máximo de arquivo configurável, default 10 MB (research.md #4); nome de documento único por categoria (FR-010a); toda ação de administração de usuário e de documento gera entrada de auditoria (FR-020, reaproveitando `AuditService.record`); nenhuma tela nova foge do padrão visual/cores/componentes já documentado em `docs/style-guide.md` (FR-021); identificadores de código/schema em inglês, texto de interface em português (Constituição XI).

**Scale/Scope**: Mesmo sistema estadual da feature 001 — 3 novas telas web (administração de usuários, biblioteca de documentos, troca de senha) mais um botão/modal no formulário de login; sem novo público-alvo além dos perfis já existentes (Policial Penal, Supervisor, Chefia/Diretor).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Avaliação |
|---|-----------|-----------|
| I | Domain First | PASS — todo endpoint/tela planejado mapeia 1:1 para um FR de `spec.md`; nenhuma funcionalidade fora do spec é proposta. |
| II | Security First | PASS — RBAC reaplicado (WARDEN para administração de usuários e reset; WARDEN+SUPERVISOR para upload/remoção de documento; qualquer autenticado para download e troca da própria senha); reset/troca de senha revogam sessão (research.md #1); upload valida conteúdo real do arquivo, não extensão (research.md #3); auto-gestão da própria conta pela Chefia/Diretor bloqueada (FR-008a). |
| III | Auditability | PASS — todas as novas mutações (editar/desativar/ativar/trocar-lotação/adicionar-lotação/resetar-senha de usuário; enviar/remover documento) chamam `AuditService.record` com `oldData`/`newData`, seguindo o padrão já usado em `movements.service.ts`/`users.service.ts` (research.md #2). |
| IV | Data Integrity | PASS — validação de DTOs no backend (class-validator) independente do frontend; nome de documento único por categoria garantido por constraint de banco, não só checagem em memória; migrations TypeORM exclusivas para as tabelas novas. |
| V | Clean Architecture | PASS — `documents/` segue exatamente a estrutura Controller/Service/Module/DTO/Entity de `routines/` (research.md #5); lógica de e-mail isolada num `EmailModule`/`EmailService` próprio, nunca chamada direta de SMTP a partir de controllers. |
| VI | Single Source of Truth | PASS — lotação do usuário continua sendo só a relação `User.units` já existente (ManyToMany); "Trocar"/"Adicionar" lotação são duas operações sobre essa mesma relação, não um campo novo duplicando a informação. |
| VII | Consistency | PASS — novos endpoints seguem `/api/v1/...`, DTOs padronizados, mesmos códigos de erro (`403`, `404`, `409`) já usados no restante da API. |
| VIII | Testability | PASS — testes unitários (regras de validação, revogação de sessão, verificação de assinatura de arquivo) e de integração (endpoints novos) obrigatórios, mesmo padrão de `backend/test/`. |
| IX | Maintainability | PASS — a revogação de refresh tokens hoje duplicada inline em `UsersService.deactivate()` é extraída para um método único reutilizável no `TokenService` (research.md #1), reduzindo duplicação em vez de aumentá-la. |
| X | Documentation | PASS — Swagger obrigatório nos endpoints novos; `docs/style-guide.md` é a referência obrigatória para as 3 telas novas (FR-021), sem introduzir um guia paralelo. |
| XI | Language Convention | PASS — entities/tabelas novas em inglês (`Document`, `DocumentType`, tabelas `documents`/`document_types`, ver data-model.md); rótulos de categoria (Formulários/Modelos de Documentos/Manuais) e todo texto de tela em português. |

Nenhuma violação identificada — Complexity Tracking não é necessário.

**Re-check pós-Phase 1**: `research.md`, `data-model.md`, `contracts/` e `quickstart.md` foram revisados contra a tabela acima após o design detalhado. A extração do método `TokenService.revokeAllForUser()` (nota do princípio IX) está refletida em `research.md` §1 e nos contratos de `users.md`/`auth.md`; a verificação de assinatura de arquivo (princípio II) está documentada em `research.md` §3 e no contrato `documents.md`; a auditoria de toda mutação nova (princípio III) está listada em cada contrato. Nenhuma decisão de design introduziu violação nova. Gate mantém-se **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/002-administracao-usuarios-documentos/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── users.md
│   ├── auth.md
│   └── documents.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── auth/
│   │   ├── auth.controller.ts        # + PATCH /auth/change-password
│   │   ├── auth.service.ts           # + changePassword()
│   │   ├── token.service.ts          # + revokeAllForUser(userId, exceptTokenHash?) (research.md #1)
│   │   └── dto/change-password.dto.ts   # novo
│   ├── users/
│   │   ├── users.controller.ts       # + PATCH :id, :id/reactivate, PUT/POST :id/units, PATCH :id/reset-password, POST :id/resend-password-email
│   │   ├── users.service.ts          # + update(), reactivate(), replaceUnits(), addUnits(), resetPassword(), resendPasswordEmail(); deactivate() passa a chamar TokenService.revokeAllForUser()
│   │   └── dto/                      # + update-user.dto.ts, replace-units.dto.ts, add-units.dto.ts
│   ├── documents/                    # módulo novo, mesma estrutura de routines/ (research.md #5)
│   │   ├── documents.module.ts
│   │   ├── documents.controller.ts
│   │   ├── documents.service.ts
│   │   ├── entities/document.entity.ts
│   │   ├── entities/document-type.entity.ts
│   │   └── dto/create-document.dto.ts, dto/document-response.dto.ts
│   ├── email/                        # módulo novo — EmailService (Nodemailer/SMTP)
│   │   ├── email.module.ts
│   │   └── email.service.ts
│   └── database/
│       └── migrations/               # + AddDocumentsTables, + seed dos 3 DocumentType fixos
└── test/
    ├── unit/                         # + token.service (revogação), documents.service (validação de arquivo), auth.service (change-password)
    └── integration/                  # + users (editar/ativar/trocar-lotação/reset), documents (upload/download/remover), auth (change-password)

frontend/
├── src/
│   ├── features/
│   │   ├── users/                    # módulo novo — tela de administração de usuários (cards + modais, docs/style-guide.md)
│   │   │   ├── index.tsx
│   │   │   ├── api.ts, types.ts
│   │   │   └── components/{UserDialog,ReplaceUnitsDialog,AddUnitsDialog,ResetPasswordDialog}/
│   │   ├── documents/                # módulo novo — biblioteca de Formulários/Modelos/Manuais
│   │   │   ├── index.tsx
│   │   │   ├── api.ts, types.ts
│   │   │   └── components/{DocumentCard,UploadDocumentDialog}/
│   │   └── profile/
│   │       └── components/ChangePasswordDialog/   # habilita o botão de engrenagem hoje `disabled` (frontend/src/features/profile/index.tsx:214-230)
│   ├── components/ui/                 # reaproveita Input/Button/Dialog/Card já vendorizados (shadcn) — nenhum componente novo de base
│   └── pages/LoginPage/               # + toggle mostrar/ocultar senha (lucide-react Eye/EyeOff)
└── tests/
```

**Structure Decision**: Extensão dos três projetos já existentes (`backend/`, `frontend/`; `mobile/` não é tocado por esta fase, FR-019). Backend ganha um módulo novo (`documents/`) seguindo exatamente o padrão Controller/Service/Module/DTO/Entities de `routines/` (research.md #5), e um módulo novo pequeno (`email/`) isolando o envio de e-mail atrás de uma interface própria (`EmailService`), nunca chamado direto de dentro de `users.service.ts` sem essa camada — mantém `movements`/`routines`/`users`/`auth` como estão estruturalmente, só adicionando métodos/endpoints. Frontend ganha dois módulos novos em `features/` (`users/`, `documents/`) seguindo o mesmo padrão de pasta-por-componente e `index.tsx`/`api.ts`/`types.ts`/`components/` já estabelecido em `features/structure/` e `features/movements/` (ver `specs/001-gestao-rotinas-presos/plan.md`), e o modal de troca de senha entra dentro de `features/profile/` por já ser o dono do botão de engrenagem hoje desabilitado.

## Complexity Tracking

*Sem violações da Constituição identificadas no Constitution Check — seção não aplicável.*
