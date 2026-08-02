# Phase 0 Research: Gestão de Rotinas Penitenciárias (SRP)

**Input**: Technical Context em [plan.md](./plan.md), `docs/srp_plan.md`, `docs/srp_spec_database_model.md`.

Todas as decisões de stack (NestJS, Prisma, PostgreSQL, React/Vite, React Native/Expo) já vêm
determinadas por `docs/srp_plan.md` e não são tratadas como incertezas — nenhum item do Technical
Context ficou marcado como `NEEDS CLARIFICATION`. As pesquisas abaixo resolvem as decisões de
melhores práticas necessárias para implementar essa stack em conformidade com a Constituição do
projeto.

## 1. Framework de testes — Backend

- **Decision**: Jest para testes unitários de services/controllers, Supertest para testes de
  integração de endpoints HTTP (com banco de teste PostgreSQL isolado via Prisma).
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

- **Decision**: O JWT emitido no login carrega `perfil` e a lista de `unidade_id` a que o usuário
  está vinculado. Guards do NestJS validam tanto o perfil (RBAC) quanto o escopo de unidade em
  todo endpoint que manipula presos, rotinas, escalas ou auditoria, filtrando/validando o
  `unidade_id` do recurso acessado contra o token.
- **Rationale**: Implementa diretamente a decisão tomada em `/speckit-specify` (FR-004a) e mantém
  a validação de autorização inteiramente no backend, conforme Constituição II (Security First) —
  o frontend/mobile nunca é a única barreira de controle de acesso.
- **Alternatives considered**: Checagem de unidade apenas em queries do frontend (rejeitada —
  viola Security First, pode ser contornada por chamadas diretas à API); tabela de permissões
  totalmente dinâmica por usuário (rejeitada — spec não pede granularidade além de
  perfil × unidade, adicionaria complexidade não requisitada, contra a Constituição IX).

## 6. Auditoria automática e imutável (Constituição III, FR-026/FR-027)

- **Decision**: Um `AuditInterceptor` global captura toda requisição de escrita bem-sucedida
  (POST/PATCH/PUT/DELETE) nos módulos de negócio e delega a um `AuditService` central, que grava
  usuário responsável, ação, entidade afetada, valores antigos/novos e data/hora na tabela
  `auditoria_logs`. Nenhum controller ou repository expõe rota de update/delete para essa tabela.
- **Rationale**: Centralizar a captura evita depender de cada desenvolvedor lembrar de logar
  manualmente em cada novo endpoint (fonte comum de lacunas de auditoria), atendendo à exigência
  de que auditoria seja total (Constituição III).
- **Alternatives considered**: Chamadas manuais de log em cada service (rejeitada — frágil, fácil
  esquecer em endpoints novos); triggers de banco (`pg_audit`/triggers SQL) isoladamente
  (rejeitada como única solução — não tem acesso direto ao "usuário responsável" da requisição
  HTTP sem contexto de aplicação; pode ser avaliada futuramente como camada extra de defesa, fora
  do escopo desta fase).

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

- **Decision**: Todo o schema é definido em `prisma/schema.prisma`, espelhando tabela a tabela o
  modelo de `docs/srp_spec_database_model.md`; toda mudança de schema passa exclusivamente por
  `prisma migrate`. Nenhuma alteração manual (`ALTER TABLE` direto) é permitida em nenhum
  ambiente.
- **Rationale**: Requisito explícito de `docs/srp_plan.md` ("Nenhuma alteração manual no banco é
  permitida") e da Constituição IV (Data Integrity / nunca estados inconsistentes).
- **Alternatives considered**: Ferramenta de migration separada (Flyway/Knex) — rejeitada, pois o
  plano exige uso exclusivo do Prisma como ORM e ferramenta de migration.

## 9. `presos.status` como projeção derivada (Constituição VI)

- **Decision**: A coluna `presos.status` é atualizada transacionalmente pelo mesmo
  service/transaction que grava a movimentação, a situação definitiva ou a troca de cela em
  `preso_cela_historico`/`movimentacoes` — nunca editada isoladamente por outro fluxo.
- **Rationale**: SC-003 exige consulta de status em até 5s; recalcular o status a partir do
  histórico completo a cada consulta não escalaria para 200+ usuários simultâneos (SC-004). Manter
  uma projeção sempre escrita na mesma transação que sua fonte evita duplicação de fonte de
  verdade divergente, respeitando a intenção da Constituição VI mesmo usando uma coluna
  desnormalizada para leitura rápida.
- **Alternatives considered**: Calcular status em tempo de leitura via `JOIN`/subquery no
  histórico (rejeitada nesta fase — custo de performance incompatível com SC-003 em escala);
  view materializada com refresh assíncrono (rejeitada — introduziria janela de inconsistência
  entre o evento real e o status exibido, inaceitável para um sistema de segurança).
