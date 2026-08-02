# SRP Implementation Plan

## Objetivo

Implementar o Sistema de Rotinas Penitenciárias (SRP) conforme definido em `srp_spec.md`, utilizando arquitetura moderna, modular e escalável.

Este plano descreve a estratégia de implementação, ordem de desenvolvimento e critérios técnicos que deverão ser seguidos durante todo o projeto.

---

# Objetivos Técnicos

O sistema deverá:

- ser totalmente web-based;
- possuir backend REST em NestJS;
- possuir frontend React para administração;
- possuir aplicativo React Native para uso operacional;
- utilizar PostgreSQL como banco de dados;
- ser totalmente auditável;
- permitir evolução modular sem grandes refatorações.

---

# Arquitetura

## Backend

Stack obrigatória:

- Node.js
- NestJS
- Prisma ORM
- PostgreSQL
- JWT Authentication
- Swagger/OpenAPI

Organização por módulos:

```
src/

auth/
users/
roles/

units/
galleries/
cells/

inmates/
movements/

routines/
staff/
reports/

audit/

common/
config/
```

Cada módulo deve conter:

- Controller
- Service
- Repository
- DTOs
- Entities
- Validators
- Tests

---

## Frontend Web

Stack:

- React
- Vite
- TypeScript
- TailwindCSS
- shadcn/ui
- TanStack Query
- React Hook Form
- Zod

Organização:

```
src/

pages/
components/
layouts/
hooks/
services/
features/
contexts/
types/
```

---

## Mobile

Stack:

- React Native
- Expo
- TypeScript

Objetivos:

- registrar movimentações rapidamente
- consultar presos
- consultar rotinas
- funcionar bem em conexões instáveis

---

# Estratégia de Implementação

A implementação deve ocorrer em fases.

## Fase 1

Infraestrutura

- autenticação
- autorização
- usuários
- perfis
- auditoria
- banco de dados
- migrations
- seed

---

## Fase 2

Cadastro estrutural

- unidades
- galerias
- celas
- presos

---

## Fase 3

Rotinas

- cadastro
- horários
- ativação
- configuração

---

## Fase 4

Movimentações

- saída
- retorno
- movimentações definitivas
- atualização automática do status do preso

---

## Fase 5

Controle de efetivo

- policiais
- escalas
- turnos
- setores

---

## Fase 6

Relatórios

- movimentações
- auditoria
- efetivo
- ocupação
- inconsistências

---

# Banco de Dados

Utilizar exclusivamente Prisma.

Todas as alterações deverão ocorrer através de migrations.

O schema Prisma deve permanecer sincronizado com o modelo definido em `srp_spec_database_model.md`.

Nenhuma alteração manual no banco é permitida.

---

# API

Padrão REST.

Versionamento:

```
/api/v1/
```

Todos os endpoints devem possuir:

- validação
- autenticação
- autorização
- documentação Swagger

---

# Segurança

Implementar:

- JWT
- Refresh Token
- RBAC
- Hash Argon2
- Rate Limiting
- Helmet
- CORS

Toda rota protegida por autenticação.

---

# Auditoria

Registrar automaticamente:

- login
- logout
- criação
- alteração
- exclusão lógica
- movimentações
- alterações de rotina
- alterações de escala

---

# Qualidade

Obrigatório:

- ESLint
- Prettier
- Husky
- lint-staged

TypeScript em modo strict.

Não utilizar:

- any
- @ts-ignore
- lógica de negócio em controllers
- acesso direto ao banco fora dos repositories

---

# Testes

Backend

- testes unitários
- testes de integração

Frontend

- testes de componentes
- testes dos principais fluxos

---

# Critérios de Conclusão

Uma funcionalidade somente será considerada concluída quando:

- implementar todos os requisitos da especificação;
- possuir validações;
- possuir controle de permissões;
- registrar auditoria quando aplicável;
- possuir testes;
- possuir documentação atualizada;
- passar em lint e build.

---

# Ordem de Prioridade

1. Segurança
2. Integridade dos dados
3. Auditoria
4. Regras de negócio
5. Performance
6. Usabilidade
7. Refatoração