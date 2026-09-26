# Feature Specification: Gestão de Rotinas Penitenciárias (SRP)

**Feature Branch**: `001-gestao-rotinas-presos`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "~\projetos\spr\docs\srp_spec.md" — sistema digital para gestão das rotinas operacionais do sistema prisional do Rio Grande do Sul, substituindo o controle atual baseado em folhas impressas por um registro eletrônico estruturado e auditável, cobrindo cadastro de presos/unidades/celas, movimentações, situações definitivas, rotinas, controle de efetivo e relatórios/auditoria.

## Clarifications

### Session 2026-09-25

- Q: Como o relatório de inconsistências identifica "rotinas não executadas", se o sistema não registra a execução de uma rotina? → A: Rotina programada que o Supervisor desativou para a data conta como não executada; sem desativação, conta como executada. Nenhum registro manual de execução é criado.
- Q: O que o sistema faz quando duas rotinas da mesma galeria têm horários sobrepostos? → A: Avisa ("sobrepõe a rotina X") e quem está salvando decide se confirma; não impede o cadastro. Sobreposição = mesmo horário de início, na mesma galeria, em dia em comum (a rotina não tem duração).
- Q: Os turnos de trabalho são diurno e noturno ou manhã, tarde e noite? (a seção Assumptions dizia três períodos e o FR-022 dizia dois) → A: Somente diurno e noturno.
- Q: Quando o app móvel é deslogado porque o servidor encerrou a sessão (ex.: usuário desativado), o que acontece com as movimentações pendentes na fila offline? → A: Permanecem na fila do aparelho; nada é apagado. Voltam a ser enviadas se o mesmo usuário entrar de novo.
- Q: Como a Chefia encontra o preso para reverter uma situação definitiva, se a lista por cela não escala com anos de dados? → A: Tela própria "Situações definitivas", paginada no servidor, com filtro de período pela data de registro (padrão 6 meses; opções 1 ano, 5 anos e todos), busca por parte do nome e pela matrícula. Sem prazo máximo para reverter.
- Q: Como corrigir uma liberdade, tornozeleira ou transferência registrada por engano? → A: Reversão feita somente pela Chefia/Diretor: o preso volta a "ativo" numa cela com vaga escolhida na hora, com motivo obrigatório; o registro errado permanece no histórico e a reversão é uma nova movimentação, auditada.

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
5. **Given** a Chefia/Diretor autenticada, **When** ela cadastra um novo usuário (policial penal ou supervisor) informando perfil e unidade(s) vinculada(s), **Then** o novo usuário passa a existir e consegue se autenticar de acordo com as permissões do perfil atribuído.
6. **Given** um Supervisor ou Policial Penal autenticado, **When** ele tenta cadastrar, alterar ou desativar um usuário, **Then** o sistema nega a operação por falta de permissão.

---

### User Story 2 - Registro de Movimentações Temporárias e Status em Tempo Real (Priority: P2)

Policiais penais registram a saída e o retorno individual de presos em relação à sua cela/galeria (atendimento médico interno/externo, visita, etc.), substituindo o controle em papel. Atividades coletivas aplicadas à galeria inteira (pátio, corre, faxina) não geram registro de movimentação por preso — são Rotinas (User Story 4). O sistema mantém e exibe o status atual de cada preso (na cela, em rotina, em atendimento, em visita) em tempo real, filtrável por unidade, galeria e cela.

**Why this priority**: É o principal objetivo declarado do sistema — aumentar segurança e rastreabilidade das movimentações no dia a dia — e a funcionalidade de maior frequência de uso pelos policiais penais em plantão.

**Independent Test**: Pode ser testado de forma independente registrando a saída de um preso já cadastrado (motivo, local de destino, horário) e, em seguida, registrando seu retorno, verificando que o status do preso reflete corretamente "fora da cela" e depois "na cela" em cada etapa.

**Acceptance Scenarios**:

1. **Given** um preso ativo em sua cela, **When** um policial penal registra uma movimentação temporária de saída com motivo e local de destino, **Then** o status do preso muda para "fora da cela" e a movimentação fica visível na lista de movimentações em aberto.
2. **Given** um preso com movimentação temporária em aberto, **When** o policial penal registra o retorno, **Then** o sistema grava a data/hora de retorno e o status do preso volta para "na cela".
3. **Given** múltiplos presos em diferentes celas, **When** um supervisor filtra o mapa de status por unidade, galeria ou cela, **Then** apenas os presos correspondentes ao filtro são exibidos com seu status atual.
4. **Given** uma movimentação temporária em aberto, **When** um usuário tenta registrar uma nova movimentação de saída para o mesmo preso, **Then** o sistema impede a operação e informa que já existe uma movimentação em aberto.

---

### User Story 3 - Situações Definitivas (Priority: P3)

Chefia/Diretor registra situações em que o preso deixa definitivamente a unidade ou o regime fechado: liberdade, tornozeleira eletrônica e transferência para outra unidade. Além disso, qualquer perfil autenticado (Policial Penal, Supervisor ou Chefia/Diretor) pode registrar a troca ou permuta de cela de um preso — movendo-o para outra cela (na mesma galeria ou em outra galeria) ou trocando-o simultaneamente com outro preso — sendo a variação entre galerias restrita a Supervisor e Chefia/Diretor. Essas situações atualizam o status ou a cela atual do preso e alimentam um histórico completo de localização.

**Why this priority**: Liberdade/tornozeleira/transferência têm impacto legal e de auditoria direto e são menos frequentes que as movimentações temporárias; troca/permuta de cela é mais frequente (inclusive usada em campo pelo Policial Penal) mas ambas dependem dos cadastros (US1) e do conceito de movimentação (US2) já existirem.

**Independent Test**: Pode ser testado de forma independente registrando uma liberdade (com o motivo preenchido) para um preso ativo e verificando que seu status muda para "liberdade" e que ele não aparece mais como ocupante da cela.

**Acceptance Scenarios**:

1. **Given** um preso ativo, **When** a chefia registra sua liberdade com o motivo (ex.: alvará, unidade judiciária, agente responsável, tudo como texto livre), **Then** o status do preso muda para "liberdade", a cela é liberada e o evento passa a constar no histórico de localização do preso.
2. **Given** um preso ativo, **When** a chefia registra o uso de tornozeleira eletrônica com o motivo preenchido, **Then** o status do preso muda para "tornozeleira" e a cela é liberada.
3. **Given** um preso ativo, **When** a chefia registra uma transferência para outra unidade com o motivo preenchido, **Then** o status do preso muda para "transferido" e a cela de origem é liberada.
4. **Given** um preso ativo numa cela com vaga disponível em outra cela da mesma galeria, **When** qualquer perfil (Policial Penal, Supervisor ou Chefia/Diretor) registra uma troca de cela, **Then** o preso passa a constar como ocupante da nova cela, a cela antiga é liberada, o status permanece "ativo" e o histórico de ambas as celas é mantido.
5. **Given** dois presos ativos em celas diferentes da mesma galeria, **When** qualquer perfil registra uma permuta de cela escolhendo a cela do segundo preso como destino, **Then** o sistema exibe o preso que ocupa essa cela para confirmação e, ao confirmar, os dois presos trocam de cela simultaneamente, sem que nenhuma vaga seja exigida, e ambos os status permanecem "ativo".
6. **Given** um preso ativo numa unidade com vaga disponível em outra galeria da mesma unidade, **When** um Supervisor ou a Chefia/Diretor registra uma troca de galeria, **Then** o preso passa a constar como ocupante da nova galeria/cela e a cela antiga é liberada.
7. **Given** dois presos ativos em galerias diferentes, **When** um Supervisor ou a Chefia/Diretor registra uma permuta de galeria escolhendo a cela do segundo preso como destino, **Then** o sistema exibe o preso que ocupa essa cela para confirmação e, ao confirmar, os dois presos trocam de galeria/cela simultaneamente, sem que nenhuma vaga seja exigida.
8. **Given** um Policial Penal autenticado, **When** ele tenta registrar uma troca de galeria, uma permuta de galeria, ou qualquer uma de liberdade/tornozeleira/transferência, **Then** o sistema nega a operação por falta de permissão — apenas troca e permuta de cela (mesma galeria) estão disponíveis para ele, tanto no aplicativo móvel quanto no painel web.
9. **Given** um preso com liberdade, tornozeleira ou transferência registrada por engano, **When** a Chefia/Diretor registra a reversão informando o motivo e uma cela com vaga, **Then** o status do preso volta para "ativo", ele passa a ocupar a cela escolhida, o registro original permanece no histórico e a reversão consta como nova movimentação; um Supervisor ou Policial Penal que tente a reversão é negado por falta de permissão.
10. **Given** a Chefia/Diretor na tela "Situações definitivas", **When** ela abre a tela, **Then** vê as situações definitivas dos últimos 6 meses paginadas, da mais recente para a mais antiga; **And When** amplia o período (1 ano, 5 anos ou todos) ou filtra por parte do nome ou pela matrícula, **Then** a lista mostra só os presos correspondentes; **And When** reverte um deles, **Then** ele sai da lista e volta a constar como ativo. Um Supervisor ou Policial Penal não tem acesso a essa tela.

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

Supervisor cadastra e controla a escala de serviço dos policiais penais (turnos, datas, postos de serviço, carga horária), registra presença/faltas, e visualiza relatórios de efetivo mínimo por turno e posto.

**Why this priority**: Suporta o planejamento de pessoal, mas é operacionalmente independente do fluxo de movimentações/rotinas de presos e pode ser entregue em uma fase posterior sem bloquear o valor central de segurança e rastreabilidade.

**Independent Test**: Pode ser testado de forma independente criando uma escala para um policial penal em um turno e posto específicos e verificando que ele aparece corretamente no relatório de efetivo daquele turno.

**Acceptance Scenarios**:

1. **Given** um policial penal cadastrado, **When** um supervisor cria uma escala para ele em um turno, data, posto e carga horária, **Then** a escala aparece no relatório de efetivo daquele turno/posto.
2. **Given** uma escala existente, **When** o supervisor registra uma falta para o policial naquele turno, **Then** o relatório de efetivo reflete a ausência e o motivo.
3. **Given** várias escalas cadastradas para um turno, **When** a chefia consulta o relatório de efetivo mínimo, **Then** o sistema indica se o posto está abaixo do efetivo mínimo esperado.

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
- O que acontece quando uma cela já está na sua capacidade máxima e uma nova movimentação, troca de cela ou troca de galeria tenta alocar mais um preso nela? (Não se aplica a permuta de cela/galeria — a troca é simultânea entre duas celas já ocupadas, nunca exige vaga.)
- O que acontece se, entre a escolha da cela de destino e a confirmação de uma permuta (de cela ou de galeria), o preso que ocupava aquela cela deixar de ocupá-la (outra movimentação/situação registrada nesse intervalo)?
- Como o sistema lida com duas rotinas com horários sobrepostos configuradas para a mesma galeria? → Ao salvar, o sistema MUST avisar qual rotina se sobrepõe; quem está salvando (Chefia/Diretor ao criar, ou Supervisor ao ajustar horários) confirma para salvar mesmo assim. O cadastro não é bloqueado. Como a rotina só tem horário de início (sem duração), o aviso cobre apenas o **mesmo horário de início**: outra rotina ativa da mesma galeria com o mesmo horário em um dia em comum. Cruzamento de intervalos (ex.: 14:00 e 14:30 com duração de 1 hora) não é detectado; exigiria um horário de término na rotina, decisão adiada.
- O que acontece se dois usuários tentam registrar simultaneamente uma movimentação de saída para o mesmo preso (condição de corrida)?
- O que acontece quando um supervisor tenta desativar uma rotina marcada como padrão/bloqueada pela chefia?
- Como o sistema exibe o status de um preso que teve uma situação definitiva (liberdade, transferência) registrada por engano? → A Chefia/Diretor registra uma reversão (FR-016a); o registro original não é apagado nem alterado.

## Requirements *(mandatory)*

### Functional Requirements

**Perfis e Permissões**

- **FR-001**: O sistema MUST suportar três perfis de usuário — Policial Penal, Supervisor e Chefia/Diretor — cada um com um conjunto de permissões distinto conforme descrito nas User Stories 1–6.
- **FR-002**: O sistema MUST impedir que Policiais Penais criem, alterem ou excluam rotinas, horários de rotina ou escalas de efetivo.
- **FR-003**: O sistema MUST impedir que Supervisores criem novos tipos de rotina ou alterem a estrutura de permissões dos perfis.
- **FR-004**: Somente o perfil Chefia/Diretor MUST poder criar novas rotinas e alterar quaisquer configurações de rotinas e escalas (ver FR-017–FR-020 para o detalhamento de rotinas padrão versus específicas de unidade).
- **FR-004a**: O acesso de um usuário Chefia/Diretor a presos, rotinas, escalas, relatórios e auditoria MUST ser restrito à(s) unidade(s) prisional(is) a que esse usuário está formalmente vinculado; usuários de uma unidade não podem visualizar ou alterar dados de outra unidade a menos que estejam vinculados a ela também.

**Gestão de Usuários**

- **FR-030**: Somente o perfil Chefia/Diretor MUST poder cadastrar novos usuários (policiais penais, supervisores ou outra chefia/diretor), definindo nome, e-mail, matrícula, perfil e a(s) unidade(s) vinculada(s) (FR-004a).
- **FR-031**: Somente o perfil Chefia/Diretor MUST poder desativar um usuário existente; um usuário desativado MUST perder a capacidade de se autenticar imediatamente, sem excluir seu histórico de ações já registrado em auditoria.
- **FR-032**: O sistema MUST impedir que Policiais Penais e Supervisores criem, alterem ou desativem usuários.

**Cadastro e Mapa da Unidade**

- **FR-005**: O sistema MUST permitir o cadastro de unidades prisionais, galerias (vinculadas a uma unidade) e celas (vinculadas a uma galeria), com capacidade e tipo (ex.: masculino/feminino, coletiva/individual).
- **FR-006**: O sistema MUST permitir o cadastro de presos com identificação, foto, dados pessoais básicos, regime, unidade, galeria, cela atual e status (ativo, liberdade, tornozeleira, transferido, entre outros).
- **FR-007**: O sistema MUST permitir consultar a lista de presos por cela/galeria/unidade e seu status atual.

**Movimentações**

- **FR-008**: O sistema MUST permitir registrar movimentações temporárias de um preso contendo preso, categoria, motivo, local de destino, data/hora de saída, usuário responsável e observações.
- **FR-008a**: Toda movimentação, de qualquer tipo (temporária, liberdade, tornozeleira, transferência, troca de cela, permuta de cela, troca de galeria ou permuta de galeria) MUST exigir um motivo preenchido pelo usuário (texto livre); observações adicionais MUST ser sempre opcionais. Nenhum tipo MUST exigir campos estruturados além desses dois — informação específica de um tipo (ex.: número de alvará, agente responsável, dispositivo, empresa, escolta, referência documental) MUST ser registrada como texto livre dentro do motivo ou das observações, não em campos próprios.
- **FR-009**: O sistema MUST permitir registrar o retorno de uma movimentação temporária, gravando a data/hora de retorno.
- **FR-010**: O sistema MUST impedir a criação de uma nova movimentação de saída para um preso que já possua uma movimentação temporária em aberto.
- **FR-011**: O sistema MUST exibir em tempo real o status atual de cada preso (na cela, em rotina, em atendimento, em visita, em situação definitiva), com filtragem por unidade, galeria e cela.
- **FR-011a**: O aplicativo móvel usado pelos Policiais Penais MUST permitir registrar movimentações mesmo sem conexão de rede disponível no momento, mantendo-as em uma fila local e sincronizando-as automaticamente com o servidor assim que a conectividade for restabelecida, sem perda de dados nem duplicação. Se houver mais de uma pendência ainda não sincronizada para o mesmo preso (saída) ou para a mesma movimentação (retorno), somente a mais recente é mantida na fila. Uma pendência que o servidor recusar não impede a sincronização das demais (research.md #52). Se o servidor encerrar a sessão do usuário (ex.: usuário desativado), o app MUST voltar à tela de login e as pendências MUST permanecer na fila do aparelho, sem serem apagadas.

**Situações Definitivas**

- **FR-012**: O sistema MUST permitir registrar liberdade de um preso com data e motivo (FR-008a) — restrito ao perfil Chefia/Diretor.
- **FR-013**: O sistema MUST permitir registrar uso de tornozeleira eletrônica com data e motivo (FR-008a) — restrito ao perfil Chefia/Diretor.
- **FR-014**: O sistema MUST permitir registrar transferência de um preso para outra unidade com data e motivo (FR-008a) — restrito ao perfil Chefia/Diretor.
- **FR-015**: O sistema MUST permitir registrar troca de cela de um preso: ele sai de sua cela atual e passa a ocupar outra cela **com vaga disponível na mesma galeria**. Disponível para qualquer perfil (Policial Penal, Supervisor, Chefia/Diretor), tanto no aplicativo móvel quanto no painel web.
- **FR-015a**: O sistema MUST permitir registrar permuta de cela entre dois presos da mesma galeria: o usuário escolhe a cela de destino, o sistema exibe o preso que a ocupa atualmente para confirmação e, ao confirmar, os dois presos trocam de cela simultaneamente — nenhuma vaga é exigida, pois a troca é direta. Disponível para qualquer perfil, tanto no aplicativo móvel quanto no painel web.
- **FR-015b**: O sistema MUST permitir registrar troca de galeria de um preso: ele sai de sua cela atual e passa a ocupar uma cela **com vaga disponível em outra galeria**. Restrito aos perfis Supervisor e Chefia/Diretor, disponível apenas no painel web.
- **FR-015c**: O sistema MUST permitir registrar permuta de galeria entre dois presos de galerias diferentes, com a mesma mecânica de confirmação da FR-015a (escolher destino, confirmar com o preso exibido) — nenhuma vaga é exigida. Restrito aos perfis Supervisor e Chefia/Diretor, disponível apenas no painel web.
- **FR-016**: Ao registrar liberdade, tornozeleira ou transferência, o sistema MUST atualizar o status do preso e liberar a cela de origem. Ao registrar troca ou permuta de cela/galeria (FR-015–FR-015c), o sistema MUST manter o status do preso como "ativo" e apenas atualizar sua cela atual, liberando a cela de origem. Em qualquer um desses casos, o sistema MUST manter um histórico completo de localização do preso (linha do tempo de celas, unidades e regimes).
- **FR-016a**: O sistema MUST permitir que a Chefia/Diretor (e somente ela) reverta uma liberdade, tornozeleira ou transferência registrada por engano, tanto no painel web quanto pela API. A reversão MUST exigir motivo (FR-008a) e a escolha de uma cela com vaga disponível no momento da reversão, devolver o status do preso para "ativo" e registrar uma nova movimentação, mantendo a movimentação original intacta no histórico de localização e na auditoria (FR-026/FR-027). Para localizar o preso, o painel web MUST oferecer uma tela "Situações definitivas", somente para a Chefia/Diretor e restrita às unidades do usuário (FR-004a), que lista de forma paginada no servidor a situação definitiva vigente de cada preso (liberdade, tornozeleira ou transferência ainda não revertida), da mais recente para a mais antiga, com data de registro, responsável e motivo. A lista MUST poder ser filtrada pelo período da data de registro (padrão: últimos 6 meses; opções: 1 ano, 5 anos e todos), por parte do nome do preso e pela matrícula, e MUST permitir reverter direto da linha. Não há prazo máximo para reverter: o filtro de período só limita o que aparece na tela.

**Rotinas**

- **FR-017**: O sistema MUST permitir cadastrar rotinas com nome, tipo (diária, por dia da semana, dia de visita, finais de semana, feriados), um ou mais horários por dia, escopo (unidades/galerias/celas atingidas) e status (ativa/inativa).
- **FR-018**: O sistema MUST permitir que a Chefia/Diretor defina rotinas como padrão (aplicáveis a todos os estabelecimentos) ou específicas de uma unidade.
- **FR-019**: O sistema MUST permitir que Supervisores ajustem horários e ativem/desativem rotinas existentes para dias específicos, sem permitir a criação de novos tipos de rotina.
- **FR-020**: O sistema MUST exibir as rotinas programadas para o turno atual, filtráveis por unidade/galeria.

**Controle de Efetivo**

- **FR-021**: O sistema MUST permitir o cadastro de policiais penais com identificação, matrícula, cargo e unidade.
- **FR-022**: O sistema MUST permitir criar escalas de serviço associando policial, turno (diurno ou noturno), data, posto de serviço e carga horária do dia. O cadastro MUST registrar o dia do policial de uma só vez (carga horária e um posto por turno, pelo menos um turno), sem deixar escalas pela metade se algum dado for inválido.
- **FR-022a**: O sistema MUST manter o cadastro de postos de serviço por unidade (uma galeria, um posto que cobre mais de uma galeria como "A/B", pórtico, garita, Infopen etc.). Somente a Chefia/Diretor MUST poder criar, alterar e desativar postos; o Supervisor apenas escala policiais nos postos existentes. Um posto desativado não recebe novas escalas, mas preserva as já cadastradas.
- **FR-022b**: A carga horária (1 a 24 horas) MUST ser informada obrigatoriamente ao criar a escala e vale para o **dia** do policial, não para o turno: todas as escalas dele na mesma data têm a mesma carga horária, embora o posto possa mudar de um turno para o outro (ex.: plantão de 24 h, diurno e noturno).
- **FR-023**: O sistema MUST permitir registrar presença e faltas do policial no dia, valendo para todas as escalas dele na data. A falta MUST descontar do efetivo do posto (não há ninguém no posto) no relatório de efetivo mínimo.
- **FR-024**: O sistema MUST gerar relatórios de efetivo mínimo por turno e posto, indicando quando o efetivo está abaixo do mínimo esperado.

**Relatórios e Auditoria**

- **FR-025**: O sistema MUST gerar relatórios de: movimentações por preso em um período; presos com maior tempo fora da cela; inconsistências (movimentações sem retorno, presos fora da cela sem motivo, rotinas não executadas — rotina programada que o Supervisor desativou para a data; sem desativação considera-se executada, pois não há registro de execução); execução de rotinas por turno/unidade; efetivo por turno versus movimentações realizadas; e histórico de ocupação de celas e galerias.
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
- **Movimentação**: registro **individual** de deslocamento (temporário ou definitivo) de **um** preso específico, com origem, destino, motivo, observações, horários de saída/retorno e usuário responsável. Só existe Movimentação quando a atividade tira aquele preso especificamente de sua cela/galeria em um horário próprio dele (ex.: atendimento médico, visita, transferência, liberdade, troca/permuta de cela ou galeria) — nunca para uma atividade coletiva aplicada à galeria inteira de uma vez (ver Rotina). Uma permuta (de cela ou de galeria) entre dois presos gera **dois** registros de Movimentação vinculados entre si, um por preso, preservando a regra de "um preso por registro".
- **Tipo de Movimentação**: categoria de movimentação individual (atendimento médico interno/externo, visita, liberdade, tornozeleira, transferência, troca de cela, permuta de cela, troca de galeria, permuta de galeria) e se é temporária ou definitiva. Não inclui pátio/corre/faxina — ver Rotina.
- **Rotina**: atividade **coletiva** programada (nome, tipo, horários, escopo, status) aplicada a uma galeria/unidade inteira, sem gerar nenhum registro por preso individual (ex.: horário de pátio, horário de corre, horário de faxina, dias/horários de visita). Diferença-chave para Movimentação: Rotina define **quando a galeria é liberada** para a atividade; Movimentação (quando aplicável, ex.: levar um preso específico até sua visita) registra **o deslocamento daquele preso** dentro desse horário.
- **Horário de Rotina**: um horário específico associado a uma rotina, podendo variar por dia da semana.
- **Escala de Efetivo**: alocação de um policial penal a um turno, data e posto de serviço, com a carga horária do dia, incluindo presença/faltas.
- **Log de Auditoria**: registro imutável de uma operação de criação/alteração/remoção, com autor, data/hora, entidade afetada e valores antigos/novos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um policial penal consegue registrar a saída ou o retorno de um preso em até 30 segundos a partir da tela de consulta de presos por cela/galeria.
- **SC-002**: 100% das operações de criação, alteração ou remoção de dados relevantes (presos, movimentações, rotinas, escalas) geram um registro de auditoria correspondente.
- **SC-003**: Um supervisor consegue localizar o status atual de qualquer preso da unidade em até 5 segundos após aplicar um filtro por unidade, galeria ou cela.
- **SC-004**: Com pelo menos 200 usuários realizando consultas e registros simultaneamente durante a troca de turno, 95% das requisições (p95) MUST responder em menos de 500ms, e nenhuma requisição válida MUST falhar por sobrecarga (sem erros 5xx atribuíveis a carga). *(Valor de referência sugerido — ajustável pela Chefia/Diretor/equipe técnica antes do início da Fase 2 se um SLA diferente for definido.)*
- **SC-005**: 95% das movimentações temporárias sem retorno registrado além do prazo esperado são identificadas automaticamente pelo relatório de inconsistências, sem necessidade de conferência manual em papel.
- **SC-006**: O tempo médio para reconstruir o histórico completo de localização de um preso (celas, unidades, regimes) cai de um processo manual em papel para menos de 1 minuto de consulta no sistema.

## Assumptions

- Cada preso está associado a exatamente uma cela ativa por vez; movimentações temporárias não alteram a cela de origem registrada, apenas o status "fora da cela".
- O turno de trabalho tem apenas dois períodos: diurno e noturno (FR-022). Não existe divisão em manhã, tarde e noite.
- Uma rotina "bloqueada"/padrão definida pela Chefia/Diretor não pode ser excluída ou ter seu tipo alterado por Supervisores, apenas ativada/desativada por dia ou ter horários ajustados dentro do permitido.
- O acesso ao sistema (web para Supervisor/Chefia e mobile para Policial Penal) requer autenticação prévia; o mecanismo específico de autenticação é detalhe de implementação a ser definido na fase de planejamento técnico.
- Fotos e documentos anexados a presos e situações definitivas são armazenados de forma segura, mas o mecanismo de armazenamento é detalhe de implementação a ser definido na fase de planejamento técnico.
- Relatórios de efetivo mínimo usam um valor de efetivo mínimo configurável por posto/turno, definido pela Chefia/Diretor; o valor padrão exato não é especificado nesta fase.
