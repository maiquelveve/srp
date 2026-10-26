# SRP - Sistema de Rotinas Penitenciárias

Sistema digital que substitui as folhas impressas de controle de uma unidade prisional: cadastro de
presos e da estrutura (unidades, galerias, celas), movimentações em tempo real, situações
definitivas, rotinas operacionais, escalas de efetivo, relatórios e auditoria. Inclui também a
administração de usuários pela Chefia/Diretor, uma biblioteca de formulários/modelos/manuais e a
troca de senha pelo próprio usuário — essas três últimas exclusivas do painel web. A Chefia/Diretor e
os Supervisores também têm uma base de conhecimento: carregam documentos (PDF, DOCX, TXT) e fazem
perguntas em linguagem natural, respondidas por IA com base só nesses documentos.

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

### Feature 003 — Base de Conhecimento com RAG

| US | Tema | Web | Mobile |
|---|---|---|---|
| US1 | Chat: perguntar e receber resposta baseada nos documentos, com referências | sim | não (FR-003) |
| US2 | Carregar documentos (PDF, DOCX, TXT), processados em segundo plano | sim | não (FR-003) |
| US3 | Visualizar, atualizar, reprocessar e excluir documentos | sim | não (FR-003) |
| US4 | Histórico imutável de perguntas e respostas de todos os usuários | sim | não (FR-003) |

Acesso só para Supervisor e Chefia/Diretor. Detalhamento: [`specs/003-knowledge-base-rag/tasks.md`](specs/003-knowledge-base-rag/tasks.md).

## Pré-requisitos

- Node.js LTS e npm
- Docker (para o PostgreSQL local e, na feature 003, o Ollama)

## Como rodar

### 1. Banco de dados

```bash
cd docker/postgres
cp .env.example .env      # ajuste os valores
docker compose up -d
```

### 1.1. IA local da base de conhecimento (feature 003)

O banco usa a imagem `pgvector/pgvector` (extensão `vector`). A IA padrão roda localmente no
Ollama, sem enviar nenhum dado a terceiros:

```bash
cd docker/ollama
cp .env.example .env      # opcional: porta e nomes dos modelos
docker compose up -d      # sobe o Ollama e baixa bge-m3 (embeddings) e qwen2.5:7b-instruct (chat)
curl localhost:11434/api/tags   # confere os modelos baixados
```

Arquivos em `docker/ollama/`:

- `docker-compose.yml`: sobe o serviço `ollama` (o servidor de IA local, na porta 11434, com os
  modelos guardados no volume `srp-ollama-models`) e o `ollama-pull`, que roda uma vez, baixa
  `bge-m3` e `qwen2.5:7b-instruct` e termina. Roda na CPU. É o que se usa em desenvolvimento.
- `docker-compose.gpu.yml`: não sobe nada sozinho. Ele acrescenta ao serviço `ollama` a reserva da
  GPU NVIDIA, para os modelos rodarem na GPU e a consulta ficar bem mais rápida. É o que se usa em
  produção.

Em produção, use um servidor com GPU NVIDIA (8 a 12 GB de VRAM para o `qwen2.5:7b-instruct`) e o
NVIDIA Container Toolkit, e suba com os dois arquivos juntos:
`docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d`. Em CPU a consulta passa de
30 s (SC-003); veja `specs/003-knowledge-base-rag/research.md` #14.

O primeiro `up` baixa alguns GB. Sem o Ollama (ou outro provedor configurado), as demais telas
funcionam, mas enviar documentos e perguntar falham com aviso na tela.

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
- Base de conhecimento (feature 003), todas em `backend/.env.example` e com padrão para o Ollama local:
  `EMBEDDING_PROVIDER` (`ollama` | `openai`), `CHAT_PROVIDER` (`ollama` | `openai` | `claude`),
  `EMBEDDING_DIMENSIONS` (precisa bater com a coluna `vector(N)`; o backend recusa subir se não
  bater), `OLLAMA_*`, `OPENAI_*`, `ANTHROPIC_*`, `KNOWLEDGE_STORAGE_PATH`,
  `KNOWLEDGE_MIN_SIMILARITY` (nota mínima de um trecho) e `KNOWLEDGE_QUERY_RATE_LIMIT` (perguntas
  por usuário por minuto). Atenção: `openai` e `claude` enviam perguntas e trechos de documentos a
  terceiros. Trocar o modelo de embeddings marca os documentos como "Precisa reprocessar".

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
  `routines`, `posts`, `staff`, `reports`, `audit`, `knowledge`, `ai`).
- **Auditoria imutável**: toda escrita gera um registro em `audit_logs`, e uma trigger no banco
  impede `UPDATE`, `DELETE` e `TRUNCATE` nessa tabela (`research.md` #50).
- **Base de conhecimento (RAG)**: o documento é dividido em trechos, cada um vira um vetor
  (embedding) no PostgreSQL com pgvector, e a pergunta busca os trechos mais parecidos para a IA
  responder só com eles. Os provedores de IA ficam atrás de interfaces (`backend/src/ai`), então
  trocar Ollama por OpenAI ou Claude é configuração. O histórico de perguntas é imutável, por
  trigger no banco. [Veja o passo a passo completo de como o RAG funciona aqui](docs/rag-explained.md).
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
| [`specs/003-knowledge-base-rag/spec.md`](specs/003-knowledge-base-rag/spec.md) | Requisitos funcionais e critérios de sucesso (base de conhecimento com RAG) |
| [`specs/003-knowledge-base-rag/plan.md`](specs/003-knowledge-base-rag/plan.md) | Plano técnico |
| [`specs/003-knowledge-base-rag/tasks.md`](specs/003-knowledge-base-rag/tasks.md) | Tarefas e andamento |
| [`specs/003-knowledge-base-rag/data-model.md`](specs/003-knowledge-base-rag/data-model.md) | Modelo de dados |
| [`specs/003-knowledge-base-rag/contracts/`](specs/003-knowledge-base-rag/contracts/) | Contratos da API, dos fluxos e dos provedores de IA |
| [`specs/003-knowledge-base-rag/research.md`](specs/003-knowledge-base-rag/research.md) | Decisões técnicas numeradas e o porquê de cada uma |
| [`specs/003-knowledge-base-rag/quickstart.md`](specs/003-knowledge-base-rag/quickstart.md) | Cenários de validação ponta a ponta |
| [`docs/style-guide.md`](docs/style-guide.md) | Guia de estilo das telas (web e mobile) |
| [`docs/rag-explained.md`](docs/rag-explained.md) | Como o RAG funciona no backend: fluxo de ingestão e consulta, conceitos e configuração |
| [`docs/srp_spec_database_model.md`](docs/srp_spec_database_model.md) | Esquema do banco |
| [`.specify/memory/constitution.md`](.specify/memory/constitution.md) | Constituição do projeto |
