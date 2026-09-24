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

- **Decision (conteúdo definido, 2026-09-21, tasks.md T034k)**: nada de dashboard/atalhos/widgets
  — a "Início" mostra só o logo da Polícia Penal RS centralizado (`frontend/src/assets/logo-pp-rs.png`)
  com "Sistema de Rotinas Penitenciárias" abaixo, mesmo par logo+nome já usado em
  `LoginPage`/`AppShell` (research.md #18). `HomePage`
  (`frontend/src/pages/HomePage/index.tsx`) vira `flex flex-1 flex-col items-center justify-center`
  preenchendo a área de conteúdo do `AppShell` (`<main className="flex flex-1 flex-col ...">`
  em `layouts/AppShell/index.tsx`). Decisão explícita do dono do produto: uma landing "vazia" com
  identidade visual da instituição é suficiente por ora — métricas/atalhos ficam para uma
  iteração futura, sem task aberta associada até serem pedidos.
- Histórico da decisão adiada (até 2026-09-21): existia um item de navegação "Início" em
  `AppShell` (research.md #18), primeiro item do menu, apontando pra
  `frontend/src/pages/HomePage/index.tsx` (folder-per-component per research.md #17) — mas a
  página em si era **em branco**. O que ela efetivamente mostraria (dashboard com métricas,
  atalhos pras telas mais usadas, widgets customizáveis, ou combinação disso) ainda não tinha sido
  definido pelo dono do produto.
- **Rationale**: Definido explicitamente pelo usuário do projeto (2026-08-08): existir uma tela
  "Início" já é certo (todo sistema com `AppShell`/sidebar como esse tipicamente tem uma landing
  page própria, separada das telas operacionais como Mapa da Unidade), mas o *conteúdo* dela
  depende de decisões de produto (o que priorizar mostrar pra cada perfil de usuário) que ainda não
  foram tomadas — construir a casca agora evita que a decisão de conteúdo bloqueie o item de
  navegação/rota em si.
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

## 23. Desativação em cascata — Unidade → Galeria → Cela, bloqueada se houver preso ATIVO

- **Decision** (2026-08-14, pedido explícito do usuário): desativar uma Unidade agora desativa em
  cascata todas as suas Galerias e as Celas dessas Galerias; desativar uma Galeria desativa em
  cascata suas Celas. A cascata **é bloqueada** (`409 Conflict`, transação revertida) se existir
  qualquer preso com `status = ACTIVE` em qualquer Cela dentro do escopo sendo desativado — nesse
  caso nada é alterado, nem o próprio registro que o usuário tentou desativar.
- **Rationale — por que bloquear em vez de arrastar o preso junto**: `Inmate` não tem campo
  `active` (só `status: InmateStatus`, ver enum em `inmates/entities/inmate.entity.ts`), e o
  comentário no próprio código já deixa explícito que esse campo é uma projeção que só o módulo de
  Movimentações (`POST /movements/final/*`, US2/US3, ainda não implementado) pode escrever —
  "kept transactionally in sync with movements/inmate_cell_history... never written by an
  independent flow". Escrever `status` a partir de uma cascata de desativação estrutural violaria
  essa regra e não tem um valor de enum que signifique corretamente "preso cuja cela foi
  desativada" (`RELEASED`/`ANKLE_MONITOR`/`TRANSFERRED`/`DECEASED` são todos situações definitivas
  reais, não um efeito colateral administrativo). Perguntado ao usuário via 3 opções — bloquear
  (escolhida), cascata só estrutural ignorando o preso (deixaria um preso ACTIVE numa cela
  inativa, estado inconsistente), ou mudar o modelo do Inmate (maior escopo, quebra a regra atual).
  Bloquear é também o comportamento mais correto operacionalmente: não faz sentido desativar uma
  ala/unidade que ainda tem gente alojada nela sem antes mover ou liberar essas pessoas.
- **Implementação**: `UnitsService.update`/`GalleriesService.update` (`backend/src/units/`,
  `backend/src/galleries/`) — ao detectar uma transição `active: true → false` (não em toda
  atualização, só quando o PATCH efetivamente desativa), rodam dentro de uma
  `DataSource.transaction()`: (1) conta presos `ACTIVE` em qualquer Cela do subtree via
  `innerJoin` (Unit→Gallery→Cell→Inmate ou Gallery→Cell→Inmate); (2) se `count > 0`, lança
  `ConflictException` (a exceção dentro do callback da transação já faz rollback automático); (3)
  senão, atualiza em cascata (`manager.update`) as Galerias/Celas descendentes para `active:
  false`, e só então a própria entidade. `CellsService.update` faz o mesmo check (sem cascata
  further, é o nível folha da árvore estrutural) mas sem transação — é uma escrita de linha única,
  mesmo padrão de race-window aceito em outras checagens deste service (ex.: capacidade em
  `create()`).
  - **Dependência circular evitada**: `UnitsModule` normalmente não conhece `Gallery`/`Cell`/
    `Inmate`, e `GalleriesModule` não conhece `Cell`/`Inmate` — importar `GalleriesModule`/
    `CellsModule`/`InmatesModule` de volta em `UnitsModule`/`GalleriesModule` criaria um ciclo
    (`GalleriesModule` já importa `UnitsModule`; `CellsModule` já importa `GalleriesModule`). Fix:
    registrar essas entidades via `TypeOrmModule.forFeature([...])` direto em `UnitsModule`/
    `GalleriesModule` (acesso a repositório, sem importar o módulo de feature inteiro) — dá acesso
    de dados sem criar dependência de módulo circular.
  - Reativação **não** é afetada por nada disso — continua um update de linha única, sem cascata
    nos dois sentidos (reativar uma Unidade não reativa Galerias/Celas que foram desativadas por
    outro motivo).
- **Frontend**: `DeactivateAlert` (`frontend/src/features/settings/components/DeactivateAlert/`)
  agora extrai `error.response.data.message` de um `409` e mostra a mensagem real do backend no
  toast, em vez do "Tente novamente" genérico — que seria enganoso aqui (tentar de novo não
  resolve, é preciso mover/liberar o preso primeiro). Único lugar do app que faz esse tipo de
  extração hoje; todo o resto continua com mensagens de erro genéricas fixas, de propósito.
- **Verificado**: 6 testes de integração novos em `backend/test/integration/structure.spec.ts`
  (`describe('cascading deactivation')`) — bloqueia Cela/Galeria/Unidade com preso ativo,
  cascateia Galeria→Celas e Unidade→Galerias→Celas quando não há preso ativo. `tsc`/
  `eslint --max-warnings=0`/testes unitários+integração (13/13) no backend, `tsc`/
  `eslint --max-warnings=0`/`vite build` no frontend, todos verdes. Testado ao vivo via Playwright:
  tentar desativar a Cela 01 (Galeria A, com presos ativos) rejeita e mostra a mensagem específica
  no toast; a Cela continua "Ativo" na tabela.
- **Refatoração (2026-08-15, feedback do usuário)**: a query de contagem estava repetida (com
  pequenas variações de nível) em `UnitsService`/`GalleriesService`/`CellsService`. Extraída pra
  `backend/src/inmates/helpers/countActiveInmatesInScope.ts` (com `index.ts` barrel, pasta
  `helpers/`, convenção pedida pelo usuário), uma função **pura** (não `@Injectable`, não entra em
  nenhum `Module`) parametrizada por `ActiveInmateScope = { level: 'unit'|'gallery'|'cell' }`, com
  `switch (scope.level)` escolhendo o filtro certo. Não é um método de `InmatesService` de
  propósito: importar `InmatesModule` em `UnitsModule`/`GalleriesModule` recriaria o mesmo ciclo de
  módulos (`InmatesModule` já depende de `Cells → Galleries → Units`), e essa contagem não tem
  efeito colateral nem regra de negócio que justificasse `forwardRef()` só pra isso. Descoberta ao
  migrar: `Gallery`/`Cell`/`Inmate` no `TypeOrmModule.forFeature(...)` de `UnitsModule`/
  `GalleriesModule` (adicionados quando a cascata foi implementada) **não eram necessários** —
  nenhum dos dois services usa `@InjectRepository()` pra essas entidades, só o `manager` da
  transação via `@InjectDataSource()`, que já enxerga qualquer entidade do `DataSource` global
  independente de `forFeature` por módulo (isso só cria token de injeção pra `@InjectRepository`).
  Revertidos os dois módulos pro `forFeature` original (só a própria entidade) — confirmado via
  `tsc`, boot real do `AppModule` e os 13 testes de integração passando igual.
- **Bug encontrado e corrigido (2026-08-15, feedback do usuário)**: ao desativar Unidade/Galeria em
  `/configuracoes`, a cascata acontecia certo no backend, mas a tela só refletia as Galerias/Celas
  afetadas depois de um F5 — `DeactivateAlert.onSuccess` só invalidava a query da própria linha
  clicada (`['units']`, ou `['galleries', unitId]`), nunca as dos descendentes que o backend também
  mudou. Fix: ao desativar `unit`, invalida `['units']` + `['galleries']` + `['cells']` (sem
  `unitId`/`galleryId`, casando com qualquer query já em cache — React Query invalida por prefixo);
  ao desativar `gallery`, invalida `['galleries', unitId]` + `['cells']`. Efeito colateral bom, de
  graça: como `/mapa-da-unidade` usa a mesma forma de chave (`['cells', galleryId]`), ele também
  atualiza sozinho se estiver montado. Verificado ao vivo: criada uma galeria + cela de teste,
  desativada a galeria, cela apareceu "Inativo" na aba Celas sem reload (só trocando de aba).
- **Invariante pai-ativo (2026-08-15, feedback do usuário)**: até aqui, reativar uma Galeria/Cela
  não checava se o pai (Unidade/Galeria) estava ativo — dava pra ter uma Galeria `active: true` sob
  uma Unidade `active: false` (ou uma Cela ativa sob Galeria/Unidade inativa), estado que a cascata
  de desativação nunca produz sozinha, mas que a reativação isolada de um nível abria brecha pra
  criar. Fix, backend primeiro (fonte da verdade):
  - `GalleriesService.update`: ao reativar (`dto.active === true && !gallery.active`), rejeita com
    `409` se `gallery.unit.active` for `false` — `unit` já vem carregado por `findEntityInScope`,
    sem query extra.
  - `CellsService.update`: mesma ideia, checando `cell.gallery.active` e (se a galeria estiver ok)
    `cell.gallery.unit.active` — ambos já carregados via `findEntityInScope` (`relations: { gallery:
    { unit: true } }`). Checa o ancestral mais próximo primeiro, pra mensagem apontar pro nível
    certo.
  - `UnitsService` não precisou de nada — Unidade é a raiz, não tem pai pra checar.
  - 5 testes de integração novos (`describe('parent-active invariant')`): bloqueia reativar Galeria
    com Unidade inativa; permite depois que a Unidade volta a ativa; bloqueia reativar Cela com
    Galeria inativa; permite depois que Galeria+Unidade estão ativas; e um caso defensivo (Galeria
    forçada `active` via SQL direto enquanto a Unidade segue inativa) provando que o segundo `if`
    (checagem da Unidade) do `CellsService` funciona mesmo se a Galeria "parecer" OK.
  - **Achado no processo**: os testes nesses 2 arquivos passaram a fazer `tokenScopedToUnit` demais
    (cada teste que precisa de uma Unidade nova faz um WARDEN se auto-associar a ela e relogar — ver
    bloco acima "**Correções**") — e `POST /auth/login` é limitado a 5 requisições/60s
    (`@Throttle`, contracts/auth.md). Com `beforeAll` (2 logins) + os testes de cascata (mais 2) +
    os novos de invariante (mais 4), estourava o limite: `/auth/login` passava a responder `429`,
    `accessToken` ficava `undefined`, e todo request seguinte com aquele token quebrado voltava
    `401` — sintoma visto nos 3 primeiros testes que rodei (`Expected: 200, Received: 401`). Fix
    definitivo: `tokenScopedToUnit` (usado pelas duas suítes) trocou `POST /auth/login` via HTTP por
    chamar `TokenService.issueTokenPair(user)` direto (via `app.get(TokenService)`), contornando o
    `ThrottlerGuard` de vez — o guard só intercepta a rota HTTP, não o método do service. Bônus:
    suíte ficou mais rápida (não paga mais o custo do hash Argon2 do login a cada chamada).
  - **Frontend**: `RowActionButton` (`/configuracoes/index.tsx`) passou a envolver o `Button` num
    `<span>` dentro do `TooltipTrigger` — necessário pra tooltip continuar funcionando no hover
    mesmo com o botão `disabled` (botão nativo desabilitado não dispara os eventos de ponteiro que o
    hover do Radix depende; mesmo truque já usado no botão "Cadastrar preso" de `GalleryCards`,
    tasks.md). Nas abas Galerias/Celas, quando a entidade está inativa mas o pai também está
    inativo, troca `ReactivateAlert` por um `RowActionButton` `disabled` com o texto explicando o
    que fazer: "Reative a unidade primeiro" (Galeria) / "Reative a galeria primeiro" (Cela) — direto
    e acionável, sem jargão. `ReactivateAlert.onError` ganhou a mesma extração de mensagem real do
    backend que `DeactivateAlert` já tinha, como defesa em profundidade (o botão desabilitado evita
    chegar nesse erro na maioria dos casos, mas o backend valida de novo mesmo assim).
  - **Dados legados descobertos ao testar**: "Galeria B" (sob "Unidade Sul", inativa) está `active:
    true`, e a Cela "2" (Galeria A, inativa) estava `active: true` até eu desativá-la ao vivo pra
    testar o bloqueio — resquícios de testes anteriores a essa validação existir. Não fiz limpeza
    automática desses dados (decisão do usuário, não minha), só documentando que "Galeria B"
    continua nesse estado inconsistente até alguém desativar ou o usuário decidir o que fazer.

## 24. US2 — status "fora da cela" como projeção derivada em leitura, não coluna transacional

- **Decision** (Fase 4, T038–T042): ao registrar/retornar uma movimentação temporária,
  `inmates.status` **não é alterado**. `inmates.status` continua reservado às transições
  transacionais de #9 (situações definitivas — `RELEASED`/`ANKLE_MONITOR`/`TRANSFERRED`, US3, ainda
  não implementadas). "Fora da cela"/"na cela" (FR-011) é servido por um par derivado no
  `InmateResponseDto` — `inMovement: boolean` + `currentMovement: { movementId, movementTypeName,
  exitDateTime } | null` — calculado a cada leitura via `JOIN` contra `movements` filtrando
  `return_datetime IS NULL` e `movementType.category = TEMPORARY`
  (`InmatesService.openMovementByInmateId`).
- **Rationale**: essa leitura derivada já existia (como `inMovement: boolean` simples) desde o
  scaffolding da US1 — este trabalho só estendeu o mesmo padrão para carregar o tipo/horário do
  movimento aberto, sem introduzir uma segunda fonte de verdade. Escrever um novo valor de status
  para "fora da cela" duplicaria a informação que `movements` já guarda (uma linha aberta É "fora
  da cela") e criaria uma segunda escrita para manter sincronizada com create/return — exatamente o
  risco de divergência que #9 rejeitou para o caso das situações definitivas. A ressalva de
  performance de #9 (JOIN não escalaria) foi avaliada e aceita como ok neste caso porque a listagem
  já é sempre escopada por unidade/galeria/cela (nunca uma varredura de toda a tabela) e o filtro é
  sobre um índice natural (`inmate_id`, `return_datetime IS NULL`).
- **Idempotência do retorno — coluna própria**: `PATCH /movements/:id/return` aceita
  `Idempotency-Key` como o `POST`, mas não pode reusar a coluna `movements.idempotency_key` — essa
  já foi consumida para identificar a linha na criação. Uma segunda coluna,
  `return_idempotency_key` (nullable, índice único parcial, migration
  `1786896816132-AddMovementReturnIdempotencyKey`), guarda a chave do retorno; um replay com a
  mesma chave numa movimentação já retornada responde `200` em vez do `409` que o contrato exige
  para um segundo retorno genuíno (FR-009 edge case) — mesma semântica de idempotência do `POST`,
  aplicada de forma consistente à outra ponta do fluxo.

## 25. Fila offline do mobile estendida para cobrir retorno, não só saída (T043/T045)

- **Decision**: o scaffolding original da fila offline (T025) só cobria a saída de uma
  movimentação temporária (`pending_movements`, uma linha por saída). Para registrar o retorno
  (FR-009) também offline, foi adicionada uma segunda tabela `pending_returns` (mesmo formato —
  `idempotency_key` própria, nunca reaproveitando a da saída) em vez de tentar encaixar o retorno
  na tabela existente.
- **Rationale**: a saída e o retorno de uma movimentação já são duas requisições HTTP distintas no
  backend (`POST /movements` vs `PATCH /movements/:id/return`, cada uma com sua própria coluna de
  idempotência — ver #24) — espelhar essa mesma separação client-side evita ter que decidir, numa
  única tabela, o que uma linha "significa" dependendo de quais colunas estão preenchidas.
  `sync-service.ts` sincroniza todas as saídas pendentes antes de tentar qualquer retorno pendente,
  preservando a ordem em que normalmente aconteceriam de qualquer forma.
- **Escopo aceito, não implementado**: um retorno só pode ser enfileirado offline contra um
  `movementId` **real** (vindo de um `GET /inmates` já sincronizado anteriormente) — não existe
  caminho na UI para registrar saída e retorno do mesmo preso inteiramente offline na mesma sessão
  (a tela de presos em si já exige rede para saber quem está `inMovement`). Resolver isso exigiria
  o retorno referenciar tanto um id de servidor quanto o id local de uma saída ainda não
  sincronizada — decisão explicitamente adiada por não ter um caminho de UI que a exercite hoje.

## 26. Movimentação vs. Rotina — pátio/corre/faxina são Rotina, nunca Movimentação (correção)

- **Decision** (2026-08-16, correção pós-implementação da Fase 4, feedback do usuário): `pátio`,
  `corre` e `faxina` foram **removidos** da lista de `MovementType` (`seed.ts`,
  `data-model.md`, `spec.md`) e do texto de exemplo de US2. Eles pertencem exclusivamente a
  Rotina (US4) — nunca geram um registro de `Movement` por preso.
- **Rationale**: `Movement` sempre referencia um `inmate` específico (`inmate` é obrigatório na
  entidade) — é, por definição, um registro individual, de UM preso, com seu próprio
  `exitDateTime`/`returnDateTime`. Pátio/corre/faxina são liberações **coletivas**: a galeria
  inteira é liberada para o pátio (ou corre, ou faxina) num horário fixo, todo dia, em toda
  unidade do estado. Modelá-los como `MovementType` exigiria criar um `Movement` por preso, por
  galeria, por unidade, 1–2× por dia — volume de escrita absurdo para informação que já é
  inteiramente capturada por uma única `Routine` com escopo de galeria/unidade e horário(s) via
  `RoutineSchedule` (nenhuma referência a preso). Corre e faxina, especificamente, nem chegam a
  mudar a localização do preso (ele não sai fisicamente da galeria) — não haveria nem o que
  registrar como "deslocamento" no sentido do glossário (`spec.md`: Movimentação = "registro de
  **deslocamento**... de um preso").
- **O que continua sendo Movimentação (individual)**: atendimento médico interno/externo, visita
  (o ato de levar **este** preso específico até a visita dele, distinto do dia/horário de visita
  em si, que é Rotina — `Routine.type = VISIT_DAY`, já existente no modelo), e as situações
  definitivas (liberdade, tornozeleira, transferência, troca de cela — US3).
- **Regra prática pra decidir "é Movimentação ou Rotina?"**: se a atividade libera a galeria
  inteira de uma vez, num horário programado, é Rotina. Se é sobre um preso específico saindo
  (por um motivo que não se aplica aos outros presos da galeria ao mesmo tempo), é Movimentação.
- **Impacto**: `seed.ts`/`setup-test-db.ts` corrigidos (pátio removido dos `MovementType`
  seedados); `spec.md` (US2, glossário Movimentação/Tipo de Movimentação/Rotina) e
  `data-model.md` (`MovementType.name`) atualizados com a distinção explícita, pra não haver
  confusão no futuro. US4 (Rotinas, Fase 6, ainda não implementada) é onde pátio/corre/faxina
  efetivamente serão modelados — `tasks.md`'s Independent Test de US4 já usava "Pátio" como
  exemplo de Rotina antes mesmo desta correção, então a Fase 6 já estava alinhada com o conceito
  certo.
- **Decisão relacionada, mesma conversa**: `Movement.destinationLocation` deixou de ser opcional
  — agora é **obrigatório** em `POST /movements` (rastreabilidade de para onde o preso foi é o
  propósito central da Movimentação; deixá-lo opcional permitia registrar uma saída sem destino
  algum, o que não faz sentido operacionalmente). `reason`/`notes` continuam opcionais por ora
  (pode ser revisto). Migration `AddMovementReturnIdempotencyKey`'s follow-up
  (`RequireMovementDestinationLocation`) altera a coluna pra `NOT NULL` — sem necessidade de
  backfill, único dado existente no ambiente de dev já tinha o campo preenchido.

## 27. Convenção de pastas — folder-per-component (`index.tsx`) estendida ao `mobile/`, e tema escuro/dourado (#16) aplicado

- **Decision** (2026-08-17): a convenção #17 (toda tela/componente vive em pasta própria nomeada
  pelo conceito, `index.tsx` como ponto de entrada único, sem exceção por tamanho) passa a valer
  também para `mobile/`, não só `frontend/` — mesmo formato, mesma regra sem exceção. `screens/`
  segue como está (telas de rota, já nomeadas por conceito, ex.: `LoginScreen.tsx`); componentes
  compartilhados entre telas passam a nascer em `mobile/src/components/<Nome>/index.tsx` desde o
  primeiro momento (a pasta estava vazia — nenhum componente compartilhado existia ainda). Ao
  mesmo tempo, o tema escuro + preto/dourado que a #16 já definia para os **dois** clientes
  (`frontend/` e `mobile/`) foi efetivamente aplicado no mobile pela primeira vez — até aqui as
  telas usavam cores claras fixas (`#fff`/`#0f172a`), divergindo da decisão já registrada. Os
  tokens de cor vivem em `mobile/src/theme/colors.ts`, com os mesmos valores HSL do bloco `.dark`
  de `frontend/src/index.css` (fonte única de verdade compartilhada — mudar a cor num lugar exige
  mudar no outro conscientemente, não há mecanismo de sincronização automática entre CSS custom
  properties e um módulo RN).
- **Rationale**: manter uma única convenção de organização de componente nos dois clientes evita
  que um desenvolvedor precise lembrar "regra X no frontend, regra Y no mobile" sem motivo técnico
  — RN suporta pasta-por-componente tão bem quanto React web, então não há razão pra divergir
  (mesmo racional da #17: elimina julgamento caso a caso sobre quando criar pasta). Aplicar o tema
  da #16 corrige uma divergência entre spec e implementação (Constituição I — Domain First: a
  especificação já definida deveria ter sido seguida desde a primeira tela mobile).
- **Alternatives considered**: manter mobile com arquivo plano (`components/StatusBadge.tsx`) —
  rejeitado, reintroduz exatamente a inconsistência que a #17 eliminou no frontend, agora entre
  clientes em vez de entre componentes; converter os tokens de cor pra hex fixo no mobile em vez
  de reusar a string `hsl(...)` — rejeitado por ora, RN (0.71+) já aceita `hsl()`/`hsla()` como
  string de cor válida em `StyleSheet`, então copiar o valor HSL literal do CSS mantém os dois
  arquivos comparáveis lado a lado sem conversão manual sujeita a erro de arredondamento.

## 28. Biblioteca de UI do mobile — NativeWind + react-native-reusables (vendorizado manualmente, não via CLI)

- **Decision** (2026-08-17): adotado **NativeWind v4** (Tailwind pra React Native) como motor de
  estilo do `mobile/`, com os componentes de **react-native-reusables** (porte do shadcn/ui pra
  RN, construído sobre NativeWind) vendorizados manualmente em
  `mobile/src/components/ui/{button,input,text,card,label}.tsx` — mesma filosofia "copiar o
  código-fonte, não instalar como dependência de runtime" que `frontend/src/components/ui/` já
  usa pro shadcn/ui (mesma exceção à convenção #17/#27 de pasta-por-componente: `components/ui/`
  é arquivo plano nos dois clientes, por ser código vendorizado). **Não foi usado o CLI oficial**
  (`npx @react-native-reusables/cli@latest init`) — o registry oficial hoje mira Expo SDK 56/
  React 19.2/RN 0.85 (`react-native-reanimated@4.x`, que exige New Architecture), muito à frente
  do nosso Expo SDK 51/React 18.2/RN 0.74.5 (old architecture); rodar o `init` scaffoldaria um
  projeto novo nessa stack por cima do nosso app existente. Os pacotes reais por trás dos
  componentes que usamos (`class-variance-authority`, `clsx`, `tailwind-merge`,
  `@rn-primitives/slot`, `@rn-primitives/label`) declaram peer deps abertos (`react: "*"`) e
  `nativewind@4.2.6` só exige `react-native-reanimated >=3.6.2` — compatível com Expo SDK 51 sem
  precisar de New Architecture — então copiamos o código-fonte de cada componente (via GitHub,
  `packages/registry/src/nativewind/components/ui/*.tsx` do repo `founded-labs/
  react-native-reusables`) ajustando só os imports pro nosso alias `@/*` (`@/lib/utils` em vez de
  `@/registry/nativewind/lib/utils`) e removendo classes `dark:`/`web:` mortas onde não fazem
  sentido no nosso caso (tema único, sem toggle claro/escuro, research.md #16).
- **Setup**: `nativewind`, `tailwindcss@^3.4.17`, `react-native-reanimated` (via `expo install`,
  versão SDK 51), `class-variance-authority`, `clsx`, `tailwind-merge`, `@rn-primitives/slot`,
  `@rn-primitives/label`. `mobile/global.css` — os mesmos custom properties HSL de
  `frontend/src/index.css` (bloco `.dark`), agora como **fonte primária** dos tokens de cor
  (substitui `mobile/src/theme/colors.ts` da #27 pra tudo que é `style`/`className` de
  componente). `tailwind.config.js` mapeia `bg-background`/`text-foreground`/`bg-primary`/etc. pra
  `hsl(var(--nome))`, mesma convenção do `frontend/`. `babel.config.js` ganhou o preset
  `nativewind/babel` + `jsxImportSource: 'nativewind'`, e o plugin `react-native-reanimated/plugin`
  (precisa ser o último da lista). `metro.config.js` (não existia — Metro do Expo usava só o
  default implícito) agora existe explicitamente com `withNativeWind(getDefaultConfig(__dirname),
  { input: './global.css' })`. `mobile/src/theme/colors.ts` (#27) **não foi removido** — continua
  sendo a única fonte pros poucos casos de prop nativa que não aceita `className` (ex.:
  `ActivityIndicator`'s `color`, que é uma prop de cor direta, não um estilo).
- **Rationale**: o time já pensa em classes utilitárias Tailwind no `frontend/` (shadcn/ui) —
  NativeWind elimina o custo de trocar de modelo mental entre os dois códigos, e os nomes de
  classe (`bg-primary`, `text-muted-foreground`) são literalmente os mesmos dos dois lados.
  Vendorizar em vez de instalar como lib (mesmo racional do shadcn/ui no frontend, já implícito na
  Estrutura do `plan.md`) mantém o componente 100% editável sem esperar por uma versão upstream, e
  evita puxar a árvore de dependências pesada do template oficial (expo-router, clerk, reanimated
  v4) que a gente não usa (`mobile/` usa React Navigation, não expo-router — trocar de navegação
  não fazia parte do escopo pedido).
- **Alternatives considered**: `react-native-reusables` via CLI oficial — rejeitado pelo motivo
  acima (stack alvo incompatível, risco de quebrar o app existente); **React Native Paper** —
  rejeitado, o resultado visual é Material Design, colidiria com a identidade preto/dourado da
  #16 e exigiria sobrescrever a maior parte do tema por padrão; manter `StyleSheet.create` puro
  (sem lib) — rejeitado, decisão explícita do usuário do projeto (2026-08-17) de padronizar o
  mobile com o mesmo vocabulário de componente do `frontend/` antes de seguir com ajustes de
  layout, pra não reinventar `Button`/`Input`/`Card` tela a tela.
- **Pin de versão — `nativewind` travado em `4.1.23` exato (sem `^`)**: `nativewind@4.2.0+`
  (a partir de `react-native-css-interop@0.2.0`) passou a incluir incondicionalmente o plugin
  babel `react-native-worklets/plugin` — pacote que só existe junto do Reanimated v4/New
  Architecture — mesmo com Reanimated v3 instalado, quebrando o bundle com `Cannot find module
  'react-native-worklets/plugin'`. `react-native-css-interop@0.1.22` (última versão antes dessa
  mudança, usada por `nativewind@4.1.x`) referencia corretamente `react-native-reanimated/plugin`,
  compatível com o v3.10.1 que o `expo install` resolveu pro SDK 51. Por isso `package.json` fixa
  `"nativewind": "4.1.23"` sem `^` — um `npm install` normal NÃO deve subir sozinho pra `4.2.x`
  enquanto o projeto não migrar pra Expo SDK/Reanimated v4 com New Architecture habilitada.

## 29. Redesign de navegação/layout do mobile — telas de pilha reais, MVVM, unidade global, confirm sheet e toast próprio

- **Decision** (2026-08-17, a partir de 5 imagens de referência trazidas pelo usuário —
  fintech/ride-hailing, tema escuro+dourado): `InmatesLookup.tsx` (um único componente que
  simulava navegação trocando `unitId`/`galleryId`/`cellId` em estado local, sem pilha de
  navegação real — causa raiz do "não sei em qual tela estou nem pra onde volto") foi
  **removido** e dividido em telas de pilha reais do React Navigation:
  `HomeScreen` → `SelectUnitScreen` / `GalleriesScreen` → `CellsScreen` → `InmatesScreen` →
  `InmateDetailScreen` (situação, somente leitura) / `MovementRegister`, mais `ProfileScreen`.
  Cada uma ganha voltar de verdade (gesto/botão físico Android incluídos) de graça, em vez de um
  "voltar" que só reseta `useState`.
  - **MVVM**: toda tela agora é `<Screen>.tsx` (View — só JSX, zero `useQuery`/`useState` de
    negócio) + `<Screen>.viewmodel.ts` (hook `use<Screen>ViewModel` com toda a lógica/estado/
    navegação), colocados lado a lado em `src/screens/` — mesmo split que `contexts/
    AuthContext.tsx` + `contexts/auth-context.ts` já usavam, agora generalizado como o padrão de
    arquitetura do mobile inteiro.
  - **Unidade global**: `UnitContext`/`UnitProvider` (mesmo formato do `AuthContext`, persistido
    em AsyncStorage) guarda a unidade escolhida uma vez em `SelectUnitScreen`; o card
    "Movimentação" da Home pula direto pra `GalleriesScreen` se já houver unidade selecionada, só
    volta a perguntar se não houver.
  - **Header padrão**: `components/ScreenHeader/index.tsx` — botão circular dourado (ícone
    `ChevronLeft` via `lucide-react-native`, vendorizado como `components/ui/icon.tsx`) +
    título, usado em toda tela não-raiz (`navigation.canGoBack()` decide se renderiza o botão).
    O header nativo do `MovementRegister` (único que ainda o usava) saiu — `headerShown: false`
    em toda a `Stack.Navigator` agora, pra não ter dois padrões de navegação coexistindo.
  - **Confirmação como bottom sheet**: `components/ConfirmSheet/index.tsx` usa o `Modal` nativo
    do React Native (`transparent` + `animationType="slide"`, cantos superiores arredondados) —
    **não** `@rn-primitives/alert-dialog`/`@rn-primitives/portal` (que exigiriam montar
    `<PortalHost />` na raiz + `zustand` + animações do Reanimated só pra isso). Usado antes de
    registrar saída/retorno (`MovementRegister`) e antes de sair do app (`HomeScreen`).
  - **Toast próprio**: `lib/toast.ts` — store mínima (array + subscribers, sem lib externa)
    expondo `toast.success/error/warning/info(mensagem)`, renderizada por
    `components/Toaster/index.tsx` (montado uma vez em `App.tsx`). Substitui os dois
    `Alert.alert(...)` de sucesso que existiam em `MovementRegister` — mesmo espírito do
    `notify()` do `frontend/` (#19), sem `sonner` (não existe versão RN).
  - **Botão "Situação" é somente leitura**: `InmateDetailScreen` não ganha nenhuma ação de
    escrita — registrar situação definitiva (liberdade, tornozeleira, transferência, troca de
    cela) continua exclusivo da Chefia/Diretor no web (US3, RBAC), decisão confirmada com o
    usuário do projeto nesta sessão, não expandida por conta própria.
  - `Inmate.photoUrl` (mobile) — o backend já retornava esse campo em `GET /inmates` (mesmo
    `InmateResponseDto` da lista e do detalhe), só não estava tipado no lado mobile; `InmatesScreen`/
    `InmateDetailScreen` mostram a foto quando existe, e iniciais do nome (via `Avatar`/
    `AvatarFallback`, `@rn-primitives/avatar`) quando não.
- **Rationale**: o problema relatado ("ruim de navegar... não sei pra onde volto") é
  estrutural — estado local simulando navegação nunca vai se comportar como navegação de
  verdade (gesto de voltar do iOS, botão físico do Android, animação de transição, deep link
  futuro). Resolver só trocando o header manteria o bug de fundo. MVVM foi decisão explícita do
  usuário do projeto (2026-08-17) — força a tela a ficar "burra" (só apresentação), o que já é
  meio caminho andado pra qualquer teste de componente futuro (Constituição VIII).
- **Alternatives considered**: manter `InmatesLookup` como um componente só e apenas trocar o
  header visual — rejeitado, não resolve a causa raiz (ausência de pilha de navegação real);
  `@rn-primitives/alert-dialog` pro confirm sheet — rejeitado por complexidade desproporcional ao
  problema (ver acima), risco de repetir o tipo de incompatibilidade de versão já visto com
  NativeWind 4.2/Reanimated 4 (#28); expandir o botão "Situação" pra permitir registrar situação
  definitiva pelo mobile — rejeitado por ora, exigiria alterar `spec.md`/RBAC (US3), não pedido

## 30. Tela de Login (mobile) — polimento visual iterativo com o usuário do projeto

- **Decision** (2026-08-21): `LoginScreen` recebeu uma rodada de ajustes visuais validados um a
  um no emulador (screenshots reais via `adb shell screencap`), não um redesign de uma vez só:
  - `components/ui/input.tsx` ganhou estado de foco controlado (`onFocus`/`onBlur` +
    `useState`) — borda vira `border-primary` (dourada) ao focar, `border-destructive` (vermelha)
    quando `error` está setado (erro tem prioridade sobre foco, igual ao CSS do `Input` web:
    `aria-invalid:border-destructive` some depois de `focus-visible:border-ring` na cascata, logo
    vence em empate). `cursorColor` é `colors.foreground` (branco) — testado com dourado primeiro,
    trocado a pedido do usuário. Fundo do input é `bg-black` (preto puro), não `bg-background`
    (que no tema escuro já é quase preto, `hsl(240,10%,4%)`) — a diferença sutil entre os dois tons
    é o que dá contraste/destaque ao campo sobre o fundo da tela, efeito equivalente ao do
    `frontend/` onde o input (`bg-background`) contrasta com o `Card` (`bg-card`) ao redor.
  - Validação por campo (e-mail obrigatório/formato inválido via regex simples, senha
    obrigatória) replicada do `LoginPage` web (que usa `zod` + `react-hook-form`) **sem** adicionar
    essas duas libs ao mobile — validação manual no `LoginScreen.viewmodel.ts`, chamada só no
    submit; erro por campo limpa sozinho no próximo keystroke daquele campo.
  - `components/ui/alert.tsx` — novo componente vendorizado, mesma paleta "Custom Colors" do
    `frontend/src/components/ui/alert.tsx` (cores cruas do Tailwind — `red-950`/`green-950`/
    `amber-700`/`blue-700` — não os tokens semânticos do tema) para ficar visualmente idêntico.
    Usado para o alerta de "Credenciais inválidas": **testado no topo da tela e na parte inferior**
    a pedido do usuário — no topo colidia com a área da status bar/notificações; mantido embaixo,
    centralizado, com dismiss automático (4s) e posicionado com `useSafeAreaInsets()` (mesmo padrão
    do `ConfirmSheet`, #29).
  - Dimensionamento ajustado em rodadas sucessivas e proporcionalmente entre si: `Input`
    (`h-14`/`sm:h-12`) e `Button` variant `lg` (`h-14`/`sm:h-12`) — ambos vendorizados, únicos
    usos de `size="lg"` no app hoje, então a alteração da variante não afeta outras telas; logo
    (144px → 176px) e subtítulo (`text-lg` → `text-xl`) aumentados depois, para acompanhar
    visualmente o aumento dos campos/botão; `Label` ganhou `font-bold`/`text-base` (só nas duas
    instâncias do `LoginScreen`, sem alterar o vendorizado `components/ui/label.tsx`, que
    continua `font-medium` por padrão pra qualquer uso futuro fora do login).
  - Ativo Polícia Penal RS: `mobile/assets/logo-pp-rs.png` (cópia de
    `frontend/src/assets/logo-pp-rs.png`) — primeiro asset de imagem estático do mobile.
- **Rationale**: o usuário validou cada ajuste com screenshot antes de aprovar o próximo, incluindo
  um teste A/B explícito (posição do alerta) que só faz sentido registrado com o resultado da
  comparação, não só a decisão final — outra pessoa mexendo nisso depois pode ficar tentada a
  "corrigir" o alerta pra cima achando mais consistente com o resto do app, sem saber que já foi
  testado e descartado.
- **Alternatives considered**: alerta de credenciais no topo da tela — testado, rejeitado (colide
  com status bar); cursor dourado (igual à borda) — testado, trocado pra branco a pedido do
  usuário; `zod`/`react-hook-form` no mobile pra replicar a validação do web 1:1 — rejeitado,
  validação manual resolve o mesmo caso de uso sem duas dependências novas.

## 31. `screens/` vs `features/<domínio>/screens/` — critério de organização de telas no mobile

- **Decision** (2026-08-21): o mobile tinha 9 telas MVVM todas soltas em `src/screens/`
  (`LoginScreen`, `HomeScreen`, `ProfileScreen`, `SelectUnitScreen`, `GalleriesScreen`,
  `CellsScreen`, `InmatesScreen`, `InmateDetailScreen`, `MovementRegister`), misturando telas
  genéricas com telas que já dependiam de um domínio de negócio (`structureApi`/`movementsApi`).
  Reorganizado seguindo o critério real que o `frontend/` já usa (não "tela vs não-tela" — lá
  `pages/*` e `features/<domínio>/index.tsx` são registrados exatamente do mesmo jeito no router;
  a diferença é só onde o arquivo mora): **se a tela pertence a um domínio com `api.ts`/`types.ts`
  próprios, a tela mora dentro de `features/<domínio>/`, do lado desse código; senão, mora em
  `screens/`.**
  - `screens/LoginScreen/`, `screens/HomeScreen/`, `screens/ProfileScreen/` — sem domínio de
    negócio próprio (auth genérico, hub de cards, dados do `AuthContext`).
  - `features/structure/screens/{SelectUnitScreen,GalleriesScreen,CellsScreen,InmatesScreen,
    InmateDetailScreen}/` — todas consomem `structureApi`/tipos de `features/structure/types.ts`.
  - `features/movements/screens/MovementRegister/` — consome `movementsApi` + fila offline.
  - Diferença em relação ao `frontend/`: lá cada feature tem **uma** tela (`index.tsx`) porque a
    navegação interna é filtro em uma página só; no mobile cada domínio tem **várias** telas em
    sequência de pilha (Galerias → Celas → Presos → Situação), por isso existe o nível extra
    `features/<domínio>/screens/<Tela>/` em vez de `features/<domínio>/index.tsx` direto.
  - Toda tela, nos dois locais, agora é pasta-própria + `index.tsx` (a view) + `viewmodel.ts`
    (colocado do lado, sem repetir o nome da tela no arquivo — o nome já vem da pasta), igual ao
    padrão `pages/<Nome>/index.tsx` do `frontend/`. Único import externo por tela
    (`RootNavigator.tsx`) atualizado para os novos caminhos; nenhuma outra tela importava outra
    diretamente.
- **Rationale**: pedido explícito do usuário do projeto após revisar o resultado do redesign
  (#29) — "pasta SCREENS está uma bagunça". Migrar telas de domínio pra dentro do `features/` que
  já existia (só com `api.ts`/`types.ts` até então) fecha o paralelo com o `frontend/`, que já era
  a referência declarada de estrutura desde #17/#27.
- **Alternatives considered**: manter tudo em `screens/` e só adicionar pastas — rejeitado, não
  resolve a pergunta de fundo ("quando uso `screens/` vs `features/`"), só esconde a bagunça uma
  pasta mais fundo; espelhar o frontend literalmente (uma tela só por feature) — não se aplica,
  o mobile navega por pilha real (#29), não por filtro em página única.

## 32. O "M" do MVVM (mobile) — `model.ts` como terceira peça, ao lado de `api.ts`/`types.ts`

- **Decision** (2026-08-22): até aqui o MVVM do mobile (#29) só nomeava View + ViewModel — o
  "Model" existia de fato (`features/<domínio>/{types.ts,api.ts}`, `offline/*`), mas nenhuma regra
  de domínio (derivação pura sobre uma entidade) tinha um lugar formal: elas viviam soltas dentro
  do `.viewmodel.ts` de quem precisava delas primeiro, sem reuso.
  - Extraído pra `features/structure/model.ts`: `findUnitById`, `filterUnitsByIds`
    (deduplicando o mesmo `.filter((u) => user?.units.includes(u.id))` que existia repetido em
    `HomeScreen`/`SelectUnitScreen`/`ProfileScreen`), `inmateStatusLine`, `inmateMovementActionLabel`
    (antes funções locais dentro de `InmatesScreen.viewmodel.ts`).
  - Extraído pra `features/movements/model.ts`: `filterTemporaryMovementTypes`,
    `canSubmitExitMovement` (antes inline em `MovementRegister.viewmodel.ts`).
  - Telas sem domínio compartilhado (#31) ganham `model.ts` **colocado na própria pasta da tela**
    em vez de em `features/`, quando têm alguma regra local: `screens/LoginScreen/model.ts`
    (`validateEmail`/`validatePassword`, antes inline no viewmodel) e `screens/ProfileScreen/
    model.ts` (`roleLabel`/`ROLE_LABEL`, mapeamento de `RoleName` — não é um domínio "estrutura",
    e não existe `features/auth/` hoje).
  - `initials(name)` — estava duplicada, idêntica, em três Views (`ProfileScreen`,
    `InmatesScreen`, `InmateDetailScreen`). Não é regra de um domínio específico (aplica a
    qualquer nome de pessoa, preso ou usuário), então **não** foi pro `model.ts` de nenhuma
    feature — virou `lib/initials.ts`, ao lado de `lib/utils.ts`/`lib/toast.ts`.
  - Toda função de `model.ts`/`lib/` é **pura**: recebe dado, devolve dado, zero `useState`/
    `useEffect`/`fetch`/`navigation` — testável com `expect(fn(input)).toBe(output)`, sem mock de
    React nem de rede.
  - **Regra pra telas novas daqui pra frente**: assim que o `.viewmodel.ts` de uma tela tiver
    qualquer derivação pura sobre uma entidade (formatar, filtrar, validar, decidir um rótulo) —
    por menor que seja — essa função nasce direto em `model.ts` (da feature, se a entidade for
    compartilhada; da própria pasta da tela, se for local), nunca inline no ViewModel.
    `model.ts` **não é arquivo obrigatório por tela** — só existe quando há pelo menos uma dessas
    funções; um `model.ts` vazio "reservando o padrão" não se cria (Constituição/CLAUDE.md: sem
    código morto/especulativo). Na prática isso quase sempre acontece rápido — a maioria das telas
    formata ou deriva algo do dado que busca.
- **Rationale**: pedido explícito do usuário do projeto, depois de perguntar onde ficava o "M" do
  MVVM e concordar com a sugestão de funções puras em vez de classe (evita atrito com
  comparação rasa do React/serialização do AsyncStorage/React Query, e não introduz um padrão
  novo que mais ninguém no projeto usa). Ter a regra de negócio num lugar sem React nem HTTP
  facilita teste unitário isolado (Constituição VIII) e elimina duplicação real que já existia
  (o filtro de unidades por `user.units` estava copiado em 3 lugares).
- **Alternatives considered**: Model como classe (`class InmateModel`) — rejeitado, atrito com
  re-render/serialização e inconsistente com o resto do projeto (frontend e mobile só usam
  objetos/interfaces planos); `model.ts` obrigatório em toda tela mesmo sem lógica pra extrair
  (pedido inicial do usuário, "mesmo que não tenha ainda regra de negócio") — implementado como
  "cria quando aparece a primeira função pura", não como arquivo vazio de antemão, por conflitar
  com a regra do projeto de não escrever código especulativo/morto; confirmado pelo usuário nesta
  rodada. **Correção da posição do Model em si**: ver #33 — o `canSubmitExitMovement` chegou em
  `features/movements/model.ts` pelo motivo errado nesta entrada (achei, por um momento, que devia
  ir pra um `model.ts` local à tela por não "descrever a entidade"); a regra final da #33 mantém
  ele onde já estava, só que por um critério diferente e mais simples.

## 33. Regra definitiva de onde mora o Model — e por que `screens/` (raiz) virou `pages/`

- **Decision** (2026-08-22): depois de discutir caso a caso onde cada função pura da #32 devia
  morar (é sobre a entidade ou sobre o formulário da tela?), o usuário do projeto apontou —
  corretamente — que uma regra que exige julgamento a cada nova função vai gerar inconsistência
  com o tempo. Regra fechada, sem exceção de julgamento:
  - **O Model mora sempre na raiz do menor domínio que o possui.** Pra uma feature com várias
    telas (`features/structure/`, `features/movements/`), isso é a raiz da feature —
    `features/<domínio>/model.ts`, um só por domínio, do lado de `api.ts`/`types.ts`. Não existe
    Model dentro de `features/<domínio>/screens/<Tela>/` nunca — mesmo uma função hoje usada por
    uma tela só (`inmateStatusLine`, usada só pela `InmatesScreen`) fica na raiz da feature,
    porque o domínio ali é `structure`, não "a tela que perguntou primeiro".
  - Pra uma tela **sem** domínio compartilhado com nenhuma outra (Login, Home, Profile) — ela É o
    próprio domínio (não existe uma feature maior pra hospedar o Model dela). Nesse caso o Model
    mora dentro da própria pasta da tela (`pages/LoginScreen/model.ts`), e isso **não é uma
    exceção** à regra acima — é a mesma regra aplicada a um domínio de tamanho 1.
  - `canSubmitExitMovement` (#32) permanece em `features/movements/model.ts` — não porque
    "descreve a entidade `MovementType`" (não descreve; recebe campos soltos de formulário), mas
    porque o domínio de quem a possui é `movements`, ponto final. O critério deixou de ser
    "isso é uma propriedade da entidade?" (subjetivo) e passou a ser só "de qual domínio é isso?"
    (objetivo).
  - **Renomeado `mobile/src/screens/` (raiz) → `mobile/src/pages/`** — mesmo conteúdo
    (`LoginScreen/`, `HomeScreen/`, `ProfileScreen/`, cada uma com `index.tsx` + `viewmodel.ts` +
    `model.ts` quando existir), só a pasta-contêiner mudou de nome. Motivo: o nome `screens/`
    reaparecia dentro de `features/<domínio>/screens/` com um significado diferente (várias telas,
    um domínio compartilhado) do significado da pasta raiz (uma tela = um domínio isolado) — a
    mesma palavra pra dois conceitos diferentes foi o que gerou a dúvida de "por que o Model não
    fica sempre no mesmo nível". `pages/` é o nome que o `frontend/` já usa pra exatamente esse
    conceito (`frontend/src/pages/LoginPage/`, research.md #31) — reaproveitado em vez de inventar
    um termo novo. Os componentes continuam com o sufixo `Screen` (`LoginScreen`, não `LoginPage`)
    porque isso já é o vocabulário de React Navigation usado em `navigation/types.ts`/
    `RootNavigator.tsx` — só o nome da pasta-contêiner mudou, não o nome do componente.
    `RootNavigator.tsx` é o único import externo às telas, atualizado pros novos caminhos
    (`@/pages/LoginScreen` etc.).
  - Árvore final:
    ```
    mobile/src/pages/
      LoginScreen/{index.tsx, viewmodel.ts, model.ts}
      HomeScreen/{index.tsx, viewmodel.ts}
      ProfileScreen/{index.tsx, viewmodel.ts, model.ts}
    mobile/src/features/
      structure/{api.ts, types.ts, model.ts, screens/{SelectUnitScreen,GalleriesScreen,CellsScreen,InmatesScreen,InmateDetailScreen}/{index.tsx, viewmodel.ts}}
      movements/{api.ts, types.ts, model.ts, screens/MovementRegister/{index.tsx, viewmodel.ts}}
    ```
- **Rationale**: uma regra objetiva ("de qual domínio é isso?") é sempre melhor que uma regra que
  depende de interpretar se algo "é uma propriedade da entidade" — a segunda já gerou duas idas e
  voltas nesta mesma sessão (mover `canSubmitExitMovement` pra um lugar, depois perceber que
  bastava simplificar a pergunta). Reaproveitar `pages/` do `frontend/` em vez de inventar um nome
  novo mantém os dois clientes fáceis de explicar com o mesmo vocabulário.
- **Alternatives considered**: `features/auth/model.ts` só pra tirar `validateEmail`/
  `validatePassword`/`roleLabel` de dentro de `pages/` — rejeitado pelo usuário do projeto: forçaria
  um domínio compartilhado que não existe de fato (Login e Profile não têm nenhuma lógica em
  comum entre si), só pra "não deixar Model dentro de tela" — a causa raiz era o nome da pasta
  colidir, não a posição em si; renomear a pasta resolve sem inventar domínio artificial. Manter
  `screens/` como nome da pasta raiz e renomear a pasta aninhada da feature pra outra coisa (ex.:
  `features/<domínio>/views/`) — rejeitado, `screens/` dentro da feature já é o nome mais claro
  pra quem chega vindo de `RootNavigator`/React Navigation; era a pasta raiz que precisava de um
  nome diferente por representar um conceito diferente.

## 34. Sub-componente privado de uma tela — sempre em `<Tela>/components/<Nome>/index.tsx`

- **Decision** (2026-08-22): telas MVVM do mobile vinham acumulando componentes auxiliares
  declarados como função solta dentro do próprio `index.tsx` da tela (`OptionCard` em
  `HomeScreen`, `InmateRow` em `InmatesScreen`, `DetailRow` em `InmateDetailScreen`, `FieldLabel`
  e `ReadOnlyValue` em `MovementRegister`) — quebra da convenção de pasta-por-componente (#17/#27)
  que já valia pra tudo em `components/`. Critério fechado, o mesmo raciocínio de domínio da #33
  aplicado um nível abaixo, na escala de componente:
  - Um componente usado **só por uma tela** mora em `<pasta-da-tela>/components/<Nome>/index.tsx`
    — dentro de `pages/<Tela>/` ou `features/<domínio>/screens/<Tela>/`, conforme onde a tela já
    estiver (#31/#33). Continua sem `viewmodel.ts`/`model.ts` próprios — são componentes de
    apresentação pura, recebem tudo via props da tela que os usa.
  - Um componente usado **por mais de uma tela** (de features diferentes, ou de uma feature e de
    uma página genérica) sobe pra `src/components/<Nome>/index.tsx` (raiz), ao lado de
    `ScreenHeader`/`ConfirmSheet`/`Toaster` — mesmo critério de "raiz do menor domínio que o
    possui" da #33, só que aplicado a componente em vez de a Model.
  - Renomeações feitas: `pages/HomeScreen/components/OptionCard/`,
    `features/structure/screens/InmatesScreen/components/InmateRow/`,
    `features/structure/screens/InmateDetailScreen/components/DetailRow/`,
    `features/movements/screens/MovementRegister/components/{FieldLabel,ReadOnlyValue}/`. Cada
    `index.tsx` da tela ficou só com JSX de alto nível + import desses componentes — nenhuma
    função de componente declarada fora do `export default` da tela.
- **Rationale**: pedido explícito do usuário do projeto ("na Home temos um componente OptionCard
  dentro do index... isso deve sempre ser feito nos demais componentes") — critério objetivo pra
  aplicar em toda tela nova a partir de agora, sem precisar perguntar de novo: **qualquer função de
  componente (não helper de formatação — essas são Model, #32/#33) que aparecer solta dentro de um
  `index.tsx` de tela deve nascer direto em `components/<Nome>/index.tsx`, nunca inline.**
- **Alternatives considered**: manter componentes pequenos inline "porque são simples" — rejeitado
  por precedente (mesma linha de raciocínio de #17: sem exceção por tamanho); esperar até um
  componente ser reaproveitado por 2+ telas antes de extrair pra arquivo próprio — rejeitado,
  cria o mesmo tipo de inconsistência que #33 já resolveu pra Model (alguns componentes soltos,
  outros em pasta, sem regra objetiva de quando).

## 35. Redesenho de "situações definitivas" pós-implementação de US3 (campos genéricos + troca/permuta de cela e galeria)

- **Contexto** (2026-08-31, revisão pós-implementação de T046–T053 com o usuário do projeto):
  logo após a primeira implementação completa de US3 (liberdade/tornozeleira/transferência/troca
  de cela, todas WARDEN-only), o usuário identificou dois problemas na modelagem entregue: (1) o
  campo `reason` estava sendo usado como "gaveta" de texto livre pra guardar dado estruturado
  (número de alvará, agente responsável, dispositivo, empresa, escolta) de forma diferente por
  tipo — inviabiliza pesquisa/relatório futuro por esse dado; (2) "troca de cela" não é um
  conceito único — na prática existem quatro variações operacionais distintas, com regras e
  perfis de acesso diferentes, nenhuma delas mapeada no desenho original.
- **Decision — campos genéricos (FR-008a)**: `reason` (motivo) e `notes` (observação) passam a
  ser os **únicos** dois campos de texto livre em **qualquer** tipo de Movimentação, sem exceção —
  `reason` sempre obrigatório, `notes` sempre opcional. Nenhum tipo ganha campo estruturado
  próprio (nem para liberdade, nem para transferência); dado específico de um tipo (alvará,
  agente, dispositivo, escolta, unidade de destino) é texto livre dentro de `reason`/`notes`. Essa
  simplificação foi uma escolha explícita do usuário do projeto — a alternativa (colunas
  dedicadas por tipo, ou uma tabela de detalhe por tipo) foi considerada e descartada por ele
  por complexidade desnecessária nesta fase; pode ser revisitada no futuro se a necessidade de
  pesquisa estruturada por esse dado se tornar real.
- **Decision — `destinationLocation` sai de liberdade/tornozeleira/transferência**: essas três
  passam a ter exatamente a mesma forma (`reason`, `notes`), diferindo só no status que atribuem
  ao preso. `destinationLocation` continua existindo só na movimentação temporária (FR-008, onde
  já era obrigatória — research.md #26).
- **Decision — troca de cela vira quatro variações (FR-015–FR-015c)**: o usuário identificou que
  "troca de cela definitiva" cobria na prática quatro operações diferentes, cruzando dois eixos —
  escopo (mesma galeria vs. galeria diferente) × modo (movimentação simples vs. permuta
  simultânea entre dois presos):
  - **Troca de cela** (FR-015): 1 preso, mesma galeria, exige vaga na cela de destino.
  - **Permuta de cela** (FR-015a): 2 presos, mesma galeria, troca simultânea, nunca exige vaga.
  - **Troca de galeria** (FR-015b): 1 preso, galeria diferente, exige vaga.
  - **Permuta de galeria** (FR-015c): 2 presos, galeria diferente, troca simultânea, nunca exige
    vaga.
  Todas as quatro mantêm `inmates.status = ACTIVE` — diferente de liberdade/tornozeleira/
  transferência, que são de fato terminais. Por isso saem do namespace `POST /movements/final/*`
  (contracts/movements.md) — não são situação "final" de custódia.
- **Decision — RBAC por perfil, não por cliente**: troca/permuta de cela (mesma galeria) ficam
  disponíveis a **qualquer** perfil autenticado (`PRISON_OFFICER`/`SUPERVISOR`/`WARDEN`), tanto no
  app mobile quanto no painel web — inclusive porque não existe hoje nenhuma barreira técnica que
  impeça um `PRISON_OFFICER` de logar no painel web (`AuthService.login()`/`ProtectedRoute` não
  checam `role`, só autenticação); a regra de acesso sempre foi por perfil via `@Roles(...)` nos
  endpoints, nunca por cliente. Troca/permuta de galeria continuam restritas a
  `SUPERVISOR`/`WARDEN`, e — por não fazerem parte do fluxo operacional do Policial Penal em
  campo — só ficam expostas no painel web (decisão de produto, não limitação técnica).
- **Decision — mecânica da permuta**: o usuário escolhe primeiro o **destino** (cela, ou
  galeria+cela); o sistema consulta quem ocupa aquela cela (`GET /cells/:id/occupant`, novo nesta
  revisão) e exibe esse preso pra confirmação antes de efetivar a troca simultânea. Uma permuta
  gera **dois** registros de `Movement`, um por preso (preserva a regra "Movement = um preso por
  registro", research.md #26), vinculados por uma nova coluna `pairedMovement` (auto-referência
  opcional em `movements`, única quando presente) — a única coluna nova introduzida por esta
  revisão, justificada como necessidade estrutural (relacionar dois registros de uma mesma
  operação), não como campo de dado de negócio específico de tipo (o que o usuário rejeitou no
  ponto anterior).
- **Decision — UI**: web ganha um modal por cards pra escolher entre os quatro tipos disponíveis
  ao perfil logado (mesma linguagem visual que o mobile, não abas) — troca de cela deixa de ser
  uma opção dentro do modal de "Alterar situação" (que fica só com liberdade/tornozeleira/
  transferência, agora estruturalmente idênticas entre si). Mobile ganha uma tela nova de
  seleção (dois cards, só os tipos de mesma galeria) acionada por um botão na linha do preso,
  entre "Detalhes" e "Saída".
- **Por que uma coluna nova, e não dado calculado**: sem `pairedMovement`, as duas linhas de uma
  permuta não têm nenhum campo que as ligue — a única forma de reconstruir "quem trocou com quem"
  seria adivinhar por coincidência (mesmo `exitDateTime`, mesmo texto de `reason`, celas que
  "batem"). Isso quebra na prática: duas permutas diferentes registradas no mesmo minuto, em
  galerias diferentes, com o mesmo motivo genérico digitado pelo usuário (ex.: "Reorganização"),
  ficam indistinguíveis por heurística — um relatório poderia casar o preso errado com o parceiro
  errado. Inaceitável num sistema cujo propósito central é auditoria (Constituição III).
  `pairedMovement` resolve isso trocando "adivinhação por coincidência" por uma referência direta
  e garantida pelo próprio banco (chave estrangeira, única quando presente).

  **Como o pareamento se comporta ao longo do tempo** — ponto que gerou dúvida durante a revisão e
  vale deixar explícito: `pairedMovement` é um dado **do evento** (da linha de `Movement`), não um
  atributo permanente do preso. Um Inmate acumula uma linha de `Movement` nova a cada movimentação
  que participa — inclusive cada permuta — exatamente como já acontece com movimentação temporária
  ou qualquer outra situação. Cada uma dessas linhas tem seu próprio `pairedMovement`, correto para
  aquele evento específico; nada é sobrescrito quando o mesmo preso participa de outra permuta
  depois.

  Exemplo concreto: João troca de cela com Marcos (dia 1) — gera as linhas 501 (João →
  `pairedMovement = 502`) e 502 (Marcos → `pairedMovement = 501`). Semanas depois, João troca com
  Paulo (dia 2) — gera duas linhas **novas**, 503 (João → `pairedMovement = 504`) e 504 (Paulo →
  `pairedMovement = 503`); as linhas 501/502 continuam exatamente como estavam, intocadas. "Com
  quem o João trocou" não tem uma resposta única no tempo todo — tem uma resposta por linha/evento:
  na 501 foi com o Marcos, na 503 foi com o Paulo. Isso é consistente com `movements` ser uma
  tabela de histórico imutável (uma vez criada, uma linha nunca é editada — mesma regra já aplicada
  à movimentação temporária retornada).
- **Impact**: reabre parte do trabalho já entregue em T048–T051/T053 (Phase 5) — `FinalTransferDto`
  perde `destinationLocation`; `POST /movements/final/cell-change` é removido/substituído pelos
  quatro endpoints novos; `FinalSituationDialog` (web) perde a opção "Troca de cela" e seu
  seletor de galeria/cela; `CellHistoryReason` ganha `CELL_SWAP`/`GALLERY_CHANGE`/`GALLERY_SWAP`
  no lugar do `CELL_CHANGE` genérico único. Novas tasks T079+ (`tasks.md`, Phase 5) cobrem essa
  revisão — nenhum código foi alterado só com esta atualização de documentação.

## 36. Correção pós-implementação de US3: permuta contra cela compartilhada (`destinationInmateId`)

- **Contexto** (2026-09-01, bug relatado pelo usuário do projeto depois de T091–T095 entregues):
  a mecânica de permuta descrita no ponto 35 acima ("o sistema consulta quem ocupa aquela cela")
  assumia implicitamente **um único** ocupante ativo por cela de destino — `GET
  /cells/:id/occupant` usava `findOne()` e devolvia "qualquer um" dos presos ativos daquela cela,
  sem expor escolha ao usuário. Isso é incorreto pra cela `SHARED` com capacidade > 1 (comum na
  base real): ao permutar contra uma cela com 2+ presos ativos, o sistema trocava com um preso
  arbitrário, não necessariamente o que o usuário via/queria na tela.
- **Decision**: `GET /cells/:id/occupant` é **removido** — substituído pelo endpoint já existente
  `GET /inmates?cellId=&status=ACTIVE` (usado por US1 pra listar presos de uma cela), que já
  devolve TODOS os ocupantes ativos, cada um com `inMovement`/`currentMovement` computados. A
  tela de permuta (web `CellTransferDialog`, mobile `CellSwap`) passa a listar esses candidatos e
  exigir que o usuário escolha explicitamente um — inclusive quando há só um candidato (elimina a
  ambiguidade por completo, não só o caso de 2+). `CellTransferDto` ganha `destinationInmateId`
  (obrigatório só para `/cell-swap` e `/gallery-swap`, checado no service, não no DTO, já que o
  mesmo DTO serve `/cell-change` e `/gallery-change`) — o backend valida que esse preso específico
  está `ACTIVE` e fisicamente naquela cela no momento do POST (`409` se não, mesma semântica de
  condição de corrida de antes).
- **Decision — preso em movimentação como candidato de permuta**: um candidato com
  `inMovement = true` (ex.: em atendimento médico) continua **aparecendo** na lista — o usuário
  pode selecioná-lo — mas a UI mostra um aviso e mantém o botão Confirmar desabilitado enquanto
  ele estiver selecionado (o backend também recusa, `409`, via `assertNoOpenTemporaryMovement`,
  research.md #38 — a mesma regra que já bloqueia o preso de origem de qualquer troca/permuta/
  situação definitiva enquanto ele estiver fisicamente fora da cela). Rejeitar esse candidato
  silenciosamente da lista seria mais confuso do que mostrá-lo com o motivo explícito de por que
  não dá pra confirmar ainda.
- **Impact**: `GET /cells/:id/occupant`, `CellOccupantResponseDto` e
  `CellsService.findActiveOccupant` são removidos (mortos, sem outro chamador).
  `movementsApi.cellOccupant` (web e mobile) removido — as duas telas de permuta passam a usar
  `structureApi.listInmates`. `contracts/movements.md` atualizado para descrever
  `destinationInmateId` e apontar pro `GET /inmates` existente.

## 37. Bug de layout: nome do preso invisível em `GalleryCards` (viewport estreito)

- **Contexto** (2026-09-01, achado pelo usuário ao revisar as mudanças do ponto 36 acima): em
  viewports em torno de 945px de largura (comum em notebook), o nome do preso na lista expandida
  de uma cela (`CellRowInmates`, `frontend/src/features/structure/components/GalleryCards/`)
  ficava completamente invisível — não truncado com "...", literalmente 0px de largura. A causa
  raiz eram três fatores empilhados: (1) `GalleryCards` vira duas colunas a partir de `md`
  (768px), então cada card de Galeria já fica com menos da metade da largura da tela; (2) a lista
  de presos expandida usa indentação fixa `ml-10 mr-16` (104px) sob a linha da cela; (3) o grid de
  3 colunas da linha (`grid-cols-[1fr_1fr_7rem]`) usava `1fr` puro — sem `overflow: visible`, o
  "automatic minimum size" de um grid item já deveria zerar corretamente, mas a combinação dos
  três (card estreito + indentação fixa grande + pouquíssimo espaço residual) fazia o cálculo do
  browser colapsar as duas colunas de texto pra exatos 0px em vez de qualquer largura mínima
  visível.
- **Decision**: três ajustes, nenhum sozinho seria suficiente:
  1. `GalleryCards` só vira duas colunas a partir de `lg` (1024px) — não `md` — dando a cada card
     a largura inteira da tela em viewports médios, onde o espaço é mais escasso.
  2. Indentação da lista de presos reduzida de `ml-10 mr-16` (104px) pra `ml-6 mr-6` (48px).
  3. `INMATE_ROW_GRID` e `CELL_ROW_GRID` passam a usar `minmax(0,1fr)` em vez de `1fr` cru nas
     colunas de texto — forma explícita (não dependente do comportamento implícito de
     `overflow`/auto-minimum) de garantir que a coluna encolhe até 0 sem arrastar o min-content
     do texto junto, e — mais importante — que o conteúdo trunca com "..." em vez de sumir quando
     o espaço realmente for insuficiente.
- **Impact**: mudança só de CSS/layout (`GalleryCards/index.tsx`) — nenhum contrato, endpoint ou
  schema afetado.

## 38. Bloqueio de troca/permuta/situação definitiva com movimentação temporária em aberto

- **Contexto** (2026-09-01, achado pelo usuário antes dos pontos 36/37 acima, nesta mesma sessão
  de revisão pós-T091–T095): nenhum dos fluxos de troca/permuta de cela/galeria ou situação
  definitiva (liberdade/tornozeleira/transferência) verificava se o preso tinha uma movimentação
  `TEMPORARY` em aberto (ex.: em atendimento médico, audiência) antes de registrar a mudança
  estrutural — só `POST /movements` (abrir uma NOVA temporária) tinha essa checagem (FR-010).
  Registrar, por exemplo, uma troca de cela enquanto o preso está fisicamente na enfermaria
  deixaria `inmates.current_cell_id` apontando pra um lugar que não reflete onde ele está.
- **Decision**: `MovementsService` ganha `assertNoOpenTemporaryMovement(inmateId, message)`,
  chamado em dois pontos que juntos cobrem todo endpoint de criação desta seção exceto
  `POST /movements` em si (que já tinha sua própria checagem, agora reaproveitando o mesmo
  helper): `registerFinal` (núcleo transacional compartilhado por `final/release`,
  `/ankle-monitor`, `/transfer`, `cell-change` e `gallery-change` — ver research.md #35) e
  `registerSwap` (`cell-swap`/`gallery-swap`, checado nos **dois** presos envolvidos — origem e
  destino). Resposta `409` em qualquer um dos casos.
- **Decision — espelhamento na UI, não só no backend**: as três superfícies que disparam esses
  endpoints replicam a mesma regra ANTES do usuário preencher o formulário todo, pra não deixar
  ele descobrir só no fim:
  - Web `GalleryCards` (Mapa da Unidade): os botões "Trocar de cela" e "Alterar situação" na
    linha do preso ficam desabilitados (com tooltip explicando) quando `inmate.inMovement`.
  - Web `CellTransferDialog`: candidato de permuta com `inMovement = true` continua aparecendo na
    lista (não é escondido — ver research.md #36), mas com aviso e o botão Confirmar bloqueado.
  - Mobile `InmatesScreen`: o botão "Trocar de cela" (ícone `Shuffle`) fica esmaecido; como não
    existe componente de tooltip no mobile, o toque nele dispara um toast explicando o motivo em
    vez de navegar pra tela de troca. Mobile não tem "Alterar situação" (WARDEN-only, só web,
    research.md #35).
- **Impact**: `backend/src/movements/movements.service.ts` (`registerFinal`/`registerSwap`);
  `GalleryCards/index.tsx` (web); `InmatesScreen/viewmodel.ts` + `InmateRow/index.tsx` (mobile).
  `contracts/movements.md` atualizado para documentar a precondição em todos os endpoints
  afetados, não só `cell-swap`/`gallery-swap`.

## 39. Polimento de UI pós-implementação: títulos de modal, nomes em maiúsculo, combobox com busca

- **Contexto** (2026-09-01, série de ajustes visuais pedidos pelo usuário depois de validar o
  comportamento funcional dos pontos 36/38): três pedidos distintos, todos sobre como a
  informação já correta é apresentada, não sobre regra de negócio.
- **Decision — título dos modais de movimentação**: `CellTransferDialog`, `FinalSituationDialog`
  e `MovementDialog` usavam o formato `"Ação — Nome"` (`DialogTitle` só, com travessão) —
  considerado pouco profissional. Passam a usar o próprio padrão `DialogTitle`/`DialogDescription`
  do shadcn: `DialogTitle` com a ação (ex. "Permuta de galeria"), `DialogDescription` logo abaixo
  com um ícone `User` (lucide) + o nome do preso, sem travessão. `MovementDialog` também perdeu o
  campo somente-leitura "Preso" do corpo do formulário — ficaria redundante com o nome já visível
  no cabeçalho.
- **Decision — nome do preso sempre maiúsculo**: aplicado em toda exibição do nome no web —
  `GalleryCards` (linha da lista), os três cabeçalhos de modal acima, e o combobox de preso de
  destino da permuta. Onde o texto é só apresentação (JSX), usa a classe utilitária `uppercase`
  (CSS `text-transform`, não muda o dado). Onde o texto entra em uma string simples sem como
  escopar CSS — mensagens de `notify()` (toast) e o valor mostrado no *trigger* fechado de um
  combobox baseado em `cmdk` (explicado no próximo ponto) — usa `.toUpperCase()` no próprio
  JavaScript, porque nesses dois casos não existe um elemento HTML dedicado pra estilizar.
- **Decision — combobox com busca no select de preso da permuta**: o `Select` nativo do shadcn
  virou um combobox pesquisável (`Popover` + `Command`/`cmdk`, componentes shadcn adicionados via
  `npx shadcn@latest add popover command` — não escritos à mão, seguindo `docs/style-guide.md`
  §3) — cela com muitos ocupantes tornava rolar uma lista fechada pior do que digitar pra filtrar.
  Dois problemas descobertos ao testar essa troca, ambos corrigidos:
  1. O filtro embutido do `cmdk` é fuzzy/subsequência (as letras digitadas só precisam aparecer
     na mesma ordem em qualquer posição do texto), não substring — digitar "vini" batia também em
     "Otavio Teixeira Martins" por coincidência de posição das letras. Corrigido desligando esse
     filtro (`shouldFilter={false}` no `Command`) e filtrando a lista de candidatos nós mesmos por
     substring simples (`nome.toLowerCase().includes(busca)`), o comportamento que o usuário
     realmente espera de uma busca por nome.
  2. A barra de rolagem da lista (e de qualquer elemento com overflow no app) usava o estilo
     branco/cinza padrão do navegador, destoando do tema escuro — resolvido com um estilo global
     em `frontend/src/index.css` (`@layer base`) usando os próprios tokens de cor do tema
     (`--muted-foreground`) via `scrollbar-color`/`::-webkit-scrollbar`, então vale pro app
     inteiro, não só pra esse combobox.
- **Impact**: `docs/style-guide.md` atualizado (inventário de componentes shadcn + os dois novos
  padrões — cabeçalho de modal ação+sujeito, e combobox em vez de `Select` para listas longas).

## 40. Rotinas (US4, Fase 6): ativação por data específica e interpretação de `shift=today`

- **Contexto** (2026-09-06): `docs/srp_spec_database_model.md`/`data-model.md` já definiam
  `routines`/`routine_schedules` (criados na Fase 2, T010) mas nenhuma tabela pra "ativar/desativar
  a rotina para uma data específica" (`PATCH /routines/:id/activation`, contracts/routines.md,
  exemplo: desativar "Pátio" só no dia de visita). `RoutineSchedule.active` é o default por
  dia-da-semana/horário recorrente — reaproveitá-lo para uma exceção pontual de uma única data
  significaria ou mutar o schedule padrão (perdendo o valor original) ou criar-e-apagar linhas a
  cada ativação/desativação, nenhuma das duas com histórico auditável limpo.
- **Decision**: nova entidade `RoutineDateOverride` (tabela `routine_date_overrides` —
  `routine_id`, `date`, `active`, `updated_by`; único em `(routine_id, date)`, migration
  `AddRoutineDateOverrides`), não documentada no `docs/srp_spec_database_model.md` original. `GET
  /routines` resolve o `active` efetivo de cada rotina, para a data consultada, como: o valor do
  override daquela data, se existir; senão, o `Routine.active` (default `true`) — nunca sobrescreve
  o `RoutineSchedule`/`Routine.active` em si. Uma rotina só aparece na listagem se (a) tiver um
  `RoutineSchedule` cujo `weekday` bate com o dia da semana da data consultada (`weekday IS NULL` =
  todo dia) E (b) esse `active` efetivo for `true`.
- **Consequência prática pra tela web de gestão** (`frontend/src/features/routines/`, T060):
  desativar uma rotina só para hoje faz ela sumir da listagem filtrada por "hoje" — não é um bug,
  é o comportamento correto (a rotina não se aplica hoje). Ela reaparece assim que o filtro de
  "Data" da tela muda pra qualquer outro dia, já que a desativação nunca toca o `active` base.
  Verificado via Playwright: desativar para uma data específica → some do filtro nessa data →
  reaparece em qualquer outra data.
- **Decision — `shift=today`**: `Routine` nunca teve um conceito de turno próprio (só
  `weekday`/`time` via `RoutineSchedule`) — `shift=today`, o único exemplo do contrato, é aceito
  como um alias literal pra "usar a data de hoje" (já o default quando `date` não é informado). Um
  parâmetro `date=YYYY-MM-DD` adicional (não documentado no contrato original, mas necessário pro
  cenário de teste do quickstart.md — "nos demais dias, lista normalmente") permite consultar
  qualquer data específica, não só hoje.
- **Impact**: `contracts/routines.md` continua descrevendo só `shift=today` como exemplo — `date` é
  um parâmetro adicional aceito pela mesma rota, não uma rota nova, então não precisou de uma nova
  linha na tabela de endpoints. `DELETE /routines/:id` (já estava na tabela de endpoints do
  contrato, mas sem task própria em `tasks.md`) foi implementado junto com o resto do módulo em
  T055 — hard delete de verdade (não o soft `active: false` usado em Unidade/Galeria/Cela), `409`
  se `locked=true`, cascata manual (`RoutineSchedule`/`RoutineDateOverride`) numa transação já que
  não há `ON DELETE CASCADE` nas FKs geradas.

## 41. Correção pós-implementação de US4: `includeInactive`, default do diálogo de ativação, clareza de "Padrão"

- **Contexto** (2026-09-06, teste manual do usuário do projeto na tela `/rotinas` logo após T060):
  5 pontos reportados de uma vez — 2 bugs reais, 3 pedidos de clareza/UX.
- **Bug 1 — diálogo de ativação sempre "nascia" mostrando Inativa**: `ActivationDialog`
  inicializava seu `Select` de status com o literal `'false'`, independente do estado real da
  rotina — dava a falsa impressão de que toda rotina recém-criada já nascia desativada, quando na
  verdade `RoutinesService.create()` sempre grava `active: true` (§40). Corrigido: o `Select` agora
  parte de `routine.active` (a rotina é ativa por padrão; desativar por uma data é a exceção
  pontual que o usuário escolhe fazer, não o estado inicial).
- **Bug 2 — rotina desativada numa data simplesmente sumia da listagem de gestão**: era o
  comportamento correto de `GET /routines` para consulta somente-leitura (mobile, FR-020 —
  "programação do turno atual"), mas ruim para a tela de **gestão** web: um WARDEN/SUPERVISOR que
  desativasse uma rotina para uma data não tinha nenhum jeito de ver isso na tabela — a linha
  simplesmente desaparecia, sem indicar que existia e estava inativa. **Decision**: novo parâmetro
  `includeInactive=true` em `GET /routines` (`ListRoutinesQueryDto`, `RoutinesService.list()`) —
  quando presente, a filtragem por `RoutineSchedule` (dia da semana) e por `active` efetivo é
  ignorada, toda rotina da galeria é retornada, e `active`/`schedules` no DTO continuam refletindo
  o status/horários reais daquela data (não os defaults brutos). A tela web (`/rotinas`) passa
  sempre `includeInactive=true` e ganhou uma coluna "Status" (badge Ativa/Inativa) pra mostrar o
  resultado; o consumo mobile (`mobile/src/features/routines/`, T061) não muda — continua sem
  passar o parâmetro, mantendo o filtro de consulta original.
- **Clareza — coluna "Padrão"**: o termo (vocabulário do domínio, FR-018) não explicava sozinho o
  que `locked=true` bloqueia — nem toda a extensão da regra (bloqueia edição de horário/ativação
  por Supervisor **e** exclusão por qualquer perfil, contracts/routines.md). Adicionado um "?"
  (`CircleHelpIcon`) no cabeçalho da coluna com tooltip explicando as duas restrições — mesmo
  padrão já usado em `/configuracoes` (research.md #39-round3), reaproveitado aqui em vez de
  inventar um mecanismo novo.
- **Clareza — ícone de "Editar horários"**: um `ClockIcon` isolado não lia como uma ação de edição.
  Trocado por um `ClockIcon` com um `PencilIcon` pequeno sobreposto no canto inferior-direito
  (`EditScheduleIcon`, `frontend/src/features/routines/index.tsx`) — pedido explícito do usuário
  ("relógio com um lápis"), os outros dois ícones de ação (calendário/lixeira) já estavam OK.
- **Impact**: `backend/test/integration/routines.spec.ts` ganhou uma asserção cobrindo
  `includeInactive=true` numa data desativada (dentro do teste de ativação existente, não um `it`
  novo). Verificado via Playwright de ponta a ponta (criar → confirmar default "Ativa" no diálogo →
  desativar numa data futura → confirmar que a linha continua visível nessa data com badge
  "Inativa" → volta pra "Ativa" noutra data → excluir), 0 erros de console. Backend
  lint/build/unit/integration (10/10 em `routines.spec.ts`) e frontend `tsc`/`eslint`/`vite build`
  todos verdes após a correção.

## 42. Correção pós-implementação de US4 (rodada 2): campos de hora/data em `ScheduleFieldsEditor`/`ActivationDialog`

- **Contexto** (2026-09-06, mesmo dia, segunda rodada de teste manual do usuário): `<input
  type="time">` nativo tinha um seletor cujo dropdown só oferece horários a partir da hora atual em
  diante — comportamento do navegador, fora do controle da aplicação, mas confuso pro usuário.
  `<input type="date">` só abria o calendário nativo clicando exatamente no ícone (extremo direito
  do campo), não em qualquer ponto — também reportado como inconsistente.
- **Decision — hora sempre digitável**: `<input type="time">` substituído por um campo de texto
  controlado (`TimeInput`, `frontend/src/features/routines/components/TimeInput/`) com máscara
  (dígitos digitados são reformatados como `HH:mm` a cada tecla —
  `frontend/src/features/routines/time.ts#formatTimeInput`) e validação (`isValidTime`, mesma regex
  do backend `RoutineScheduleItemDto`). Campo inválido (incompleto ou fora de faixa) ao perder foco
  vira borda vermelha + texto "HORA INVÁLIDA" abaixo — nunca bloqueia a digitação em si, só o envio
  (`canSubmit` em `RoutineDialog`/`ScheduleDialog` passou a checar `isValidTime`, não só
  `time.length > 0`).
- **Decision — data sempre abre calendário no clique**: `DateInput`
  (`frontend/src/features/routines/components/DateInput/`) chama `input.showPicker()` em qualquer
  clique no campo (`try/catch` — `showPicker` pode lançar fora de um gesto do usuário em casos de
  borda), em vez de depender do usuário acertar o ícone nativo.
- **Decision — tema escuro em controles nativos**: adicionado `color-scheme: dark` no bloco `.dark`
  de `frontend/src/index.css` (propriedade herdada, cascata a partir de `<html class="dark">`) e
  `<meta name="color-scheme" content="dark">` em `frontend/index.html` (mecanismo complementar que
  alguns navegadores usam especificamente pra UI nativa). **Resultado parcial**: verificado via
  Playwright que ambos os mecanismos estão corretamente computados (`getComputedStyle` confirma
  `color-scheme: dark` em `<html>`/`<body>`/no próprio `<input>`), mas o popup do calendário nativo
  do `<input type="date">` continuou renderizando em tema claro nesse ambiente de teste (Chromium
  automatizado). Como a aplicação já expõe os dois sinais padrão documentados pra isso e o
  navegador simplesmente não os aplica ao próprio popup, este é um limite de renderização do
  navegador/ambiente de teste, não algo corrigível por mais CSS do lado da aplicação — próxima
  alternativa seria um calendário customizado (componente próprio em vez do `<input type="date">`
  nativo), não tentada aqui por ser desproporcional ao problema (pode renderizar diferente em
  Chrome/Edge de desktop reais; vale reconfirmar lá antes de investir nisso).
- **Decision — espaçamento do botão "Adicionar horário"**: o anel de foco dourado do último campo
  de horário encostava visualmente no botão abaixo (`gap-1.5` do container pai não bastava para a
  extensão do `box-shadow` do ring). Adicionado `mt-2` diretamente no botão
  (`ScheduleFieldsEditor`), sem alterar o espaçamento entre os outros elementos do formulário.
- **Impact**: linha das linhas de horário mudou de `items-center` pra `items-start` no
  `ScheduleFieldsEditor` — necessário porque `TimeInput` agora pode crescer em altura (linha de erro
  abaixo do campo), e `items-center` desalinharia o `Select`/botão de remover nesse caso. Verificado
  via Playwright: máscara formatando ao digitar, erro "HORA INVÁLIDA" aparecendo/sumindo
  corretamente, `Salvar` bloqueado com erro pendente, calendário abrindo em qualquer clique no
  campo de data (tanto no filtro da página quanto no `ActivationDialog`), 0 erros de console em
  toda a rodada.
  Nenhum contrato, endpoint ou schema afetado.
  **Superseded por §43** — `TimeInput` foi reescrito (máscara real por posição de dígito, não mais
  reformatação de string livre) e a mensagem de erro mudou de "HORA INVÁLIDA" para "Hora inválida."
  no estilo `LoginPage`, depois de feedback do usuário na rodada seguinte.

## 43. Correção pós-implementação de US4 (rodada 3): `accent-color`, data só por calendário, `TimeInput` como máscara de verdade

- **Contexto** (2026-09-06, mesmo dia, terceira rodada — usuário confirmou que o fundo escuro do
  calendário da §42 funcionou no navegador real dele, mas reportou 4 pontos novos).
- **Decision — cor de destaque do calendário**: `color-scheme: dark` (§42) só troca o fundo/paleta
  base dos controles nativos, não a cor de "destaque" (accent) usada pelo próprio Chromium pra
  pintar o dia selecionado e botões do popup do `<input type="date">` — essa cor vem de
  `accent-color` (propriedade CSS separada, também usada em checkbox/radio/range nativos).
  Adicionado `accent-primary` (Tailwind, mapeia pra `hsl(var(--primary))`) no `body` dentro de
  `@layer base` — herdado por padrão, não precisa repetir em cada input.
- **Decision — data só por calendário, nunca digitada**: usuário observou que, mesmo já podendo
  escolher a data pelo calendário, o campo continuava aceitando digitação manual livre — dois
  caminhos pra um mesmo valor, um deles sem validação de fato (o navegador restringe dígito por
  segmento, mas não impede completamente um valor "digitado por engano"). `DateInput` ganhou
  `onKeyDown` bloqueando (`preventDefault`) toda tecla exceto `Tab` (navegação de foco) e
  `Enter`/`Espaço` (que chamam `showPicker()`, mesmo efeito do clique) — o valor do campo só muda
  através da seleção no popup do calendário.
- **Decision — "Hora inválida." no padrão de `LoginPage`**: o usuário explicou que escreveu "HORA
  INVÁLIDA" (tudo maiúsculo) na própria mensagem de feedback só pra dar ênfase *pra mim*, não como
  especificação de design — pediu pra eu seguir "o padrão dos outros inputs" na implementação real.
  `LoginPage` (`errors.email`/`errors.password`, react-hook-form) já tinha o padrão estabelecido:
  `<p className="text-sm text-destructive">{message}</p>` abaixo do campo, sem alterar a borda do
  input. `TimeInput` foi alinhado a esse padrão exatamente — texto trocado pra "Hora inválida."
  (frase normal, com ponto) e a borda vermelha (`border-destructive`/`focus-visible:ring-destructive`)
  que a §42 tinha adicionado foi removida (o padrão existente nunca mexe na borda, só no texto
  abaixo).
- **Decision — segundos nunca exibidos**: `RoutineSchedule.time` volta do backend como `HH:mm:ss`
  (coluna `TIME` do Postgres, sem truncamento — já era um problema conhecido, sinalizado mas não
  corrigido na verificação da Fase 6 original). Nova função `toHHMM()`
  (`frontend/src/features/routines/time.ts`, `time.slice(0, 5)`) aplicada em toda exibição: coluna
  "Horários" da tabela e prefill do `ScheduleDialog` ao abrir uma rotina existente pra editar.
- **Decision — `TimeInput` reescrito como máscara de verdade**: a versão da §42 reformatava uma
  string digitada livremente a cada tecla (extrair dígitos, reinserir ":") — funcional, mas o
  usuário pediu explicitamente "ao clicar nele deixe a máscara fixa". Reescrito para manter um
  template `__:__` sempre visível como o próprio valor exibido (não um `placeholder` que some ao
  digitar): cada tecla de dígito (`onKeyDown`, com `preventDefault` sempre) preenche a próxima
  posição em branco da esquerda pra direita; `Backspace`/`Delete` limpa a última posição preenchida
  da direita pra esquerda; qualquer outra tecla (letras, colar texto) é ignorada — o `onChange`
  nativo do `<input>` fica vazio de propósito (só o `onKeyDown` decide o valor), o que também
  bloqueia colar texto livre (`Ctrl+V`), já que o valor colado nunca é lido. `Tab`/`Shift`/
  `Ctrl`/`Cmd`/`Alt` continuam passando direto (navegação de foco, atalhos do navegador intactos).
- **Impact**: `formatTimeInput()` (§42) removida de `time.ts` — sem mais usos, substituída pela
  lógica de posição-de-dígito dentro do próprio `TimeInput`. Verificado via Playwright: máscara
  preenchendo dígito a dígito, backspace limpando da direita pra esquerda, "abc"/colar rejeitados,
  "Hora inválida." no estilo/cor corretos (confirmado via `getComputedStyle`, sem borda vermelha no
  input), data rejeitando digitação mas aceitando seleção via calendário (inclusive por teclado
  dentro do popup nativo), sem segundos em nenhuma exibição. `accent-color` dourado confirmado
  computado corretamente no `body` via Playwright, mas o popup nativo do Chromium automatizado usado
  pra teste continuou mostrando o dia selecionado em azul. 0 erros de console. `tsc`/
  `eslint --max-warnings=0`/`vite build` verdes. Nenhum contrato, endpoint ou schema afetado.
- **Correção** (mesmo dia, feedback do usuário no navegador real dele): o fundo escuro (via
  `color-scheme`) funcionou, mas o dia selecionado/botões do calendário continuaram azuis mesmo com
  `accent-color: hsl(var(--primary))` aplicado no `body` — a hipótese inicial (só limitação do
  Chromium automatizado de teste) estava errada; o popup nativo do `<input type="date">` não herda
  `accent-color` pela cascata normal do DOM como a maioria das propriedades CSS herdadas, só lê o
  valor computado diretamente no próprio elemento `<input>` (diferente de `color-scheme`, que herda
  normalmente e por isso funcionou vindo do `body`). Corrigido aplicando `accent-color` via `style`
  inline direto no `<input>` dentro de `DateInput` (`frontend/src/features/routines/components/DateInput/`),
  em vez de depender só da regra global — a regra global no `body` foi mantida (ainda tinge
  checkbox/radio/range nativos que herdam normalmente).
- **Correção final** (mesmo dia, usuário testou no navegador real e o dia selecionado continuou
  azul mesmo com `accent-color` no próprio elemento): confirmado que não é questão de herança —
  esse navegador simplesmente não aplica `accent-color` ao popup nativo do `<input type="date">`
  de jeito nenhum. Sem mais alavanca de CSS pra tentar, decisão do usuário: trocar o `<input
  type="date">` nativo por um calendário customizado de verdade. Ver §44.

## 44. `<input type="date">` nativo substituído por calendário customizado (`Popover` + `Calendar`)

- **Contexto** (2026-09-06, mesmo dia, quarta rodada): depois de duas tentativas de tingir o popup
  nativo do `<input type="date">` com as cores do sistema (`color-scheme` — funcionou só o fundo;
  `accent-color`, global e depois inline no elemento — não funcionou de jeito nenhum pro dia
  selecionado/botões), ficou claro que o popup nativo é renderizado fora do alcance real do CSS da
  aplicação, de forma inconsistente entre navegadores. Decisão do usuário: trocar por uma biblioteca
  de calendário customizável de verdade.
- **Decision**: `npx shadcn@latest add calendar` — instala `Calendar` (wrapper shadcn sobre
  `react-day-picker@^10`, já usando `bg-primary`/`text-primary-foreground` nas classes do dia
  selecionado, ou seja, as cores do tema já vêm certas por padrão, sem CSS extra) e a dependência
  `date-fns@^4`. Novo componente `DatePicker`
  (`frontend/src/features/routines/components/DatePicker/`) compõe `Popover` (trigger = `Button`
  com ícone de calendário + data em `dd/MM/yyyy`) + `Calendar` (`mode="single"`), substituindo o
  `DateInput` (§42/§43, removido) nos dois lugares que usavam data na Fase 6: o filtro "Data" da
  própria tela e o campo "Data" de `ActivationDialog`. `docs/style-guide.md` atualizado (novo item
  do inventário shadcn + regra "usar `Popover`+`Calendar` em vez de `<input type="date">` nativo").
- **Decision — conversão de data sem bug de fuso horário**: `Calendar`/`react-day-picker` trabalham
  com objetos `Date` do JavaScript, mas o contrato do backend é uma string `YYYY-MM-DD` (coluna
  `DATE`, sem componente de hora). Fazer `new Date("2026-09-06")` parseia como UTC meia-noite — em
  fusos negativos (Brasil, UTC-3), exibir essa data em hora local mostraria "05/09/2026", um dia
  errado. `parseIsoDate`/`toIsoDate` (dentro de `DatePicker/index.tsx`) evitam isso construindo/lendo
  o `Date` sempre em componentes locais (`new Date(year, month - 1, day)`,
  `date.getFullYear()`/`getMonth()`/`getDate()`), nunca via string ISO direto no construtor `Date`.
- **Decision — localização em português**: `Calendar` recebe `locale={ptBR}` de
  `react-day-picker/locale` (nome de mês/dias da semana), e o texto do botão-gatilho usa
  `format(date, 'dd/MM/yyyy', { locale: ptBR })` de `date-fns/locale` — sem isso o padrão do
  `react-day-picker` é inglês (`enUS`).
- **Decision — só seleção, nunca digitação**: diferente do `<input type="date">` nativo (que, mesmo
  com o `onKeyDown` bloqueador da §43, ainda era tecnicamente um campo de texto por baixo), o
  `PopoverTrigger` aqui é um `<button type="button">` — não existe nenhuma superfície de texto pra
  digitar, a única forma de mudar o valor é clicando num dia do calendário.
- **Impact**: `DateInput` (§42/§43) removido por completo (pasta apagada, sem mais usos). Regras
  globais `color-scheme: dark`/`accent-color` (`frontend/src/index.css`) mantidas — ainda se aplicam
  a outro `<input type="date">` nativo existente fora do escopo desta feature
  (`frontend/src/features/structure/components/InmateDialog/`, campo "Data de nascimento"), não
  tocado aqui (fora do pedido do usuário, que era especificamente sobre a tela de Rotinas). Verificado
  via Playwright: popup é DOM real (não picker do SO), mês/dias da semana em português, dia
  selecionado com `background-color` dourado confirmado via `getComputedStyle`, seleção por clique
  fecha o popup e atualiza o botão, nenhuma superfície de digitação encontrada via inspeção do DOM,
  fluxo completo (criar rotina → abrir `ActivationDialog` com o novo calendário → excluir) sem
  erros de console. `tsc`/`eslint --max-warnings=0`/`vite build` verdes.

## 45. Limite de 3 horários por rotina e proibição de horário repetido

- **Contexto** (2026-09-06, mesmo dia): usuário testou criando uma rotina com muitos horários
  (ex.: "Pátio de Sol", 8 linhas) e reportou que a coluna "Horários" da tabela ficava ilegível —
  quebrar a linha deixaria as linhas da tabela com alturas diferentes, o que também não é bom.
  Proposta do próprio usuário, adotada como está: limitar a 3 horários por rotina, e proibir
  horário repetido na mesma rotina (uma rotina que precise do mesmo horário todo dia já usa "Todos
  os dias" numa única linha — nunca é necessário repetir).
- **Decision — limite de 3**: `@ArrayMaxSize(3)` em `CreateRoutineDto.schedules` e
  `UpdateRoutineScheduleDto.schedules` (`backend/src/routines/dto/`, ao lado do `@ArrayMinSize(1)`
  já existente). Frontend: `ScheduleFieldsEditor` esconde o botão "Adicionar horário" ao atingir 3
  linhas, substituindo por um texto "Máximo de 3 horários por rotina." — evita a viagem ao backend
  só pra descobrir o limite.
- **Decision — sem horário repetido**: novo `RoutinesService.assertNoDuplicateTimes()` (comparação
  de `time` via `Set`, ignorando `weekday` — repetir o mesmo horário em dias diferentes também é
  bloqueado, já que "Todos os dias" cobre esse caso), chamado em `create()` e `updateSchedule()`,
  `400` se houver duplicata. Frontend: `ScheduleFieldsEditor` calcula duplicatas entre as linhas
  visíveis e passa um `error` pro `TimeInput` da(s) linha(s) em conflito, mostrando "Horário
  repetido nesta rotina." (só quando o valor já é um horário válido — não interfere com a mensagem
  de máscara incompleta) — `RoutineDialog`/`ScheduleDialog` bloqueiam o Salvar enquanto houver
  qualquer duplicata, nova função `hasNoDuplicateTimes()` em `time.ts`.
- **Impact**: o limite não é retroativo — uma rotina criada antes desta mudança com mais de 3
  horários (o caso real que motivou o pedido) continua exibindo todos os horários que já tinha até
  ser editada; só uma tentativa de salvar (criar nova ou editar horários de uma existente) passa a
  respeitar as duas regras. Verificado via Playwright: limite de 3 aplicado tanto na criação quanto
  na edição de horários existentes, mensagem de duplicata aparecendo/sumindo nas linhas certas,
  Salvar bloqueado enquanto inválido, 2 novos testes de integração em `routines.spec.ts` (12/12
  passando). `tsc`/`eslint --max-warnings=0`/`vite build`/backend lint+build+unit+integration
  verdes.

## 46. Mobile: detalhe da rotina (`RoutineDetail`) e cards de altura uniforme

- **Contexto** (2026-09-21): a lista "Rotinas de hoje" do mobile mostrava todos os horários numa
  linha que quebrava, deixando cards de alturas diferentes (mesmo problema que motivou o limite de
  3 horários na #45, agora no mobile). O usuário também queria ver a rotina completa ao tocar num
  card.
- **Decision — card de uma linha**: `RoutineListItem` usa `numberOfLines={1}` +
  `ellipsizeMode="tail"` em nome, tipo e horários — se não couber, corta com `...` em vez de
  quebrar, e todos os cards ficam com a mesma altura. Passou a ser `Pressable > View` (padrão que
  funciona no app, ver commit `339c870`) com chevron à direita.
- **Decision — nova tela `RoutineDetail`**: somente leitura (FR-020, sem edição no mobile).
  Recebe o objeto `routine` + `galleryCode` por param de navegação (mesmo padrão de
  `MovementRegister` com `inmate`), sem segunda chamada à API — a lista já traz descrição, tipo,
  `locked`, `active` e `schedules`. Mostra: ícone/nome/badges de tipo e situação, "Informações
  gerais" (Tipo, Galeria, Origem Padrão/Específica), "Descrição" (estado vazio tratado) e
  "Horários (N)" — de 1 a 3, cada um em cartão com dia da semana + hora em destaque dourado;
  horário `active: false` aparece esmaecido com o rótulo "Inativo". Só a seção "Horários" rola
  (`ScrollView` próprio); o resto da tela fica fixo. Reaproveita `DetailRow` de
  `InmateDetailScreen`.
- **Impact**: substitui a nota anterior de que os cards de rotina não tinham `onPress` — agora
  têm, a tela continua 100% leitura. `tsc --noEmit` do mobile verde; layout validado pelo usuário
  no emulador.

## 47. Postos de serviço (`posts`), dois turnos e carga horária do dia (US5)

- **Contexto** (2026-09-21): a primeira versão da US5 usava três turnos (manhã, tarde, noite) e
  "setor" como texto livre. O usuário corrigiu, ao testar: só existem **dois turnos** (diurno e
  noturno); a **carga horária** (ex.: 24 h) é do **dia** do policial e é sempre a mesma nos dois
  turnos, enquanto o **posto** pode mudar de um turno para o outro; e nem todo posto é uma
  galeria (pórtico, garita, Infopen) nem uma galeria só (um posto "A/B" cobre as galerias A e B).
- **Decision — tabela `posts`**: entidade própria por unidade (`name` único, `active`), em vez de
  reaproveitar `Gallery` ou manter texto livre. Só `WARDEN` cria/renomeia/desativa
  (`POST`/`PATCH /api/v1/posts`); `SUPERVISOR` só lista para escalar. Desativar é `active=false`
  (mesmo padrão de Unidade/Galeria/Cela): o posto sai das novas escalas e do efetivo mínimo, mas o
  histórico de escalas continua apontando para ele. Escala e efetivo mínimo passam a referenciar
  `post_id`; `sector` e `gallery_id` saem de `staff_schedules`, e `unit_id`/`sector` saem de
  `minimum_staffing_config` (a unidade vem do posto).
- **Decision — dois turnos**: `Shift = DAY | NIGHT` (identificadores em inglês, rótulos "Diurno" e
  "Noturno" só na interface). Na UI, o turno padrão é o corrente (diurno das 07h às 19h).
- **Decision — carga horária**: `workload_hours` (1 a 24) obrigatório em cada escala, mas
  semanticamente do dia. A regra "todas as escalas do mesmo policial na mesma data têm o mesmo
  valor" é validada no service (`422`), não por constraint, porque depende de outras linhas. Na
  UI, o valor já definido para o dia vem preenchido e travado ao escalar o segundo turno. As
  opções oferecidas são 6, 8, 12 e 24 h (a API aceita qualquer inteiro de 1 a 24).
- **Migration** (`AddPostsAndWorkload`): preserva os dados do modelo antigo. Cada setor distinto vira
  um posto de mesmo nome (escalas sem setor caem em "Não informado"); MORNING/AFTERNOON viram DAY,
  mantendo uma só linha quando isso colide com as unicidades (a escala mais antiga; o maior
  mínimo); escalas antigas recebem 12 h por não terem carga horária. O `down` restaura a
  estrutura, mas não a distinção manhã/tarde.
- **Alternatives considered**: (1) posto = `Gallery` — rejeitado, há postos que não são galeria e
  postos que cobrem várias; (2) carga horária como tabela própria por (policial, data) — rejeitado
  por ora, uma coluna com validação cobre o caso sem uma entidade a mais; (3) manter texto livre
  para o posto — rejeitado, permitia divergência entre escala e efetivo mínimo por erro de
  digitação e não dava ao diretor controle do cadastro.
- **Impact**: contracts/staff.md, data-model.md, spec.md (FR-022, FR-022a, FR-022b, FR-024) e
  quickstart.md atualizados. `docs/srp_spec_database_model.md` reflete o novo esquema.

## 48. Escala do dia numa única chamada e falta que desconta do efetivo (US5)

- **Contexto** (2026-09-21): a primeira versão de "Nova escala" criava uma escala por turno, então
  um plantão de 24 h exigia dois cadastros repetindo a carga horária. Além disso, o relatório de
  efetivo mínimo contava como "escalado" quem já tinha sido marcado com falta, o que escondia
  postos sem ninguém.
- **Decision — `POST /schedules` registra o dia**: o corpo passa a ser `{ userId, unitId, date,
  workloadHours, assignments: [{ shift, postId }] }` (1 ou 2 itens, sem repetir turno) e cria uma
  escala por item numa **transação** (tudo ou nada); a resposta é `{ data, total }`. Como a carga
  horária é do dia, ela deixa de ser repetida por turno. Continua possível completar depois o
  turno que ficou de fora (nova chamada, mesma carga horária, senão `422`; turno já escalado
  responde `409`).
- **Decision — falta desconta**: no `GET /schedules/minimum-staffing`, `staffed` passa a ser
  quem está de fato no posto. Escalas com `attendanceStatus` `ABSENT` saem de
  `staffed` e entram no novo campo `absent`; presença ainda não registrada (`null`) conta como
  escalado (é o planejado) e `PRESENT` conta. Não existe abono (só presença e falta). Trocar isso é mudar uma condição no `StaffService`.
- **Alternatives considered**: (1) manter uma chamada por turno e o frontend chamar duas vezes —
  rejeitado, a segunda pode falhar e deixar o dia pela metade; (2) endpoint separado só para o dia
  inteiro — rejeitado, duplicaria a rota sem necessidade, uma escala de um turno só é o caso
  particular de um item em `assignments`; (3) manter o abono — descartado, o usuário definiu só presença e falta.
- **Impact**: contracts/staff.md, data-model.md, spec.md (FR-022, FR-023), quickstart.md; frontend
  (`ScheduleDialog`, `MinimumStaffingSummary`) e testes de integração de `staff`. Sem migration.


## 49. Relatórios e auditoria (US6): rotinas sem execução, escopo da auditoria e paginação

- **Contexto** (2026-09-24): implementação da US6 (`/api/v1/reports/*`, `/api/v1/audit`, telas web
  `/relatorios` e `/auditoria`), validada contra os dados do banco de desenvolvimento e no navegador.
- **Decision — rotinas não têm registro de execução**: rotina é atividade coletiva (FR-017) e não
  existe evento de "rotina executada". `GET /reports/routine-execution` devolve, por rotina e galeria,
  as ocorrências **programadas** e as **desativadas por data** (mesma regra de ativação de
  `GET /routines`: o override da data vence `Routine.active`), com `executionTracked: false`.
  `routinesNotExecuted` de `/reports/inconsistencies` é sempre `[]`. Medir cumprimento/atraso exigiria
  um registro de execução (fora do escopo desta versão).
- **Decision — escopo de unidade da auditoria**: `audit_logs` não tem unidade; `GET /audit` devolve só
  entradas cujo **autor** pertence a alguma unidade do usuário (`user_units`). Entradas sem autor
  (ex.: login recusado de e-mail desconhecido) não aparecem. Somente `GET`, sem escrita (FR-027).
- **Decision — valores anteriores**: o `AuditInterceptor` grava só `newData`; `oldData` só existe onde o
  serviço chama `AuditService.record()` com o estado anterior (usuários, troca/permuta de cela,
  situação final). Ler o estado antes de todo `PATCH`/`DELETE` foi rejeitado por dobrar o custo de
  escrita. A tela mostra o "Dados do registro" (novo valor) e só exibe "Valores anteriores" quando
  o dado existe.
- **Decision — paginação no servidor**: todas as listas dos relatórios aceitam `limit` (padrão 25,
  máx. 100) e `offset` e devolvem `total`; `/reports/inconsistencies` pagina as duas listas de forma
  independente (`withoutReturnOffset`/`withoutReasonOffset`); `/reports/staff-vs-movements` sempre
  devolve os dois turnos. Web: 10 itens por página nos relatórios e 25 na auditoria.
- **Decision — turnos em horário local**: `staff-vs-movements` agrupa movimentações pelo turno
  (diurno 07h–19h, noturno 19h–07h) em `America/Sao_Paulo`, contando pela cela de origem.
- **Decision — interface**: cada aba de relatório tem um botão de ajuda com modal explicativo
  (`helpContent.ts`); `Badge` ganhou a variante `info` (azul) para Login/Logout, prevista no guia de
  estilo para "informativo neutro".
- **Alternatives considered**: (1) filtrar a auditoria por tabela de origem em vez de por autor —
  rejeitado, exigiria unidade em toda entrada; (2) paginar no cliente — rejeitado, as listas crescem
  sem limite; (3) criar `routine_executions` agora — adiado.
- **Impact**: contracts/reports-audit.md, tasks.md (T068–T072), testes `reports-audit.spec.ts`. Sem
  migration.

## 50. Imutabilidade de `audit_logs` garantida no banco (trigger)

- **Contexto** (2026-09-24): a FR-027 e a Constituição III exigem que a auditoria nunca seja alterada
  ou removida, "mesmo por perfis administrativos". Até aqui isso valia só porque nenhuma API expunha
  `UPDATE`/`DELETE`; quem tivesse acesso direto ao banco (ou um bug futuro) ainda podia mexer.
  Fechado como T105 do `/speckit-converge`.
- **Decision — trigger em vez de permissões**: a migration `MakeAuditLogsImmutable1790200000000` cria
  a função `audit_logs_block_change()` (dispara `RAISE EXCEPTION 'audit_logs is immutable: <op> is not
  allowed'`, `ERRCODE restrict_violation`) e a trigger `audit_logs_immutable`
  (`BEFORE UPDATE OR DELETE OR TRUNCATE`, `FOR EACH STATEMENT`). `INSERT` continua livre, então o
  `AuditService` e o `AuditInterceptor` não mudaram. Linhas antigas não foram alteradas.
- **Por que não `REVOKE UPDATE, DELETE`**: a aplicação conecta como `root`, que é dono da tabela e
  superusuário no ambiente atual; revogar privilégio de dono/superusuário não tem efeito. A trigger
  vale para qualquer usuário. Se um dia houver um usuário de aplicação separado sem privilégio de
  alteração, pode-se somar a revogação como segunda camada.
- **Como operar**:
  - Aplicar: `npm run migration:run` (em `backend/`). Já aplicada no banco de desenvolvimento em
    2026-09-24; o banco de teste recebe a migration em `pretest:integration`.
  - Reverter: `npm run migration:revert` remove a trigger e a função.
  - Verificar: `\d audit_logs` no `psql` lista `audit_logs_immutable`; ou
    `BEGIN; UPDATE audit_logs SET action = 'LOGIN' WHERE id = 1; ROLLBACK;` deve falhar.
  - **Reset dos testes**: `setup-test-db.ts` faz `TRUNCATE ... CASCADE` (que atinge `audit_logs`);
    por isso desliga a trigger (`ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_immutable`) só
    durante o reset e a religa em seguida (`finally`). Qualquer novo script que precise esvaziar
    tabelas pai (`users`, `roles`) com `CASCADE` precisa do mesmo cuidado.
  - **Nova migration que altere dados de `audit_logs`** (ex.: corrigir uma coluna) falha; ela precisa
    desligar e religar a trigger de forma explícita e justificada.
- **Limite conhecido**: dono da tabela ou superusuário ainda consegue desligar ou remover a trigger.
  Isso só se resolve com controle de acesso ao servidor do banco e backups; a trigger protege contra
  erro, bug e uso indevido pela aplicação, não contra quem administra o banco.
- **Alternatives considered**: (1) só `REVOKE` — sem efeito com `root`; (2) regra `RULE ... DO
  INSTEAD NOTHING` — falha em silêncio, escondendo tentativas; (3) tabela particionada ou WORM
  externo — excessivo para o escopo.
- **Impact**: migration nova, `setup-test-db.ts`, teste `audit-immutability.spec.ts`, data-model.md,
  `docs/srp_spec_database_model.md` e tasks.md (T105). Sem mudança na API nem no frontend.

## 51. Fase de polimento: auditoria da Constituição, OpenAPI, carga e validação ponta a ponta

- **Contexto** (2026-09-24): fechamento da Phase 9 (T073 a T078).
- **Auditoria da Constituição (T074)**:
  - **V (camadas)**: nenhum controller injeta repositório ou `DataSource` nem contém regra de
    negócio (só delegam a services); acesso ao banco fica em services via repositórios do TypeORM e
    no helper `inmates/helpers/countActiveInmatesInScope`. Sem violação.
  - **XI (idioma)**: varredura dos identificadores TypeScript (backend, frontend, mobile e testes) e
    dos nomes de tabelas, colunas e valores de enum do esquema: tudo em inglês. Nenhum `any`,
    `@ts-ignore` ou `@ts-expect-error` no código. Textos de interface em português.
  - **IX (manutenção)**: achada lógica duplicada, `resolveUnitScope` em `StaffService` e
    `ReportsService`; unificada em `UnitsService.resolveScope`. Restam 6 `eslint-disable` de
    `react-hooks/exhaustive-deps` no frontend (efeitos que dependem de valor inicial), aceitos.
  - **Texto de interface**: frases unidas por travessão (regra de UI registrada pelo usuário)
    trocadas por frases separadas em 6 pontos (web e mobile). Travessão usado só como marcador de
    campo vazio (`?? '—'`) foi mantido.
- **OpenAPI (T076)**: as 54 operações de `/api/v1` têm `@ApiOperation` (resumo em português) e as
  respostas 401 e 403 nos controllers autenticados. Os esquemas dos DTOs vêm do plugin do Swagger
  na CLI do Nest (`nest-cli.json`, `classValidatorShim` e `introspectComments`); listas paginadas
  usam o decorator `ApiPaginatedResponse(Item)`, porque o plugin não resolve genéricos. O teste
  `swagger.spec.ts` falha se uma operação ficar sem resumo ou sem 401/403. O plugin só age em
  `nest build`/`nest start`, não sob ts-jest.
- **Limites de requisição configuráveis**: `THROTTLE_LIMIT`, `THROTTLE_TTL_MS` e
  `THROTTLE_LOGIN_LIMIT` (padrões 100, 60000 e 5, iguais ao comportamento anterior). Existem só
  para o teste de carga: o k6 envia tudo de um IP e bateria no 429 (o login tem limite próprio de 5
  por minuto, que é a proteção contra força bruta e continua ativa por padrão).
- **Carga (T074a e T075)**: `backend/test/load/shift-change.js` (k6, binário nativo; a imagem Docker
  não enxerga o `localhost` do WSL). 200 usuários virtuais, backend isolado em `srp_db_test`:
  p95 geral 23,4 ms (login 106 ms, consulta 11,9 ms, movimentação 27,9 ms), 0% de falha e 0 respostas
  5xx em 20.212 requisições. SC-004 atendido nesse ambiente; repetir no ambiente de destino.
- **Validação ponta a ponta (T073)**: `backend/test/quickstart/validate-quickstart.js` executa os
  cenários 0 a 6 (37 verificações, todas passando) e confirma que nenhuma tentativa negativa
  responde 5xx. O cenário 7 (fila offline do app) e o cronômetro humano do cenário 2 (SC-001) só
  podem ser feitos no emulador, que roda no **Windows**; ver o passo a passo em `quickstart.md`.
- **Alternatives considered**: (1) manter o `resolveUnitScope` duplicado — rejeitado, é regra de
  escopo de unidade (FR-004a) e divergir dela seria um problema de segurança; (2) descrever o
  Swagger só com decorators manuais nos DTOs — rejeitado, custo alto e fácil de esquecer; o plugin
  gera a partir dos tipos; (3) desligar o limite de login no código para o teste — rejeitado, o
  limite passa a ser configurável e continua em 5 por padrão.
- **Impact**: `nest-cli.json`, controllers (decorators), `common/decorators/api-paginated-response`,
  `config/configuration.ts`, `app.module.ts`, `auth.controller.ts`, `units.service.ts`, novos testes
  e scripts em `backend/test/`, README.md (antes vazio) e `.env.example`. Nenhuma regra de negócio
  nem migration.
