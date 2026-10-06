# SRP - Sistema de Rotinas Penitenciárias

Sistema digital que substitui as folhas impressas de controle de uma unidade prisional: cadastro de
presos e da estrutura (unidades, galerias, celas), movimentações em tempo real, situações
definitivas, rotinas operacionais, escalas de efetivo, relatórios e auditoria. Inclui também a
administração de usuários pela Chefia/Diretor, uma biblioteca de formulários/modelos/manuais e a
troca de senha pelo próprio usuário — essas três últimas exclusivas do painel web.

Monorepo com três aplicações:

| Pasta | O que é | Stack |
|---|---|---|
| `backend/` | API REST (`/api/v1`) | NestJS, TypeORM, PostgreSQL, JWT |
| `frontend/` | Painel web | React, Vite, shadcn/ui, TanStack Query |
| `mobile/` | Aplicativo do Policial Penal, com registro de movimentação sem rede | Expo, React Native, NativeWind |

Perfis: **Policial Penal** (`PRISON_OFFICER`), **Supervisor** (`SUPERVISOR`) e **Chefia/Diretor**
(`WARDEN`). Cada usuário só enxerga as unidades a que está vinculado.

## Estado das User Stories

### Feature 001 — Gestão de Rotinas Penitenciárias

| US | Tema | Web | Mobile |
|---|---|---|---|
| US1 | Cadastro e mapa da unidade | sim | sim |
| US2 | Movimentações temporárias e status em tempo real | sim | sim (com fila offline) |
| US3 | Situações definitivas (liberdade, tornozeleira, transferência, trocas e permutas de cela/galeria) | sim | parcial (troca e permuta de cela) |
| US4 | Rotinas operacionais | sim | consulta do turno |
| US5 | Controle de efetivo e escalas | sim | não |
| US6 | Relatórios e auditoria | sim | não |

Detalhamento: [`specs/001-gestao-rotinas-presos/tasks.md`](specs/001-gestao-rotinas-presos/tasks.md).

### Feature 002 — Administração de Usuários e Documentos

| US | Tema | Web | Mobile |
|---|---|---|---|
| US1 | Administração de usuários pela Chefia/Diretor (editar, reativar, trocar/adicionar lotação, resetar senha) | sim | não (FR-019) |
| US2 | Biblioteca de Formulários, Modelos de Documentos e Manuais | sim | não (FR-019) |
| US3 | Troca de senha pelo próprio usuário | sim | não (FR-019) |

Detalhamento: [`specs/002-administracao-usuarios-documentos/tasks.md`](specs/002-administracao-usuarios-documentos/tasks.md).

## Pré-requisitos

- Node.js LTS e npm
- Docker (para o PostgreSQL local)

## Como rodar

### 1. Banco de dados

```bash
cd docker/postgres
cp .env.example .env      # ajuste os valores
docker compose up -d
```

### 2. Backend

```bash
cd backend
cp .env.example .env      # ajuste POSTGRES_* e os segredos JWT_*
npm install
npm run migration:run     # cria/atualiza o esquema
npm run seed              # dados de exemplo (unidade, usuários, tipos de movimentação)
npm run start:dev         # http://localhost:3000
```

- Documentação interativa da API (Swagger): `http://localhost:3000/api/v1/docs`.
- Variáveis de ambiente: veja `backend/.env.example`. Os limites de requisições
  (`THROTTLE_LIMIT`, `THROTTLE_TTL_MS`, `THROTTLE_LOGIN_LIMIT`) têm padrão seguro
  (100 por minuto e 5 logins por minuto por IP) e só devem ser elevados em teste de carga.

### 3. Frontend web

```bash
cd frontend
cp .env.example .env      # VITE_API_BASE_URL
npm install
npm run dev               # http://localhost:5173
```

### 4. Mobile

```bash
cd mobile
cp .env.example .env      # EXPO_PUBLIC_API_BASE_URL
npm install
npm start                 # Expo
```

O emulador Android deste projeto roda no **Windows**, e não dentro do WSL. Se o backend estiver no
WSL, rode o Expo pelo Windows e aponte `EXPO_PUBLIC_API_BASE_URL` para um endereço que o emulador
alcance (no emulador Android padrão, o computador hospedeiro é `10.0.2.2`, por exemplo
`http://10.0.2.2:3000/api/v1`). Verificações estáticas (`npm run lint`, `npx tsc --noEmit`,
`npm test`) funcionam no WSL; o que depende do emulador precisa ser feito no Windows.

## Testes e qualidade

| Onde | Comando | O que faz |
|---|---|---|
| backend | `npm run lint` e `npm run build` | Lint sem avisos e build de produção |
| backend | `npm test` | Testes unitários |
| backend | `npm run test:integration` | Recria o banco de teste `srp_db_test` e roda os testes de integração de todos os contratos |
| frontend | `npm run lint`, `npm run build`, `npm test` | Lint, build de produção e testes |
| mobile | `npm run lint`, `npx tsc --noEmit`, `npm test` | Verificações estáticas e testes |

Os testes de integração usam um banco isolado (`srp_db_test`) e nunca tocam o banco de
desenvolvimento.

### Validação ponta a ponta (quickstart) e carga

- `backend/test/quickstart/validate-quickstart.js` percorre os cenários 0 a 6 do
  [`quickstart.md`](specs/001-gestao-rotinas-presos/quickstart.md) (feature 001) contra um backend
  rodando.
- Os 3 cenários do [`quickstart.md`](specs/002-administracao-usuarios-documentos/quickstart.md) da
  feature 002 (administração de usuários, biblioteca de documentos, troca de senha) são validados
  manualmente — sem script dedicado ainda.
- `backend/test/load/shift-change.js` é o teste de carga da troca de turno (k6, 200 usuários).
  Instruções e resultados em [`backend/test/load/README.md`](backend/test/load/README.md).

Os dois escrevem dados: rode apenas contra um banco descartável, nunca contra produção.

## Arquitetura em uma página

- **Backend em camadas** (Constituição V): controllers só recebem requisições, services concentram
  as regras de negócio e o acesso ao banco passa pelos repositórios do TypeORM. Um módulo por
  domínio em `backend/src/` (`auth`, `users`, `units`, `galleries`, `cells`, `inmates`, `movements`,
  `routines`, `posts`, `staff`, `reports`, `audit`).
- **Auditoria imutável**: toda escrita gera um registro em `audit_logs`, e uma trigger no banco
  impede `UPDATE`, `DELETE` e `TRUNCATE` nessa tabela (`research.md` #50).
- **Escopo de unidade**: todo dado é filtrado pelas unidades do usuário (FR-004a).
- **Idioma**: código e esquema do banco em inglês; textos da interface em português (Constituição XI).
- **Migrations**: o esquema só muda por migration (`synchronize` é sempre falso).

## Documentação

| Arquivo | Conteúdo |
|---|---|
| [`specs/001-gestao-rotinas-presos/spec.md`](specs/001-gestao-rotinas-presos/spec.md) | Requisitos funcionais e critérios de sucesso |
| [`specs/001-gestao-rotinas-presos/plan.md`](specs/001-gestao-rotinas-presos/plan.md) | Plano técnico |
| [`specs/001-gestao-rotinas-presos/tasks.md`](specs/001-gestao-rotinas-presos/tasks.md) | Tarefas e andamento |
| [`specs/001-gestao-rotinas-presos/data-model.md`](specs/001-gestao-rotinas-presos/data-model.md) | Modelo de dados |
| [`specs/001-gestao-rotinas-presos/contracts/`](specs/001-gestao-rotinas-presos/contracts/) | Contratos de cada grupo de endpoints |
| [`specs/001-gestao-rotinas-presos/research.md`](specs/001-gestao-rotinas-presos/research.md) | Decisões técnicas numeradas e o porquê de cada uma |
| [`specs/001-gestao-rotinas-presos/quickstart.md`](specs/001-gestao-rotinas-presos/quickstart.md) | Cenários de validação ponta a ponta |
| [`specs/002-administracao-usuarios-documentos/spec.md`](specs/002-administracao-usuarios-documentos/spec.md) | Requisitos funcionais e critérios de sucesso (administração de usuários, documentos, senha) |
| [`specs/002-administracao-usuarios-documentos/plan.md`](specs/002-administracao-usuarios-documentos/plan.md) | Plano técnico |
| [`specs/002-administracao-usuarios-documentos/tasks.md`](specs/002-administracao-usuarios-documentos/tasks.md) | Tarefas e andamento |
| [`specs/002-administracao-usuarios-documentos/data-model.md`](specs/002-administracao-usuarios-documentos/data-model.md) | Modelo de dados |
| [`specs/002-administracao-usuarios-documentos/contracts/`](specs/002-administracao-usuarios-documentos/contracts/) | Contratos de cada grupo de endpoints |
| [`specs/002-administracao-usuarios-documentos/research.md`](specs/002-administracao-usuarios-documentos/research.md) | Decisões técnicas numeradas e o porquê de cada uma |
| [`specs/002-administracao-usuarios-documentos/quickstart.md`](specs/002-administracao-usuarios-documentos/quickstart.md) | Cenários de validação ponta a ponta |
| [`docs/style-guide.md`](docs/style-guide.md) | Guia de estilo das telas (web e mobile) |
| [`docs/srp_spec_database_model.md`](docs/srp_spec_database_model.md) | Esquema do banco |
| [`.specify/memory/constitution.md`](.specify/memory/constitution.md) | Constituição do projeto |
