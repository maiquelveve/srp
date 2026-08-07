# Phase 0 Research: Gestão de Rotinas Penitenciárias (SRP)

**Input**: Technical Context em [plan.md](./plan.md), `docs/srp_plan.md`, `docs/srp_spec_database_model.md`.

Todas as decisões de stack (NestJS, TypeORM, PostgreSQL, React/Vite, React Native/Expo) já vêm
determinadas por `docs/srp_plan.md` e não são tratadas como incertezas — nenhum item do Technical
Context ficou marcado como `NEEDS CLARIFICATION`. As pesquisas abaixo resolvem as decisões de
melhores práticas necessárias para implementar essa stack em conformidade com a Constituição do
projeto.

**Convenção de nomenclatura**: a partir da versão 1.1.0 da Constituição (Princípio XI), todo
identificador de código e de schema de banco citado neste documento usa o nome em inglês que será
efetivamente usado nas entities TypeORM e no código (ex.: `inmates.status`, não `presos.status`).

## 1. Framework de testes — Backend

- **Decision**: Jest para testes unitários de services/controllers, Supertest para testes de
  integração de endpoints HTTP (com banco de teste PostgreSQL isolado via TypeORM/`DataSource` dedicado a testes).
- **Rationale**: Jest é o test runner padrão gerado pelo NestJS CLI, com suporte nativo a mocking
  de providers via `@nestjs/testing`; Supertest é o padrão de facto para testar módulos NestJS
  ponta a ponta sem subir um servidor real.
- **Alternatives considered**: Vitest (mais rápido, mas exige configuração extra para o
  decorator-based DI do NestJS e tem suporte comunitário menor no ecossistema Nest); testes
  manuais via Postman/Insomnia (rejeitado — não é automatizável, viola Constituição VIII).

## 2. Framework de testes — Frontend web

- **Decision**: Vitest + React Testing Library para testes de componentes e dos fluxos principais
  (registro/edição de rotina, consulta de status, relatórios).
- **Rationale**: Vitest compartilha configuração e transformações com o Vite já usado no build do
  frontend, resultando em testes rápidos e sem configuração duplicada; React Testing Library
  incentiva testar comportamento visível ao usuário, alinhado à Constituição VIII.
- **Alternatives considered**: Jest com `ts-jest`/`babel-jest` (funciona, mas exige configuração
  paralela à do Vite, com risco de divergência); Cypress Component Testing (mais pesado, reservado
  para os poucos fluxos E2E críticos, não para todos os componentes).

## 3. Framework de testes — Mobile

- **Decision**: Jest + React Native Testing Library, com foco na lógica da fila offline
  (enfileirar, sincronizar, evitar duplicação) e nas telas críticas (registro de movimentação,
  consulta de presos).
- **Rationale**: Padrão suportado nativamente pelo Expo/React Native, mesma ferramenta usada no
  backend reduz custo de manutenção de configuração de testes no monorepo.
- **Alternatives considered**: Detox (E2E real em dispositivo/simulador) — útil para uma suíte de
  smoke tests futura, mas desproporcional para cobrir toda a lógica de sincronização offline nesta
  fase.

## 4. Estratégia de sincronização offline do app móvel (FR-011a)

- **Decision**: Fila local persistente (SQLite via `expo-sqlite`) armazenando movimentações
  registradas sem conexão, cada uma com um identificador idempotente gerado no cliente
  (UUID) enviado ao backend. Um serviço de sincronização em background reenvia a fila assim que a
  conectividade é restabelecida; o backend usa o identificador idempotente para rejeitar
  duplicatas caso o mesmo item seja reenviado.
- **Rationale**: Atende FR-011a (registrar offline e sincronizar sem perda/duplicação) e a
  Constituição IV (Data Integrity — nunca permitir estados inconsistentes), já que o servidor
  continua sendo a fonte de verdade e apenas aceita cada movimentação uma única vez.
- **Alternatives considered**: Fila apenas em memória (rejeitada — perdida se o app for encerrado,
  risco de perda de registro operacional); replicação offline-first completa do banco no
  dispositivo (rejeitada — complexidade desproporcional, já que apenas o registro de movimentação
  precisa funcionar offline conforme a spec, não o cadastro completo).

## 5. RBAC com escopo por unidade (FR-004a)

- **Decision**: O JWT emitido no login carrega `role` e a lista de `unitId` a que o usuário está
  vinculado. Guards do NestJS validam tanto o perfil (RBAC) quanto o escopo de unidade em todo
  endpoint que manipula presos, rotinas, escalas ou auditoria, filtrando/validando o `unitId` do
  recurso acessado contra o token.
- **Rationale**: Implementa diretamente a decisão tomada em `/speckit-specify` (FR-004a) e mantém
  a validação de autorização inteiramente no backend, conforme Constituição II (Security First) —
  o frontend/mobile nunca é a única barreira de controle de acesso.
- **Alternatives considered**: Checagem de unidade apenas em queries do frontend (rejeitada —
  viola Security First, pode ser contornada por chamadas diretas à API); tabela de permissões
  totalmente dinâmica por usuário (rejeitada — spec não pede granularidade além de
  perfil × unidade, adicionaria complexidade não requisitada, contra a Constituição IX).

## 6. Auditoria automática e imutável, com redação de dados sensíveis (Constituição II/III, FR-026/FR-027)

- **Decision**: Um `AuditInterceptor` global captura toda requisição de escrita bem-sucedida
  (POST/PATCH/PUT/DELETE) nos módulos de negócio e delega a um `AuditService` central, que grava
  usuário responsável, ação, entidade afetada, valores antigos/novos e data/hora na tabela
  `audit_logs`. Nenhum controller ou repository expõe rota de update/delete para essa tabela.
  Antes de persistir `oldData`/`newData`, o `AuditService` MUST aplicar uma lista de redação
  (`REDACTED_FIELDS`) que substitui o valor de campos sensíveis por `"[REDACTED]"` — no mínimo:
  `passwordHash`, `refreshTokenHash`, e qualquer outro campo futuramente marcado como sensível via
  decorator (`@Sensitive()`) na entity TypeORM. Isso vale tanto para o módulo de usuários quanto
  para qualquer módulo futuro que grave dado sensível.
- **Rationale**: Centralizar a captura evita depender de cada desenvolvedor lembrar de logar
  manualmente em cada novo endpoint (fonte comum de lacunas de auditoria), atendendo à exigência
  de que auditoria seja total (Constituição III). A redação de campos sensíveis evita que o hash
  de senha ou tokens de sessão fiquem expostos em `audit_logs` — que é lido por Supervisor/Chefia
  via `/api/v1/audit` — violando a Constituição II ("Nenhuma informação sensível pode ser exposta
  por APIs, logs ou interfaces"). Esse gap foi identificado em `/speckit-analyze` (achado C1) e
  fechado aqui antes da implementação de T016.
- **Alternatives considered**: Chamadas manuais de log em cada service (rejeitada — frágil, fácil
  esquecer em endpoints novos); triggers de banco (`pg_audit`/triggers SQL) isoladamente
  (rejeitada como única solução — não tem acesso direto ao "usuário responsável" da requisição
  HTTP sem contexto de aplicação; pode ser avaliada futuramente como camada extra de defesa, fora
  do escopo desta fase); não redigir e restringir apenas o acesso de leitura à auditoria
  (rejeitada — viola defesa em profundidade; um supervisor com acesso legítimo à auditoria não
  deveria conseguir ver hash de senha de outro usuário).

## 7. Segurança de transporte e da API

- **Decision**: `@nestjs/throttler` para rate limiting por IP/usuário, `helmet` para cabeçalhos de
  segurança HTTP, CORS restrito a um allow-list (origem do frontend web); o app mobile autentica
  via JWT sem depender de CORS de navegador. Senhas com Argon2; sessão via access token JWT de
  vida curta + refresh token.
- **Rationale**: Requisitos explícitos de `docs/srp_plan.md` (JWT, Refresh Token, RBAC, Hash
  Argon2, Rate Limiting, Helmet, CORS), diretamente alinhados à Constituição II.
- **Alternatives considered**: Sessões baseadas em cookie server-side (rejeitada — plano exige
  JWT/refresh token explicitamente); bcrypt no lugar de Argon2 (rejeitada — plano especifica
  Argon2, algoritmo recomendado atualmente para hashing de senha).

## 8. Migrations e schema do banco

- **Decision**: TypeORM é o ORM exclusivo do backend (`@nestjs/typeorm` + `pg`). Cada módulo
  define suas próprias entities (`<módulo>/entities/*.entity.ts`, decoradas com `@Entity`),
  espelhando tabela a tabela o modelo de `docs/srp_spec_database_model.md`. Toda mudança de
  schema passa exclusivamente por migrations geradas via `typeorm migration:generate` a partir de
  um `DataSource` central (`backend/src/database/data-source.ts`) e aplicadas via
  `typeorm migration:run`; `synchronize` do TypeORM MUST ficar `false` em todos os ambientes
  (geração automática de schema sem migration violaria a mesma regra que uma alteração manual).
  Nenhuma alteração manual (`ALTER TABLE` direto) é permitida em nenhum ambiente. Todos os nomes
  de tabela/coluna são em inglês (Constituição XI).
- **Rationale**: Requisito explícito do usuário do projeto (2026-08-04) — TypeORM é o ORM nativo
  do NestJS e já era implícito na estrutura de módulo descrita em `docs/srp_plan.md` ("Cada
  módulo deve conter: Controller, Service, Repository, DTOs, Entities, Validators, Tests"), que
  pressupõe uma entity por módulo em vez de um schema único centralizado. Também atende ao
  requisito de `docs/srp_plan.md` ("Nenhuma alteração manual no banco é permitida") e à
  Constituição IV (Data Integrity / nunca estados inconsistentes).
- **Alternatives considered**: Prisma ORM (descartado — decisão anterior deste documento, revertida
  explicitamente pelo usuário do projeto em favor do ORM nativo do NestJS); ferramenta de
  migration separada (Flyway/Knex) — rejeitada, pois o TypeORM já cobre geração e execução de
  migrations integrada ao ciclo de vida da aplicação NestJS.

## 9. `inmates.status` como projeção derivada (Constituição VI)

- **Decision**: A coluna `inmates.status` é atualizada transacionalmente pelo mesmo
  service/transaction que grava a movimentação, a situação definitiva ou a troca de cela em
  `inmate_cell_history`/`movements` — nunca editada isoladamente por outro fluxo.
- **Rationale**: SC-003 exige consulta de status em até 5s; recalcular o status a partir do
  histórico completo a cada consulta não escalaria para 200+ usuários simultâneos (SC-004). Manter
  uma projeção sempre escrita na mesma transação que sua fonte evita duplicação de fonte de
  verdade divergente, respeitando a intenção da Constituição VI mesmo usando uma coluna
  desnormalizada para leitura rápida.
- **Alternatives considered**: Calcular status em tempo de leitura via `JOIN`/subquery no
  histórico (rejeitada nesta fase — custo de performance incompatível com SC-003 em escala);
  view materializada com refresh assíncrono (rejeitada — introduziria janela de inconsistência
  entre o evento real e o status exibido, inaceitável para um sistema de segurança).

## 10. Gestão de usuários restrita à Chefia/Diretor (FR-030…FR-032)

- **Decision**: `POST /api/v1/users` e `PATCH /api/v1/users/:id/deactivate` exigem perfil
  `WARDEN` (Chefia/Diretor). A senha inicial é gerada pelo backend (nunca escolhida/transmitida
  em texto claro pelo criador) e comunicada fora da API via `POST /api/v1/auth/set-initial-password`
  (`contracts/auth.md`), com token de convite de uso único e expiração curta, evitando que a senha
  em texto claro trafegue em qualquer payload capturado por logs/auditoria.
- **Rationale**: Fecha o achado G1 do `/speckit-analyze` — sem isso, não havia forma de
  provisionar contas além do seed inicial. Restringir a `WARDEN` está alinhado a FR-004
  (somente Chefia/Diretor administra configurações estruturais) e ao pedido explícito do usuário
  do projeto de que a criação de usuários seja exclusiva desse perfil.
- **Alternatives considered**: Autocadastro com aprovação (rejeitado — spec não descreve fluxo de
  aprovação e adicionaria superfície de ataque não requisitada); Supervisor também podendo criar
  usuários (rejeitado — fora do que foi solicitado; FR-003 já restringe Supervisor de alterar
  estrutura de permissões).

## 11. Revogação de refresh token (contracts/auth.md — logout)

- **Decision**: Tokens de refresh são persistidos como hash (SHA-256) na tabela `refresh_tokens`,
  vinculados ao `userId`, com `expiresAt` e `revokedAt` (nulo enquanto válido). `POST /auth/login`
  cria uma linha; `POST /auth/refresh` roda rotação (revoga o token antigo, cria um novo);
  `POST /auth/logout` marca `revokedAt = now()`. O guard de autenticação por refresh token rejeita
  qualquer token cujo hash não exista ou esteja revogado/expirado.
- **Rationale**: Fecha o achado G3 — o contrato de auth já prometia "revoga o refresh_token atual"
  no logout, mas nenhuma entidade persistia tokens para tornar isso possível com JWT stateless.
  Hash (não o token em claro) evita que um vazamento da tabela permita reuso direto dos tokens
  (mesma lógica do Argon2 para senha, Constituição II).
- **Alternatives considered**: Blocklist apenas em memória/Redis (rejeitada nesta fase — adiciona
  dependência de infraestrutura não listada em `docs/srp_plan.md`; pode ser avaliada depois como
  otimização de performance, mantendo `refresh_tokens` como fonte de verdade); refresh token
  puramente stateless sem revogação (rejeitada — impossibilita logout real, violando a expectativa
  de segurança de um sistema prisional).

## 12. Configuração de efetivo mínimo (FR-024)

- **Decision**: Nova entidade `minimum_staffing_config` (setor, turno, unidade, valor mínimo),
  editável apenas por `WARDEN` via `PATCH /api/v1/staff/minimum-staffing-config`.
  `GET /schedules/minimum-staffing` passa a ler o valor configurado nesta tabela em vez de um
  número fixo no código.
- **Rationale**: Fecha o achado G2 — `docs/srp_spec.md` e a spec já mencionavam um "efetivo
  mínimo configurável", mas nenhuma entidade/endpoint definia onde esse valor vive. Sem isso,
  `abaixoDoMinimo`/`belowMinimum` não teria como ser calculado de forma real.
- **Alternatives considered**: Valor fixo via variável de ambiente (rejeitada — spec diz
  explicitamente que é definido "pela Chefia/Diretor", implicando configuração em tempo de
  execução, não em deploy).

## 13. Armazenamento de foto do preso (FR-006) — decisão explicitamente adiada

- **Decision**: **Não resolvida nesta fase, de forma intencional.** `inmates.photoUrl` permanece
  como campo de texto (URL) no schema. O provedor de armazenamento de arquivo (AWS S3, Google
  Cloud Storage, servidor próprio, ou outro) ainda não foi escolhido pelo dono do produto — a
  escolha depende de decisão de infraestrutura/custo fora do escopo desta fase de planejamento.
- **Rationale**: Definido explicitamente pelo usuário do projeto (2026-08-04): a coluna já reflete
  a decisão correta (guardar uma URL, não o binário), e a implementação do endpoint de upload e do
  provedor concreto fica bloqueada até essa escolha ser feita. Isso substitui o achado U1 do
  `/speckit-analyze` — deixa de ser um gap silencioso e passa a ser uma decisão rastreada aqui.
- **Follow-up necessário antes da Fase 3 (US1) poder implementar upload real**: escolher provedor,
  então voltar a este item e substituir esta seção por uma decisão concreta (bucket, política de
  acesso, geração de URL assinada, limite de tamanho/formato).
- **Enquanto isso**: `POST/PATCH /api/v1/inmates` aceita `photoUrl` como string opcional já
  hospedada externamente; nenhuma task de upload de arquivo é criada em `tasks.md` até esta
  decisão ser tomada.

## 14. Ferramenta de teste de carga (SC-004)

- **Decision**: k6 (script versionado em `backend/test/load/shift-change.js`) simulando 200
  usuários virtuais executando o mix de leitura/escrita típico da troca de turno (login, consulta
  de presos por cela/galeria, registro de movimentação de saída/retorno), medindo p95 de latência
  e taxa de erro.
- **Rationale**: Fecha o achado G4 — havia uma task de "verificar" SC-004 sem nenhuma ferramenta
  definida para produzir a carga. k6 roda via CLI/CI sem dependência de infraestrutura adicional
  além do binário, e tem suporte nativo a definir thresholds (ex.: `p(95)<500`) que falham o build
  automaticamente se SC-004 não for atendido — torna o critério verificável de forma repetível,
  não apenas "verificado manualmente uma vez".
- **Alternatives considered**: Artillery (também viável, mas k6 tem melhor suporte nativo a
  thresholds declarativos que mapeiam 1:1 para SC-004); teste de carga manual/ad-hoc (rejeitado —
  não é repetível, viola Constituição VIII).

## 15. Policial Penal = User (sem entidade Staff separada) (FR-021)

- **Decision**: Não existe entidade/tabela "Staff" própria. Um policial penal é um `User` com
  `role=PRISON_OFFICER`; o campo `jobTitle` (cargo) foi adicionado a `User` para atender FR-021.
  Cadastro via `POST /api/v1/users`; roster via `GET /api/v1/users?role=PRISON_OFFICER`
  (`SUPERVISOR` e `WARDEN`, contracts/structure.md). `POST/GET /api/v1/staff` foram removidos de
  `contracts/staff.md` — essa seção cobre apenas escalas (`schedules`) e config de efetivo mínimo.
- **Rationale**: Decisão explícita do usuário do projeto (2026-08-04): manter simples, evitar duas
  fontes de cadastro para a mesma pessoa física. Fecha o achado I1 do `/speckit-analyze`, que
  identificou risco de dois registros divergentes (Constituição VI — Single Source of Truth) entre
  `POST /users` e `POST /staff`.
- **Alternatives considered**: entidade `Staff` separada vinculada 1:1 a `User` (rejeitada pelo
  usuário do projeto — "não faz sentido" ter cadastro funcional sem login associado nesse
  domínio).

## 16. Paleta de cores e tema do frontend web/mobile (identidade visual)

- **Decision**: Tema **escuro como padrão** (não opcional/alternativo) em ambos os clientes,
  usando os tokens de cor padrão do shadcn/ui (`--background`, `--foreground`, `--primary`,
  `--card`, `--border`, etc., definidos como variáveis HSL em `frontend/src/index.css` e mapeados
  no `tailwind.config.js`). Duas camadas de cor, deliberadamente separadas:
  - **Identidade de marca** — preto (fundo, `--background`/`--card`) + dourado/âmbar
    (`--primary`, `43 96% 56%` no dark), derivados do emblema oficial da Polícia Penal do RS
    (brasão dourado sobre fundo preto) e da farda operacional (preto sólido, sem detalhes de
    outra cor). Usado em navegação, botões primários, logo.
  - **Semântica de status** — verde (`--success`), vermelho (`--destructive`), âmbar
    (`--warning`) para estados de dado real do domínio: `Inmate.status = ACTIVE` (verde),
    `inMovement = true` / efetivo abaixo do mínimo / inconsistência (âmbar/vermelho). Convenção
    universal de dashboard, independente da cor de marca.
- **Rationale**: Decisão do usuário do projeto (2026-08-06), a partir de fotos do brasão oficial
  e da farda da Polícia Penal RS. Modo escuro como padrão (não só disponível) tem justificativa
  funcional, não só estética: policiais penais operam em turnos noturnos numa sala de controle —
  uma UI escura reduz fadiga visual nesse contexto, além de casar com a identidade preto/dourado
  da farda. As cores de status (verde/vermelho/âmbar) foram mantidas por já corresponderem a
  cores presentes no brasão do RS (verde/vermelho/branco no centro do emblema) e por já serem a
  convenção universal de legibilidade rápida em painéis operacionais — não é decoração, mapeia
  direto pra campos que já existem na API (`status`, `inMovement`, `belowMinimum`).
- **Alternatives considered**: usar verde/vermelho/branco (cores do brasão do RS) como cor de
  **identidade** da UI — rejeitado, ficaria com cara de bandeira/heráldica em vez de software
  institucional, e colidiria com o significado semântico de status; tema claro como padrão com
  escuro opcional — rejeitado, não haveria motivo funcional pra inverter a prioridade dado o
  contexto real de uso (plantão/turno).

## 17. Convenção de pastas — folder-per-component (`index.tsx`) no `frontend/`

- **Decision**: Toda página e todo componente do `frontend/` — de feature ou compartilhado
  (`components/ui/` do shadcn é a única exceção, por ser código vendorizado pela CLI), com um
  arquivo só ou vários — vive em sua própria pasta nomeada pelo conceito (`PascalCase` para
  componentes; nome da feature/rota para páginas), com `index.tsx` como ponto de entrada único.
  Sem exceção por tamanho: um componente de uma linha só ganha a mesma estrutura de pasta que um
  componente com teste/subcomponente/estilo próprio. `types.ts`/`api.ts` de uma feature (nível
  feature, não por componente) ficam soltos ao lado do `index.tsx` da feature, não dentro de pasta
  própria. Exemplo:

  ```text
  features/structure/
  ├── index.tsx                        # a página (era StructurePage.tsx)
  ├── types.ts
  ├── api.ts
  └── components/
      └── StatusBadge/
          └── index.tsx
  ```

- **Rationale**: Decisão do usuário do projeto (2026-08-06). A alternativa considerada — pasta só
  quando o componente "cresce" (ganha teste, subcomponente, etc.) — foi rejeitada pelo próprio
  usuário: cria dois padrões coexistindo no mesmo código (arquivo solto vs. pasta+`index.tsx`) sem
  regra objetiva de quando migrar de um pro outro, e cada componente que cresce vira um refactor
  de estrutura em vez de só editar o arquivo. Uma regra única e sem exceção elimina esse julgamento
  caso a caso. A objeção óbvia — múltiplas abas abertas todas nomeadas `index.tsx` — foi julgada
  aceitável porque os editores modernos (VSCode incluso) já desambiguam abas com nome igual
  mostrando o nome da pasta-pai.
- **Alternatives considered**: arquivo plano sempre (`StatusBadge.tsx`), pasta só quando o
  componente ganha mais de um arquivo — rejeitado pelo motivo acima (padrão inconsistente ao
  longo do tempo); arquivo plano sempre, sem nunca usar pasta+`index.tsx` — rejeitado, perde a
  possibilidade de colocar teste/estilo/subcomponente junto sem renomear import paths depois.

## 18. `AppShell` — chrome compartilhado via layout route (React Router `<Outlet />`)

- **Decision**: `frontend/src/layouts/AppShell/index.tsx` concentra tudo que é fixo em toda tela
  autenticada — sidebar (símbolo + navegação) e barra superior (avatar/role do usuário, menu
  suspenso com "Sair") — no padrão visual do bloco `dashboard-01` do shadcn/ui já validado com o
  usuário. Implementado como **layout route** do React Router: `AppShell` não importa nenhuma
  página, só renderiza `<Outlet />` no centro; cada página vira uma rota filha aninhada dentro
  dela em `App.tsx`. O item de menu ativo não é passado por prop — o `NavLink` do React Router já
  compara sozinho `to` com a URL atual e aplica a classe correspondente. Páginas fora do fluxo
  autenticado (`LoginPage`, e futuras telas de erro 404/500) ficam em rotas irmãs, fora da
  `AppShell`, e não recebem esse chrome.
- **Rationale**: Decisão do usuário do projeto (2026-08-06) — evita repetir sidebar/topo em cada
  página nova (US2–US6 vão todas herdar o mesmo shell) e mantém cada página responsável só pelo
  próprio conteúdo. Layout route + `<Outlet />` é o mecanismo nativo do React Router pra isso (já
  usado no projeto por `ProtectedRoute`), então não introduz uma biblioteca ou padrão novo.
- **Alternatives considered**: cada página receber o item de menu ativo via prop e repassar pro
  shell — rejeitado, obrigaria toda página nova a "avisar" o layout quem ela é, exatamente o tipo
  de repetição que a `AppShell` existe pra eliminar.
- **Revisão (2026-08-06, mesmo dia)**: a primeira versão do `AppShell` reimplementava o efeito
  visual do `Sidebar` oficial (canvas cinza + painel preto arredondado "inset") à mão, com CSS
  próprio — decisão registrada acima como "adotar o `Sidebar` completo foi adiado por ora". Testes
  visuais reais (via Playwright MCP, comparando contra o bloco `dashboard-01` oficial rodando lado
  a lado) mostraram que a versão à mão não reproduzia o efeito corretamente e tinha aparência
  amadora. **Decisão revertida**: `AppShell` passou a usar o componente `Sidebar` oficial do
  shadcn/ui de fato (`SidebarProvider`, `Sidebar variant="inset"`, `SidebarInset`, `SidebarHeader/
  Content/Footer`, `SidebarMenuButton` com `isActive`), estruturado em
  `layouts/AppShell/components/{NavMain,NavUser,SiteHeader}/index.tsx` (convenção #17) com dados
  reais (nosso menu, nosso usuário via `useAuth()`), no lugar do menu/usuário fake do bloco. A
  responsividade mobile completa (`Sheet`, colapso por cookie) continua não sendo o foco — usamos
  o componente oficial pela fidelidade visual e pela ativação de estado (`data-active`) corretas,
  não pelas features mobile, mas elas vêm "de graça" por já fazerem parte do componente.
