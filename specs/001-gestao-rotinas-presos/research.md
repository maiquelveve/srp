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

## 19. Notificações — função global única `notify()`, visual `Alert` + motor `sonner`

- **Decision**: `frontend/src/lib/notify.tsx` exporta `notify({ message, type, position, size?,
  duration? })` — ponto de entrada único pra qualquer mensagem de feedback ao usuário (sucesso,
  erro, aviso, info) em qualquer parte do app, em vez de cada tela gerenciar seu próprio estado de
  erro/texto inline. Quatro peças:
  - **Motor de posicionamento/empilhamento/auto-dismiss**: `sonner` (`Toaster` montado uma única
    vez em `main.tsx`, fora do `AppShell`, funciona tanto autenticado quanto no login). `position`
    é repassado por chamada (`top-left`, `top-center`, `top-right`, `bottom-left`,
    `bottom-center`, `bottom-right`), não fixo no `Toaster`.
  - **Visual**: em vez do balão padrão do `sonner`, cada notificação renderiza nosso próprio
    componente `Alert`/`AlertTitle`/`AlertDescription` (`frontend/src/components/ui/alert.tsx`,
    padrão "Custom Colors" da doc do shadcn — https://ui.shadcn.com/docs/components/radix/alert)
    via `toast.custom(..., { unstyled: true })`, com 4 variantes de cor mapeadas 1:1 no `type`:
    `success` (verde), `error` (vermelho), `warning` (âmbar), `info` (azul) — cada uma com ícone
    próprio do lucide-react (`CheckCircle2Icon`, `AlertCircleIcon`, `AlertTriangleIcon`,
    `InfoIcon`). Layout interno em flexbox (`flex items-start gap-3`), não no truque de
    `[&>svg]:absolute` + seletor de irmão do exemplo original do shadcn — esse truque depende de
    adjacência exata no DOM e quebrava dentro do wrapper de toast do `sonner` (ícone/texto
    desalinhados, caixa encolhendo pro conteúdo).
  - **Cor = fundo sólido saturado + texto quase branco**, não um tom translúcido de 10% — o
    exemplo "Custom Colors" do shadcn usa classes cruas do Tailwind (`bg-amber-950`/`text-amber-50`
    no dark mode), não os tokens semânticos do tema; `alert.tsx` reproduz isso ao pé da letra
    (`bg-red-950`/`text-red-50` pra `error`, `bg-green-950`/`text-green-50` pra `success`,
    `bg-amber-700`/`text-amber-50` pra `warning`, `bg-blue-700`/`text-blue-50` pra `info` — esses
    dois ajustados pra um tom mais claro/vibrante que o `-950` original a pedido do usuário, depois
    de testar visualmente lado a lado com os demais) em vez
    de reusar `--destructive`/`--success`/`--warning`/`--info` (que são translúcidos/vívidos
    demais pra esse efeito específico). Ainda assim precisou de um token novo,
    `--info`/`--info-foreground` (`index.css` + `tailwind.config.js`), pra badges/estados fora do
    `Alert` que continuam usando os tokens semânticos — a paleta (research.md #16) só tinha
    success/warning/destructive até aqui.
  - **Tamanho como prop do componente**: `Alert` aceita `size` (`xs`/`sm`/`md`/`lg`/`xl`, `cva`
    variant em `alert.tsx`) controlando largura máxima, padding, tamanho de fonte e do ícone juntos
    (não são classes soltas — trocar `size` troca as quatro coisas de forma coerente). `notify()`
    repassa `size` e usa `lg` como padrão (o `md` inicial ficou pequeno demais pra ler à distância
    como toast). **Pegadinha real encontrada**: `max-w-*` do `Alert` sozinho não bastava — o
    `<li>` do próprio `sonner` tem `width: var(--width)` fixo (356px por padrão) vindo da regra CSS
    `[data-sonner-toast][data-styled='true']`; com `unstyled: true` o `sonner` troca pra
    `data-styled="false"`, o que **remove essa regra inteira** (não só o visual) — setar só a
    variável `--width` não adianta mais, porque não sobra nenhuma regra lendo ela. Corrigido
    setando `style: { width: '...px' }` (propriedade `width` direta, não a variável) na chamada de
    `toast.custom()`, que como inline style vence independente de qual branch `data-styled` está
    ativo — `notify.tsx` mapeia cada `size` pro px equivalente do `max-w-*` do `Alert`.
  - **Título fixo por tipo, com complemento opcional**: `AlertTitle` não vem de `message` — é
    derivado de `type` via um mapa fixo (`error`→"Erro", `success`→"Sucesso", `warning`→"Atenção",
    `info`→"Informação"); `message` vira o conteúdo do `AlertDescription`, igual ao exemplo (título
    curto + detalhe embaixo). `notify()` aceita um `title` opcional que vira sufixo do título fixo
    ("Erro - Credenciais incorretas"); sem `title`, fica só a palavra fixa ("Erro"). `LoginPage` foi
    o primeiro consumidor real: `notify({ message: 'E-mail ou senha inválido', type: 'error' })`
    (sem `title`), em vez do parágrafo vermelho inline que existia antes.
- **Rationale**: Decisão do usuário do projeto (2026-08-07) — evitar que cada feature reimplemente
  sua própria UI de erro/sucesso, garantindo aparência e comportamento consistentes em todo o
  sistema, no visual `Alert` (não o toast genérico do sonner) que o usuário apontou como
  referência. `sonner` continua sendo o motor por já suportar posição por chamada nativamente
  (`Position` type do próprio pacote) — não fazia sentido reescrever isso à mão só pra trocar a
  aparência; `toast.custom()` permite usar `sonner` só pro mecanismo, com HTML/estilo 100% nosso.
- **Alternatives considered**: manter estado de erro local por formulário (o que já existia) —
  rejeitado, é exatamente o padrão duplicado que o usuário pediu pra eliminar; usar o `Alert` só
  como elemento inline fixo na página (sem `sonner`) — rejeitado, perderia posicionamento
  flutuante/empilhamento/auto-dismiss que `notify()` precisa suportar em qualquer tela.

## 20. Efeito de clique padrão em todos os botões (`Button`)

- **Decision**: `active:scale-95` (mais `transition-all` no lugar do antigo `transition-colors`)
  vive direto na `cva` base de `frontend/src/components/ui/button.tsx`, não em cada uso — todo
  `Button` do sistema (qualquer `variant`/`size`) encolhe levemente ao ser clicado, automaticamente,
  sem precisar repetir a classe em cada tela. Regra descoberta/validada primeiro no botão
  "Pesquisar" (`features/structure/components/StructureFilters`) — que além do clique tem um
  `hover:scale-105` próprio (cresce levemente no hover, some no clique porque `active:` vem depois
  de `hover:` na ordem padrão de variantes do Tailwind, então o `scale-95` do clique vence) — depois
  promovida pra regra global a pedido explícito do usuário (2026-08-08).
- **Rationale**: usuário quis um feedback tátil consistente em qualquer botão do app, não só nos da
  tela de estrutura; colocar na base do componente (em vez de repetir `active:scale-95` em cada
  `Button` individual) garante que isso vale por padrão em telas futuras também, sem exigir memória
  do padrão a cada novo botão.
- **Alternatives considered**: adicionar `active:scale-95` manualmente em cada botão existente —
  rejeitado, não escala (literalmente) e depende de lembrança manual em cada novo componente.

## 21. Cadastro de Unidade/Galeria/Cela sai do Mapa da Unidade — vira tela de Configurações

- **Decision**: o botão "Novo" flutuante do Mapa da Unidade (`CreateEntityDialog`, T034e) foi
  **removido** dessa tela (2026-08-08). O componente em si continua existindo em
  `frontend/src/features/structure/components/CreateEntityDialog/` — só parou de ser importado/
  renderizado por `features/structure/index.tsx` — porque a mesma funcionalidade (cadastrar
  Unidade/Galeria/Cela) vai reaparecer numa tela dedicada em `/configuracoes`, acessível pelo item
  "Configurações" do menu lateral (hoje um placeholder que cai no catch-all de `App.tsx` —
  research.md #18). Cadastro de **preso** não muda de lugar — continua dentro do Mapa da Unidade
  (`InmateDialog`, no contexto de cada cela), porque cadastrar um preso já exige saber em qual cela
  ele está, informação que só a tela do mapa tem à mão naturalmente. T034h (tasks.md, ainda não
  implementada) rastreia a construção da tela `/configuracoes` em si.
  - Efeito colateral: com o botão flutuante fora, a barra de filtros (`StructureFilters`) ficou
    visualmente esparsa — os campos "Unidade"/"Galerias" passaram de largura fixa (`w-56`) pra
    `flex-1 min-w-[200px]`, ocupando o espaço da linha em vez de ficarem agrupados à esquerda com um
    vão vazio à direita.
- **Rationale**: cadastro estrutural (unidade/galeria/cela) é uma ação administrativa pouco
  frequente — não faz sentido competir por espaço/atenção numa tela pensada pra consulta do dia a
  dia (Mapa da Unidade, usada por qualquer policial/supervisor). Centralizar esse tipo de cadastro
  numa tela de "Configurações" (ação explicitamente de administração, já prevista na navegação)
  separa consulta de administração com mais clareza — decisão do usuário do projeto.
- **Alternatives considered**: manter o botão flutuante no Mapa da Unidade — rejeitado, foi
  exatamente o incômodo que motivou a mudança; mover só parte do cadastro (ex.: manter Unidade lá,
  só Galeria/Cela pra Configurações) — rejeitado por inconsistência, mais fácil manter a regra
  simples ("cadastro estrutural = Configurações, cadastro de preso = Mapa da Unidade").
- **Layout final** (tasks.md T034i, 2026-08-14): a tela `/configuracoes` fechou como um único
  `Card` com `Tabs` (Unidades/Galerias/Celas — underline deslizante medido via JS, não CSS
  pseudo-elemento, ver a sequência de revisões em tasks.md T034h para o porquê), uma tabela por
  vez. Cada linha tem uma coluna "Ações" com dois `RowActionButton` (Editar/Desativar,
  `forwardRef` porque são usados como filho direto de `DialogTrigger`/`AlertDialogTrigger`
  `asChild`). Um único componente `EntityDialog` cobre create *e* edit pras três entidades
  (discriminated union por `entityType`), com um `Select` de tipo fixo (`GALLERY_TYPE_OPTIONS`/
  `CELL_TYPE_OPTIONS`) desde que o backend passou a constranger `type` a um enum real (T034h-type-
  enum). "Excluir" é sempre soft-deactivate (`active: false`) via `DeactivateAlert` +
  `AlertDialog` de confirmação, nunca DELETE.
  - **T034h-backend (2026-08-14) fechou o último gap**: `PATCH /api/v1/galleries/:id` e
    `PATCH /api/v1/cells/:id` existem agora (mesmo padrão de `UnitsController.update`), então os
    mocks client-side (`updateGalleryMock`/`updateCellMock`, que resolviam depois de um delay
    fake sem tocar a rede) foram removidos — `structureApi.updateGallery`/`updateCell` chamam a
    API de verdade. `EntityDialog`/`DeactivateAlert` perderam o branch "simulado" (toast
    `info`/"simulado — backend ainda não implementado" existia só pra não mentir sobre persistência
    enquanto o endpoint não existia); hoje sempre mostram sucesso real e invalidam a query certa
    (`['galleries', unitId]`/`['cells', galleryId]`) — inclusive `DeactivateAlert`, que antes só
    invalidava a lista de `units` no caminho de unidade e não tinha motivo pra invalidar
    galeria/cela (o mock nunca escrevia em cache mesmo). Sem gaps conhecidos restantes nessa tela.
  - **Correções (2026-08-14, feedback do usuário testando ao vivo)**: (1) uma linha inativa (Unidade/
    Galeria/Cela) ficava sem caminho de volta pra `active: true` no nível da própria linha — só
    "Desativar" (`Trash2Icon`) era mostrado, mesmo já inativa, e o único jeito de reativar (só pra
    Unit) era abrir `EntityDialog` e clicar num badge dentro do formulário. Adicionado `RotateCcwIcon`
    "Reativar" nas três tabelas: quando `entity.active` é `false`, a coluna Ações troca
    `DeactivateAlert` por um `RowActionButton` direto (sem confirmação — reativar não é destrutivo)
    que chama `structureApi.updateUnit`/`updateGallery`/`updateCell` com `{ active: true }` e invalida
    a query certa. (2) `GalleryCards` (Mapa da Unidade) mostrava celas inativas junto das ativas —
    correto pra `/configuracoes` (tela de gestão, por isso tem coluna Status), mas errado pro Mapa
    da Unidade, que é a tela de consulta do dia a dia: celas desativadas não têm nada a fazer lá.
    Fix: `cells = (cellsQuery.data?.data ?? []).filter((cell) => cell.active)` em
    `GalleryCard`, só nesse componente — `/configuracoes` continua puxando a mesma
    `structureApi.listCells` sem filtro, então uma cela desativada some do mapa mas continua
    visível (com "Reativar") na tela de gestão. Verificado ao vivo: desativar/reativar uma cela via
    `/configuracoes` reflete corretamente em `/mapa-da-unidade` (soma de ocupação/capacidade da
    Galeria também recalcula, já que é derivada da lista já filtrada).
  - **Revisado (2026-08-14, mesmo dia, segunda rodada de feedback)**: (1) o ícone "Reativar" tinha
    saído com o mesmo tom `primary` (amarelo) do "Editar" — indistinguível à primeira vista. Criado
    um novo tom `success` em `TONE_CLASS` (`text-success`/`bg-success`, o mesmo token de cor do badge
    "Ativo" via `ActiveBadge`), então Reativar agora lê visualmente como o oposto verde/positivo de
    Desativar, não mais uma terceira variação de amarelo. (2) Reativar disparava direto no clique,
    sem confirmação — inconsistente com Desativar (que sempre confirma via `AlertDialog`, mesmo
    sendo reversível). Extraído para um componente irmão de `DeactivateAlert`,
    `frontend/src/features/settings/components/ReactivateAlert/`, mesmo formato (discriminated
    union por `entityType`, mesma mutation/invalidação por tipo), só que com o `AlertDialogAction`
    estilizado em verde (`bg-success text-success-foreground`) em vez do `variant="destructive"`
    padrão. (3) Adicionado um filtro Status (`Ativas`/`Inativas`, um `Select` — nunca os dois ao
    mesmo tempo) ao lado do seletor de Galeria na aba Celas de `/configuracoes`, `cellStatusFilter`
    com default `'active'` — a lista de celas é filtrada no cliente sobre a mesma resposta de
    `structureApi.listCells` (que já traz ativas e inativas juntas), sem round-trip extra ao
    backend. Escopo só na aba Celas, por pedido explícito do usuário (não replicado nas abas
    Unidades/Galerias). Verificado ao vivo: ícone verde + diálogo "Reativar Cela Z01?" com botão
    verde; trocar Status pra "Inativas" isola só a cela inativa, "Ativas" isola só as ativas.
  - **Revisado (2026-08-14, mesmo dia, terceira rodada de feedback)**: (1) o verde de
    `bg-success` (mesmo token do ícone/badge) ficou claro/pálido demais como preenchimento de botão
    sólido dentro do `AlertDialog` — trocado por um verde mais escuro no `AlertDialogAction`
    (`bg-[hsl(142_71%_24%)]`, mesmo matiz/saturação do token `--success`, só com lightness menor;
    hover `hsl(142_71%_18%)`), sem mexer no ícone (`TONE_CLASS.success`), que já estava bom. (2) `F5`
    numa unidade selecionada voltava sempre pra primeira da lista — tanto em `/configuracoes`
    quanto em `/mapa-da-unidade`, o `unitId` só existia como `useState` em memória, perdido a cada
    reload. Fix simples e direto: guardar o `unitId` escolhido no `localStorage` (chaves
    independentes por tela — `srp:settings:lastUnitId` e `srp:structure:lastUnitId`, as duas telas
    não precisam compartilhar seleção), inicializar o `useState` lendo essa chave, e trocar a
    condição do efeito de "auto-selecionar a primeira unidade" de `unitId === null` para
    `unitId === null || essa unidade não está mais na lista atual` — assim o valor restaurado do
    `localStorage` só é descartado se de fato não for mais válido (ex.: usuário perdeu acesso àquela
    unidade), não do zero a cada carregamento. Nenhuma mudança no backend — puramente
    armazenamento do lado do cliente. Verificado ao vivo nas duas telas: selecionar uma unidade,
    dar F5, a seleção se mantém (em vez de voltar pra primeira da lista).
## 22. Página/menu "Início" — decisão de conteúdo explicitamente adiada

- **Decision**: **Conteúdo ainda não resolvido, de forma intencional — casca já implementada.**
  Existe um item de navegação "Início" em `AppShell` (research.md #18), primeiro item do menu,
  apontando pra `frontend/src/pages/HomePage/index.tsx` (folder-per-component per research.md
  #17) — mas a página em si é **em branco**. O que ela efetivamente mostra (dashboard com
  métricas, atalhos pras telas mais usadas, widgets customizáveis, ou combinação disso) ainda não
  foi definido pelo dono do produto; isso é uma decisão separada, posterior, que substituirá este
  bullet quando tomada.
- **Rationale**: Definido explicitamente pelo usuário do projeto (2026-08-08): existir uma tela
  "Início" já é certo (todo sistema com `AppShell`/sidebar como esse tipicamente tem uma landing
  page própria, separada das telas operacionais como Mapa da Unidade), mas o *conteúdo* dela
  depende de decisões de produto (o que priorizar mostrar pra cada perfil de usuário) que ainda não
  foram tomadas — construir a casca agora evita que a decisão de conteúdo bloqueie o item de
  navegação/rota em si.
- **Follow-up necessário antes do conteúdo poder ser definido**: decidir o que a página mostra
  (dashboard/atalhos/widgets/outra coisa), então voltar a este item e substituir este bullet por
  uma decisão concreta de layout/conteúdo (tasks.md T034k, ainda bloqueada por essa decisão de
  produto).
- **Rota padrão + 404 (tasks.md T034j, 2026-08-14)**: decisão explícita do usuário do projeto —
  "Início" (`/inicio`) virou o destino padrão pós-login (`LoginPage` navega pra lá em vez de
  `/mapa-da-unidade`) e o alvo de `/` (`<Navigate to="/inicio" replace />` em `App.tsx`, antes do
  `ProtectedRoute` — redireciona antes mesmo de checar autenticação, então usuário deslogado acaba
  em `/login` do mesmo jeito via `ProtectedRoute`). Junto disso (T034j-404page, escopo novo
  descoberto ao implementar T034j, não previsto originalmente na task): o catch-all `*` de
  `App.tsx`, que antes fazia `<Navigate to="/mapa-da-unidade" replace />` silenciosamente pra
  qualquer rota desconhecida, virou uma página `NotFoundPage`
  (`frontend/src/pages/NotFoundPage/index.tsx`) de verdade — "404" + mensagem + botão linkando pra
  `/inicio`. Renderizada fora do `AppShell`/`ProtectedRoute` (standalone, sem sidebar) de propósito,
  pra um visitante não-autenticado batendo numa URL inválida também ver a 404 em vez de um redirect
  cego; o link "Voltar para o Início" ainda o manda pro fluxo normal de login via
  `ProtectedRoute`. Efeito colateral esperado e aceito: todo item de nav ainda não implementado
  (Movimentações, Situações Definitivas, Rotinas, Efetivo, Relatórios e Auditoria, Documentos,
  Ajuda, etc. — US2–US6) agora cai nessa 404 em vez de silenciosamente mostrar o Mapa da Unidade
  como antes; mais correto do que fingir que a rota existe. Verificado via Playwright: `/` →
  `/inicio` com `AppShell` completo; rota inválida → 404 standalone; botão "Voltar para o Início" →
  `/inicio` com `AppShell`; login → `/inicio`; clique em item de nav não implementado → 404.
