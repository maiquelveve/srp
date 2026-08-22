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
