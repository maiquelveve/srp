# SRP Constitution

## Core Principles

### I. Domain First

Toda implementação deve ser guiada pela especificação funcional (`srp_spec.md`).

A especificação é a única fonte de verdade para regras de negócio. Nenhuma funcionalidade deve ser implementada baseada em suposições.

Caso exista conflito entre código e especificação, a especificação prevalece.

---

### II. Security First

A segurança é prioridade sobre conveniência.

Todo acesso ao sistema deve ser autenticado e autorizado.

Todas as operações devem respeitar os perfis de acesso definidos na especificação.

Nenhuma informação sensível pode ser exposta por APIs, logs ou interfaces.

---

### III. Auditability

O sistema deve ser totalmente auditável.

Toda operação que cria, altera ou remove dados relevantes deve gerar um registro de auditoria contendo:

- usuário responsável
- data e hora
- ação executada
- entidade afetada
- valores anteriores (quando aplicável)
- novos valores

Os registros de auditoria nunca podem ser alterados.

---

### IV. Data Integrity

A integridade dos dados é obrigatória.

O sistema nunca deve permitir estados inconsistentes.

Toda alteração deve preservar as regras definidas pela especificação.

Validações críticas devem ocorrer no backend, independentemente da interface utilizada.

---

### V. Clean Architecture

As responsabilidades devem permanecer separadas.

- Interfaces apresentam informações.
- Controllers recebem requisições.
- Services implementam regras de negócio.
- Repositories acessam persistência.

Regras de negócio nunca devem ficar na interface nem diretamente nos controllers.

---

### VI. Single Source of Truth

Cada informação deve possuir apenas uma fonte oficial.

Duplicação de dados deve ser evitada.

Sempre que possível, estados derivados devem ser calculados a partir dos registros oficiais em vez de armazenados separadamente.

---

### VII. Consistency

Toda API deve seguir padrões consistentes.

- nomenclatura uniforme
- respostas padronizadas
- tratamento consistente de erros
- versionamento quando necessário

A experiência de desenvolvimento deve ser previsível em todos os módulos.

---

### VIII. Testability

Regras de negócio devem ser implementadas de forma testável.

Toda funcionalidade crítica deve possuir testes automatizados.

Nenhuma alteração relevante deve reduzir a cobertura existente.

---

### IX. Maintainability

O código deve priorizar legibilidade antes de otimizações prematuras.

Duplicação de lógica deve ser evitada.

Cada módulo deve possuir responsabilidade única.

Alterações futuras devem exigir o menor impacto possível.

---

### X. Documentation

Mudanças que alterem regras de negócio devem atualizar a documentação correspondente.

A implementação deve permanecer sincronizada com a especificação.

Nenhuma funcionalidade é considerada concluída se a documentação estiver desatualizada.

---

## Development Standards

Toda implementação deve:

- seguir a arquitetura definida pelo projeto;
- utilizar tipagem forte;
- evitar código morto;
- evitar duplicação de lógica;
- manter baixo acoplamento entre módulos;
- preservar compatibilidade com funcionalidades existentes sempre que possível.

---

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

---

## Amendment Policy

Toda alteração desta Constituição deve ocorrer antes da implementação de mudanças que a contrariem.

As especificações do projeto devem obedecer integralmente aos princípios definidos neste documento.