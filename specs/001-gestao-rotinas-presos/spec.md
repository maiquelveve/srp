# Feature Specification: Gestão de Rotinas Penitenciárias (SRP)

**Feature Branch**: `001-gestao-rotinas-presos`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "~\projetos\spr\docs\srp_spec.md" — sistema digital para gestão das rotinas operacionais do sistema prisional do Rio Grande do Sul, substituindo o controle atual baseado em folhas impressas por um registro eletrônico estruturado e auditável, cobrindo cadastro de presos/unidades/celas, movimentações, situações definitivas, rotinas, controle de efetivo e relatórios/auditoria.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cadastro e Mapa da Unidade (Priority: P1)

Chefia/Diretor e Supervisor cadastram e mantêm atualizados os dados estruturais da unidade prisional: unidades, galerias, celas e presos (identificação, foto, dados pessoais, regime, cela atual, status). Policiais penais e supervisores consultam esse mapa para saber quem está em cada cela/galeria e qual sua situação atual.

**Why this priority**: Toda a operação do sistema (movimentações, rotinas, efetivo, relatórios) depende da existência desses cadastros. Sem eles nenhum outro fluxo pode ser testado ou operado — é a base sobre a qual o restante do sistema é construído.

**Independent Test**: Pode ser testado de forma independente cadastrando uma unidade, uma galeria, uma cela e um preso, e verificando que o preso aparece corretamente associado à sua cela/galeria/unidade no mapa da unidade, mesmo sem nenhuma movimentação ou rotina configurada.

**Acceptance Scenarios**:

1. **Given** uma unidade prisional cadastrada, **When** a chefia cadastra uma nova galeria e uma nova cela vinculada a ela, **Then** a cela passa a existir no mapa da unidade com sua capacidade e tipo definidos.
2. **Given** uma cela cadastrada, **When** a chefia cadastra um preso e o associa a essa cela, **Then** o preso aparece na listagem de presos da cela/galeria com status "ativo".
3. **Given** um preso cadastrado, **When** um policial penal consulta a lista de presos por cela/galeria, **Then** o sistema exibe o preso com seus dados básicos e status atual.
4. **Given** um policial penal autenticado, **When** ele tenta cadastrar ou alterar um preso, uma cela ou uma unidade, **Then** o sistema nega a operação por falta de permissão.

---

### User Story 2 - Registro de Movimentações Temporárias e Status em Tempo Real (Priority: P2)

Policiais penais registram a saída e o retorno de presos em relação à sua cela/galeria (pátio, corre, faxina, atendimento médico interno/externo, visita, etc.), substituindo o controle em papel. O sistema mantém e exibe o status atual de cada preso (na cela, em rotina, em atendimento, em visita) em tempo real, filtrável por unidade, galeria e cela.

**Why this priority**: É o principal objetivo declarado do sistema — aumentar segurança e rastreabilidade das movimentações no dia a dia — e a funcionalidade de maior frequência de uso pelos policiais penais em plantão.

**Independent Test**: Pode ser testado de forma independente registrando a saída de um preso já cadastrado (motivo, local de destino, horário) e, em seguida, registrando seu retorno, verificando que o status do preso reflete corretamente "fora da cela" e depois "na cela" em cada etapa.

**Acceptance Scenarios**:

1. **Given** um preso ativo em sua cela, **When** um policial penal registra uma movimentação temporária de saída com motivo e local de destino, **Then** o status do preso muda para "fora da cela" e a movimentação fica visível na lista de movimentações em aberto.
2. **Given** um preso com movimentação temporária em aberto, **When** o policial penal registra o retorno, **Then** o sistema grava a data/hora de retorno e o status do preso volta para "na cela".
3. **Given** múltiplos presos em diferentes celas, **When** um supervisor filtra o mapa de status por unidade, galeria ou cela, **Then** apenas os presos correspondentes ao filtro são exibidos com seu status atual.
4. **Given** uma movimentação temporária em aberto, **When** um usuário tenta registrar uma nova movimentação de saída para o mesmo preso, **Then** o sistema impede a operação e informa que já existe uma movimentação em aberto.

---

### User Story 3 - Situações Definitivas (Priority: P3)

Chefia/Diretor (e, quando aplicável, supervisor) registra situações em que o preso deixa definitivamente a cela/galeria: liberdade, tornozeleira eletrônica, transferência para outra unidade e troca de cela definitiva. Essas situações atualizam o status do preso e alimentam um histórico completo de localização.

**Why this priority**: Tem impacto legal e de auditoria direto (alvarás, escoltas, dispositivos eletrônicos) e é menos frequente que as movimentações temporárias, mas depende dos cadastros (US1) e do conceito de movimentação (US2) já existirem.

**Independent Test**: Pode ser testado de forma independente registrando uma liberdade (com número de alvará e unidade judiciária) para um preso ativo e verificando que seu status muda para "liberdade" e que ele não aparece mais como ocupante da cela.

**Acceptance Scenarios**:

1. **Given** um preso ativo, **When** a chefia registra sua liberdade com número de alvará e unidade judiciária, **Then** o status do preso muda para "liberdade", a cela é liberada e o evento passa a constar no histórico de localização do preso.
2. **Given** um preso ativo, **When** a chefia registra o uso de tornozeleira eletrônica com número do dispositivo e empresa responsável, **Then** o status do preso muda para "tornozeleira" e a cela é liberada.
3. **Given** um preso ativo, **When** a chefia registra uma transferência para outra unidade com data e referência documental, **Then** o status do preso muda para "transferido" e a cela de origem é liberada.
4. **Given** um preso ativo, **When** a chefia registra uma troca de cela definitiva, **Then** o preso passa a constar como ocupante da nova cela e a cela antiga é liberada, mantendo o histórico de ambas.

---

### User Story 4 - Gestão de Rotinas Operacionais (Priority: P4)

Chefia/Diretor cria rotinas (nome, tipo, horários, unidades/galerias onde se aplicam) e define quais são padrão em todos os estabelecimentos e quais são específicas de cada unidade. Supervisores ajustam horários de rotinas existentes e ativam/desativam rotinas em dias específicos (ex: dia de visita).

**Why this priority**: Importante para o planejamento operacional do turno, mas não bloqueia o uso diário de registro de movimentações (US2) nem os cadastros (US1); pode ser entregue depois sem impedir valor imediato das rotinas anteriores.

**Independent Test**: Pode ser testado de forma independente criando uma rotina "Pátio" com um horário fixo para uma galeria e verificando que ela aparece na lista de rotinas programadas para o turno daquela galeria; em seguida, desativando-a para um dia específico e confirmando que não aparece programada nesse dia.

**Acceptance Scenarios**:

1. **Given** uma galeria cadastrada, **When** a chefia cria uma nova rotina com nome, tipo, horário(s) e escopo (unidade/galeria), **Then** a rotina passa a ser exibida na lista de rotinas programadas para essa galeria.
2. **Given** uma rotina existente não bloqueada, **When** um supervisor altera seu horário, **Then** as próximas execuções programadas passam a refletir o novo horário.
3. **Given** uma rotina ativa do tipo "dia de visita", **When** um supervisor a desativa para uma data específica, **Then** a rotina não aparece na programação do turno naquela data, mas volta a aparecer normalmente nos demais dias.
4. **Given** um supervisor autenticado, **When** ele tenta criar uma nova rotina ou alterar a estrutura de permissões, **Then** o sistema nega a operação por falta de permissão.

---

### User Story 5 - Controle de Efetivo (Priority: P5)

Supervisor cadastra e controla a escala de serviço dos policiais penais (turnos, datas, setores), registra presença/faltas/abonos/horas extras, e visualiza relatórios de efetivo mínimo por turno e setor.

**Why this priority**: Suporta o planejamento de pessoal, mas é operacionalmente independente do fluxo de movimentações/rotinas de presos e pode ser entregue em uma fase posterior sem bloquear o valor central de segurança e rastreabilidade.

**Independent Test**: Pode ser testado de forma independente criando uma escala para um policial penal em um turno e setor específicos e verificando que ele aparece corretamente no relatório de efetivo daquele turno.

**Acceptance Scenarios**:

1. **Given** um policial penal cadastrado, **When** um supervisor cria uma escala para ele em um turno, data e setor, **Then** a escala aparece no relatório de efetivo daquele turno/setor.
2. **Given** uma escala existente, **When** o supervisor registra uma falta ou abono para o policial naquele turno, **Then** o relatório de efetivo reflete a ausência e o motivo.
3. **Given** várias escalas cadastradas para um turno, **When** a chefia consulta o relatório de efetivo mínimo, **Then** o sistema indica se o setor está abaixo do efetivo mínimo esperado.

---

### User Story 6 - Relatórios e Auditoria (Priority: P6)

Supervisor e chefia/diretor consultam relatórios operacionais (movimentações por preso, presos com maior tempo fora da cela, inconsistências, execução de rotinas, efetivo versus movimentações, histórico de ocupação de celas/galerias) e trilhas de auditoria de todas as operações relevantes do sistema.

**Why this priority**: Consolida e expõe dados já gerados pelas demais funcionalidades (US1–US5); tem grande valor de gestão e conformidade, mas depende que essas funcionalidades já estejam operando e gerando dados.

**Independent Test**: Pode ser testado de forma independente gerando movimentações e alterações de cadastro de teste e verificando que elas aparecem corretamente nos relatórios correspondentes e na trilha de auditoria, com autor, data/hora, ação e valores antigos/novos.

**Acceptance Scenarios**:

1. **Given** movimentações registradas para um preso, **When** um supervisor consulta o relatório de movimentações por preso nos últimos X dias, **Then** o sistema lista todas as movimentações no período com seus detalhes.
2. **Given** uma movimentação temporária sem retorno registrado após o horário esperado, **When** a chefia consulta o relatório de inconsistências, **Then** essa movimentação aparece listada como pendência.
3. **Given** qualquer operação de criação, alteração ou remoção de dado relevante no sistema, **When** um usuário com permissão consulta a auditoria, **Then** o registro exibe usuário responsável, data/hora, ação, entidade afetada, valores antigos e novos.
4. **Given** um policial penal autenticado, **When** ele tenta acessar relatórios de efetivo ou auditoria completa do sistema, **Then** o sistema nega o acesso por falta de permissão.

---

### Edge Cases

- O que acontece quando um usuário tenta registrar o retorno de uma movimentação que já foi finalizada (retorno duplicado)?
- Como o sistema trata presos com movimentação temporária em aberto por tempo muito superior ao esperado (sem retorno registrado)?
- O que acontece quando uma cela já está na sua capacidade máxima e uma nova movimentação/troca de cela definitiva tenta alocar mais um preso nela?
- Como o sistema lida com duas rotinas com horários sobrepostos configuradas para a mesma galeria?
- O que acontece se dois usuários tentam registrar simultaneamente uma movimentação de saída para o mesmo preso (condição de corrida)?
- O que acontece quando um supervisor tenta desativar uma rotina marcada como padrão/bloqueada pela chefia?
- Como o sistema exibe o status de um preso que teve uma situação definitiva (liberdade, transferência) registrada por engano — existe fluxo de correção ou apenas nova movimentação corretiva com trilha de auditoria?

## Requirements *(mandatory)*

### Functional Requirements

**Perfis e Permissões**

- **FR-001**: O sistema MUST suportar três perfis de usuário — Policial Penal, Supervisor e Chefia/Diretor — cada um com um conjunto de permissões distinto conforme descrito nas User Stories 1–6.
- **FR-002**: O sistema MUST impedir que Policiais Penais criem, alterem ou excluam rotinas, horários de rotina ou escalas de efetivo.
- **FR-003**: O sistema MUST impedir que Supervisores criem novos tipos de rotina ou alterem a estrutura de permissões dos perfis.
- **FR-004**: Somente o perfil Chefia/Diretor MUST poder criar novas rotinas, definir rotinas padrão versus específicas de unidade, e alterar quaisquer configurações de rotinas e escalas.
- **FR-004a**: O acesso de um usuário Chefia/Diretor a presos, rotinas, escalas, relatórios e auditoria MUST ser restrito à(s) unidade(s) prisional(is) a que esse usuário está formalmente vinculado; usuários de uma unidade não podem visualizar ou alterar dados de outra unidade a menos que estejam vinculados a ela também.

**Cadastro e Mapa da Unidade**

- **FR-005**: O sistema MUST permitir o cadastro de unidades prisionais, galerias (vinculadas a uma unidade) e celas (vinculadas a uma galeria), com capacidade e tipo (ex.: masculino/feminino, coletiva/individual).
- **FR-006**: O sistema MUST permitir o cadastro de presos com identificação, foto, dados pessoais básicos, regime, unidade, galeria, cela atual e status (ativo, liberdade, tornozeleira, transferido, entre outros).
- **FR-007**: O sistema MUST permitir consultar a lista de presos por cela/galeria/unidade e seu status atual.

**Movimentações**

- **FR-008**: O sistema MUST permitir registrar movimentações temporárias de um preso contendo preso, categoria, motivo/descrição, local de destino, data/hora de saída, usuário responsável e observações.
- **FR-009**: O sistema MUST permitir registrar o retorno de uma movimentação temporária, gravando a data/hora de retorno.
- **FR-010**: O sistema MUST impedir a criação de uma nova movimentação de saída para um preso que já possua uma movimentação temporária em aberto.
- **FR-011**: O sistema MUST exibir em tempo real o status atual de cada preso (na cela, em rotina, em atendimento, em visita, em situação definitiva), com filtragem por unidade, galeria e cela.
- **FR-011a**: O aplicativo móvel usado pelos Policiais Penais MUST permitir registrar movimentações mesmo sem conexão de rede disponível no momento, mantendo-as em uma fila local e sincronizando-as automaticamente com o servidor assim que a conectividade for restabelecida, sem perda de dados nem duplicação.

**Situações Definitivas**

- **FR-012**: O sistema MUST permitir registrar liberdade de um preso com data, número de alvará, unidade judiciária e agente responsável.
- **FR-013**: O sistema MUST permitir registrar uso de tornozeleira eletrônica com data de início, número do dispositivo, empresa responsável e restrições.
- **FR-014**: O sistema MUST permitir registrar transferência de um preso para outra unidade com data, escolta e referência documental.
- **FR-015**: O sistema MUST permitir registrar troca de cela definitiva com cela antiga, cela nova, data/hora e motivo.
- **FR-016**: Ao registrar qualquer situação definitiva, o sistema MUST atualizar o status do preso, liberar a cela de origem (quando aplicável) e manter um histórico completo de localização do preso (linha do tempo de celas, unidades e regimes).

**Rotinas**

- **FR-017**: O sistema MUST permitir cadastrar rotinas com nome, tipo (diária, por dia da semana, dia de visita, finais de semana, feriados), um ou mais horários por dia, escopo (unidades/galerias/celas atingidas) e status (ativa/inativa).
- **FR-018**: O sistema MUST permitir que a Chefia/Diretor defina rotinas como padrão (aplicáveis a todos os estabelecimentos) ou específicas de uma unidade.
- **FR-019**: O sistema MUST permitir que Supervisores ajustem horários e ativem/desativem rotinas existentes para dias específicos, sem permitir a criação de novos tipos de rotina.
- **FR-020**: O sistema MUST exibir as rotinas programadas para o turno atual, filtráveis por unidade/galeria.

**Controle de Efetivo**

- **FR-021**: O sistema MUST permitir o cadastro de policiais penais com identificação, matrícula, cargo e unidade.
- **FR-022**: O sistema MUST permitir criar escalas de serviço associando policial, turno (manhã, tarde, noite), data e setor.
- **FR-023**: O sistema MUST permitir registrar presença, faltas, abonos e horas extras associados a uma escala.
- **FR-024**: O sistema MUST gerar relatórios de efetivo mínimo por turno e setor, indicando quando o efetivo está abaixo do mínimo esperado.

**Relatórios e Auditoria**

- **FR-025**: O sistema MUST gerar relatórios de: movimentações por preso em um período; presos com maior tempo fora da cela; inconsistências (movimentações sem retorno, presos fora da cela sem motivo, rotinas não executadas); execução de rotinas por turno/unidade; efetivo por turno versus movimentações realizadas; e histórico de ocupação de celas e galerias.
- **FR-026**: O sistema MUST registrar um log de auditoria para toda operação que criar, alterar ou remover dados relevantes, contendo usuário responsável, data/hora, ação executada, entidade afetada, valores anteriores (quando aplicável) e novos valores, conforme os princípios de Auditabilidade da Constituição do projeto.
- **FR-027**: Os registros de auditoria MUST ser imutáveis após criados — nenhum perfil de usuário pode alterá-los ou excluí-los.
- **FR-028**: O acesso a relatórios de efetivo e à auditoria completa do sistema MUST ser restrito aos perfis Supervisor e Chefia/Diretor, conforme aplicável a cada relatório.

**Retenção e privacidade**

- **FR-029**: O sistema MUST reter indefinidamente os dados cadastrais, de movimentação, de situações definitivas e de auditoria de presos — nenhum expurgo ou anonimização automática ocorre, refletindo a natureza de registro histórico exigida por um sistema prisional.

### Key Entities *(include if feature involves data)*

- **Usuário**: pessoa com acesso ao sistema (policial penal, supervisor, chefia/diretor); possui perfil, matrícula, unidade e status ativo/inativo.
- **Perfil**: papel de acesso (Policial Penal, Supervisor, Chefia/Diretor) que determina as permissões do usuário.
- **Unidade Prisional**: estabelecimento prisional; contém galerias.
- **Galeria**: subdivisão de uma unidade (ex.: Galeria A, Triagem); contém celas.
- **Cela**: espaço físico dentro de uma galeria, com capacidade e tipo; contém presos.
- **Preso**: pessoa custodiada; possui dados pessoais, regime, cela atual e status (ativo, liberdade, tornozeleira, transferido).
- **Histórico de Cela**: registro histórico de qual cela um preso ocupou em cada período, usado para reconstruir a linha do tempo de localização.
- **Movimentação**: registro de deslocamento (temporário ou definitivo) de um preso, com origem, destino, motivo, horários de saída/retorno e usuário responsável.
- **Tipo de Movimentação**: categoria de movimentação (pátio, corre, faxina, atendimento médico interno/externo, visita, transferência, liberdade, tornozeleira, troca de cela) e se é temporária ou definitiva.
- **Rotina**: atividade programada (nome, tipo, horários, escopo, status) aplicada a uma ou mais galerias/unidades.
- **Horário de Rotina**: um horário específico associado a uma rotina, podendo variar por dia da semana.
- **Escala de Efetivo**: alocação de um policial penal a um turno, data e setor, incluindo presença/faltas/abonos/horas extras.
- **Log de Auditoria**: registro imutável de uma operação de criação/alteração/remoção, com autor, data/hora, entidade afetada e valores antigos/novos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um policial penal consegue registrar a saída ou o retorno de um preso em até 30 segundos a partir da tela de consulta de presos por cela/galeria.
- **SC-002**: 100% das operações de criação, alteração ou remoção de dados relevantes (presos, movimentações, rotinas, escalas) geram um registro de auditoria correspondente.
- **SC-003**: Um supervisor consegue localizar o status atual de qualquer preso da unidade em até 5 segundos após aplicar um filtro por unidade, galeria ou cela.
- **SC-004**: O sistema permanece responsivo (sem degradação perceptível) com pelo menos 200 usuários realizando consultas e registros simultaneamente durante a troca de turno.
- **SC-005**: 95% das movimentações temporárias sem retorno registrado além do prazo esperado são identificadas automaticamente pelo relatório de inconsistências, sem necessidade de conferência manual em papel.
- **SC-006**: O tempo médio para reconstruir o histórico completo de localização de um preso (celas, unidades, regimes) cai de um processo manual em papel para menos de 1 minuto de consulta no sistema.

## Assumptions

- Cada preso está associado a exatamente uma cela ativa por vez; movimentações temporárias não alteram a cela de origem registrada, apenas o status "fora da cela".
- O turno de trabalho é organizado em três períodos padrão (manhã, tarde, noite), conforme prática comum em unidades prisionais; períodos adicionais poderão ser configurados futuramente se necessário.
- Uma rotina "bloqueada"/padrão definida pela Chefia/Diretor não pode ser excluída ou ter seu tipo alterado por Supervisores, apenas ativada/desativada por dia ou ter horários ajustados dentro do permitido.
- O acesso ao sistema (web para Supervisor/Chefia e mobile para Policial Penal) requer autenticação prévia; o mecanismo específico de autenticação é detalhe de implementação a ser definido na fase de planejamento técnico.
- Fotos e documentos anexados a presos e situações definitivas são armazenados de forma segura, mas o mecanismo de armazenamento é detalhe de implementação a ser definido na fase de planejamento técnico.
- Relatórios de efetivo mínimo usam um valor de efetivo mínimo configurável por setor/turno, definido pela Chefia/Diretor; o valor padrão exato não é especificado nesta fase.
