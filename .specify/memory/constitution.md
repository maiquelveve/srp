<!--
Sync Impact Report
==================
Version change: 1.0.0 → 1.1.0
Rationale for MINOR bump: Addition of a new principle (XI. Language Convention). No existing
principle was redefined or removed; this is a material expansion of guidance per the versioning
policy below.

Modified principles: N/A

Principles added:
  - XI. Language Convention

Sections added: N/A (existing sections amended in place — see below)

Sections removed: N/A

Amendments to existing sections:
  - Development Standards: added explicit cross-reference to Principle XI for identifier/schema
    naming.

Follow-up TODOs:
  - Rename existing Portuguese identifiers in data-model.md, docs/srp_spec_database_model.md and
    specs/001-gestao-rotinas-presos/contracts/*.md to English, applied retroactively per project
    decision (2026-08-04) before /speckit-implement generates backend/prisma code from them.

---

Sync Impact Report (previous)
==============================
Version change: [TEMPLATE - unratified] → 1.0.0
Rationale for MAJOR bump: Initial ratification of the project constitution. The file previously
held only unfilled template placeholders; this is the first concrete set of governing principles,
so it is treated as a foundational (MAJOR) version.

Principles added:
  - I. Domain First
  - II. Security First
  - III. Auditability
  - IV. Data Integrity
  - V. Clean Architecture
  - VI. Single Source of Truth
  - VII. Consistency
  - VIII. Testability
  - IX. Maintainability
  - X. Documentation

Sections added:
  - Development Standards
  - Decision Priority
  - Governance (amendment procedure, versioning policy, compliance review)

Follow-up TODOs: none — all placeholders resolved using docs/srp_constitution.md as source.
-->

# SRP Constitution

## Core Principles

### I. Domain First

Toda implementação DEVE ser guiada pela especificação funcional (`docs/srp_spec.md`). A
especificação é a única fonte de verdade para regras de negócio; nenhuma funcionalidade pode ser
implementada com base em suposições. Em caso de conflito entre código e especificação, a
especificação prevalece.

### II. Security First

A segurança precede a conveniência. Todo acesso ao sistema DEVE ser autenticado e autorizado.
Toda operação DEVE respeitar os perfis de acesso definidos na especificação. Nenhuma informação
sensível pode ser exposta por APIs, logs ou interfaces.

### III. Auditability

O sistema DEVE ser totalmente auditável. Toda operação que cria, altera ou remove dados relevantes
DEVE gerar um registro de auditoria contendo: usuário responsável, data e hora, ação executada,
entidade afetada, valores anteriores (quando aplicável) e novos valores. Registros de auditoria
NUNCA podem ser alterados ou removidos, mesmo por perfis administrativos.

### IV. Data Integrity

A integridade dos dados é obrigatória. O sistema NUNCA deve permitir estados inconsistentes. Toda
alteração DEVE preservar as regras definidas pela especificação. Validações críticas DEVEM ocorrer
no backend, independentemente da interface utilizada (web, mobile ou API direta).

### V. Clean Architecture

As responsabilidades DEVEM permanecer separadas: interfaces apresentam informações; controllers
recebem requisições; services implementam regras de negócio; repositories acessam persistência.
Regras de negócio NUNCA devem residir na interface nem diretamente nos controllers.

### VI. Single Source of Truth

Cada informação DEVE possuir apenas uma fonte oficial. Duplicação de dados deve ser evitada.
Sempre que possível, estados derivados DEVEM ser calculados a partir dos registros oficiais em vez
de armazenados separadamente.

### VII. Consistency

Toda API DEVE seguir padrões consistentes: nomenclatura uniforme, respostas padronizadas,
tratamento consistente de erros e versionamento quando necessário. A experiência de
desenvolvimento DEVE ser previsível em todos os módulos.

### VIII. Testability

Regras de negócio DEVEM ser implementadas de forma testável. Toda funcionalidade crítica DEVE
possuir testes automatizados. Nenhuma alteração relevante pode reduzir a cobertura de testes
existente.

### IX. Maintainability

O código DEVE priorizar legibilidade antes de otimizações prematuras. Duplicação de lógica deve
ser evitada. Cada módulo DEVE possuir responsabilidade única. Alterações futuras devem exigir o
menor impacto possível sobre o restante do sistema.

### X. Documentation

Mudanças que alterem regras de negócio DEVEM atualizar a documentação correspondente. A
implementação DEVE permanecer sincronizada com a especificação. Nenhuma funcionalidade é
considerada concluída se a documentação estiver desatualizada.

### XI. Language Convention

Todo código-fonte (variáveis, funções, classes, módulos) e todo o schema de banco de dados
(nomes de tabelas, colunas, constraints, enums) DEVEM ser escritos em inglês, sem exceção. Textos
exibidos ao usuário final na interface (rótulos, mensagens de tela, conteúdo do front-end web e do
aplicativo móvel) DEVEM ser escritos em português. Documentação de negócio voltada a stakeholders
não-técnicos (especificações funcionais, este documento) permanece em português; documentação
técnica que espelha identificadores de código ou banco (modelos de dados, contratos de API,
schemas) DEVE usar os mesmos identificadores em inglês definidos no código, para que spec e
implementação nunca divirjam em nomenclatura (reforça o Princípio I — Domain First).

## Development Standards

Toda implementação DEVE:

- seguir a arquitetura definida pelo projeto;
- utilizar tipagem forte;
- evitar código morto;
- evitar duplicação de lógica;
- manter baixo acoplamento entre módulos;
- preservar compatibilidade com funcionalidades existentes sempre que possível;
- nomear identificadores de código e schema de banco em inglês, e todo texto voltado ao usuário
  final em português, conforme o Princípio XI.

## Decision Priority

Sempre que houver conflito entre objetivos, a ordem de prioridade é:

1. Segurança
2. Integridade dos dados
3. Auditabilidade
4. Regras de negócio
5. Manutenibilidade
6. Performance
7. Experiência do usuário
8. Conveniência de implementação

## Governance

Esta Constituição prevalece sobre qualquer outra prática, guia ou convenção do projeto. Toda
alteração desta Constituição DEVE ocorrer antes da implementação de mudanças que a contrariem. As
especificações do projeto (`docs/srp_spec.md`, `docs/srp_spec_database_model.md` e demais
documentos) DEVEM obedecer integralmente aos princípios definidos neste documento.

**Procedimento de emenda**: alterações a esta Constituição exigem (1) documentação da mudança
proposta e sua justificativa; (2) verificação de compatibilidade com as especificações e templates
existentes; (3) atualização de versão conforme a política de versionamento semântico abaixo.

**Política de versionamento semântico**:

- **MAJOR**: remoção ou redefinição incompatível de princípios existentes.
- **MINOR**: adição de novo princípio ou expansão material de diretrizes.
- **PATCH**: esclarecimentos, correções de redação e refinamentos não semânticos.

**Revisão de conformidade**: todo Pull Request e toda revisão de código DEVEM verificar a
conformidade com os princípios desta Constituição. Complexidade adicional DEVE ser justificada
frente aos princípios de Manutenibilidade (IX) e Consistency (VII).

**Version**: 1.1.0 | **Ratified**: 2026-08-02 | **Last Amended**: 2026-08-04
