# Feature Specification: Administração de Usuários e Documentos

**Feature Branch**: `002-administracao-usuarios-documentos`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "Criação/alteração de usuário pelo diretor (criar com lotação, editar, desativar, ativar, transferir, resetar senha com envio por e-mail); biblioteca de Formulários/Modelos de Documentos/Manuais com upload e download, restrita por perfil; troca de senha pelo próprio usuário via modal no perfil, com validação de senha atual e exibição/ocultação de senha no formulário de troca e no login. Nenhuma dessas funcionalidades é acessível pelo aplicativo móvel."

## Clarifications

### Session 2026-09-29

- Q: "Editar" um usuário inclui trocar seu perfil, inclusive para/de Chefia/Diretor? → A: Sim. A troca de perfil (incluindo promover ou rebaixar de/para Chefia/Diretor) faz parte de "editar"; a operação de editar usuário, como um todo, continua exclusiva do perfil Chefia/Diretor.
- Q: Ao "resetar senha", a nova senha enviada por e-mail é definitiva ou temporária? → A: Temporária — o usuário é obrigado a trocá-la no primeiro acesso seguinte ao reset, mesmo padrão já usado na criação de usuário.
- Q: "Transferir" um usuário substitui a lotação atual ou pode também somar uma unidade nova à lotação existente? → A: As duas opções devem existir, como ações distintas e claramente rotuladas: **Trocar lotação** (substitui a lotação atual pela nova) e **Adicionar lotação** (soma uma unidade nova à lotação existente). Por ser a ação menos comum e mais arriscada (usuário passa a ter acesso a mais de uma unidade), "Adicionar lotação" exige uma confirmação explícita antes de efetivar, com um texto que deixe claro que é uma adição e não uma troca.
- Q: A própria Chefia/Diretor pode desativar, rebaixar o próprio perfil ou transferir a própria lotação? → A: Não. Essas ações sobre a própria conta são proibidas; precisam ser feitas por outra Chefia/Diretor.
- Q: O reset de senha pela Chefia/Diretor e a troca de senha pelo próprio usuário devem encerrar as outras sessões já abertas desse usuário? → A: Sim, nos dois casos. No reset pela Chefia/Diretor, todas as sessões do usuário são encerradas (ele precisa entrar de novo com a senha temporária). Na troca pelo próprio usuário, as demais sessões em outros dispositivos/navegadores são encerradas, mantendo válida só a sessão atual usada para trocar a senha.
- Q: Quando duas pessoas tentam enviar um documento com o mesmo nome de exibição na mesma categoria, o que o sistema deve fazer? → A: Bloquear o envio e pedir um nome diferente enquanto já existir um documento ativo com esse nome na mesma categoria.
- Q: Além de bloquear pela extensão do arquivo, o sistema precisa verificar se o conteúdo real do arquivo corresponde a esse formato? → A: Sim. O sistema DEVE verificar a extensão e também o conteúdo real do arquivo (assinatura/tipo), recusando o envio se não corresponderem — evita o golpe de renomear um arquivo malicioso para parecer DOCX/DOC/TXT/PDF.
- Q: Se o envio do e-mail com a senha falhar (criação ou reset), a operação deve ser desfeita ou concluída mesmo assim? → A: Concluída mesmo assim. O sistema avisa a Chefia/Diretor do problema e oferece um botão para reenviar o e-mail, em vez de desfazer o cadastro/reset ou falhar silenciosamente.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Administração de Usuários pela Chefia/Diretor (Priority: P1)

A Chefia/Diretor cadastra, atualiza, desativa, reativa e transfere de unidade os usuários do sistema (Policial Penal e Supervisor) pelo painel web, e pode forçar a redefinição da senha de qualquer usuário, que recebe a nova senha por e-mail.

**Why this priority**: É a funcionalidade mais crítica e mais usada da fase: hoje só existe criação e desativação de usuário; sem editar/ativar/transferir/resetar senha, a Chefia depende de suporte técnico direto no banco para corrigir cadastro de pessoal ou destravar um usuário com problema de acesso — é a lacuna administrativa mais visível do dia a dia.

**Independent Test**: Pode ser testado de forma independente cadastrando um novo usuário com uma unidade vinculada, editando seu cargo, desativando-o, reativando-o, transferindo-o para outra unidade e resetando sua senha, verificando a cada passo que o estado do usuário e o e-mail recebido refletem a ação.

**Acceptance Scenarios**:

1. **Given** a Chefia/Diretor autenticada, **When** ela cadastra um novo usuário informando nome, e-mail, matrícula, cargo, perfil e unidade(s) de lotação, **Then** o usuário passa a existir no sistema e recebe por e-mail uma senha para o primeiro acesso.
2. **Given** um usuário existente, **When** a Chefia/Diretor edita seus dados cadastrais (nome, matrícula, cargo, perfil), **Then** as alterações passam a valer imediatamente para esse usuário.
3. **Given** um usuário ativo, **When** a Chefia/Diretor o desativa, **Then** ele deixa de conseguir se autenticar e some das listagens de atribuição de novas movimentações/rotinas, mas seu histórico é preservado.
4. **Given** um usuário desativado, **When** a Chefia/Diretor o reativa, **Then** ele volta a conseguir se autenticar normalmente.
5. **Given** um usuário lotado em uma unidade, **When** a Chefia/Diretor usa "Trocar lotação" e escolhe outra unidade, **Then** a lotação anterior é substituída pela nova e o usuário perde o acesso aos dados restritos por unidade da unidade anterior.
6. **Given** um usuário lotado em uma unidade, **When** a Chefia/Diretor usa "Adicionar lotação" e escolhe uma unidade nova, **Then** o sistema pede confirmação explícita informando que a unidade será somada à lotação atual (sem removê-la) antes de efetivar, e só depois da confirmação o usuário passa a ter acesso às duas unidades.
7. **Given** um usuário existente, **When** a Chefia/Diretor edita seu perfil (incluindo promover para Chefia/Diretor ou rebaixar de Chefia/Diretor para Supervisor/Policial Penal), **Then** o novo perfil passa a valer imediatamente, com as permissões correspondentes.
8. **Given** um usuário que esqueceu ou precisa trocar a senha, **When** a Chefia/Diretor aciona "resetar senha" para ele, **Then** o sistema gera uma senha temporária, envia ao e-mail cadastrado do usuário, invalida a senha anterior, encerra todas as sessões ativas desse usuário, e exige que ele a troque no primeiro acesso seguinte.
9. **Given** um Supervisor ou Policial Penal autenticado, **When** ele tenta criar, editar, desativar, ativar, trocar lotação, adicionar lotação ou resetar a senha de um usuário, **Then** o sistema nega a operação por falta de permissão.
10. **Given** a Chefia/Diretor autenticada, **When** ela tenta desativar, rebaixar de perfil, trocar ou adicionar lotação na própria conta, **Then** o sistema nega a operação e informa que essa ação deve ser feita por outra Chefia/Diretor.
11. **Given** o e-mail cadastrado de um usuário é inválido ou o provedor de e-mail está indisponível, **When** a Chefia/Diretor cadastra esse usuário ou reseta sua senha, **Then** o sistema conclui a operação mesmo assim, avisa a Chefia/Diretor que o e-mail não foi entregue, e oferece um botão para reenviá-lo.

---

### User Story 2 - Biblioteca de Formulários, Modelos e Manuais (Priority: P2)

Chefia/Diretor e Supervisor publicam documentos organizados em três categorias (Formulários, Modelos de Documentos e Manuais); qualquer usuário autenticado no painel web consulta e baixa os documentos da categoria que precisar.

**Why this priority**: Centraliza material hoje disperso (papel, e-mail, pendrive) num só lugar, mas não bloqueia a operação diária de movimentações/rotinas — pode ser entregue depois da administração de usuários sem perder valor.

**Independent Test**: Pode ser testado de forma independente enviando um arquivo em cada uma das três categorias e verificando que ele aparece como card com nome e opção de download na categoria correta, para os três perfis de usuário.

**Acceptance Scenarios**:

1. **Given** a Chefia/Diretor ou o Supervisor autenticado, **When** envia um arquivo para a categoria Formulários, Modelos de Documentos ou Manuais, **Then** o documento passa a aparecer como um card com o nome do arquivo na categoria escolhida, disponível para download.
2. **Given** um documento publicado, **When** qualquer usuário autenticado (incluindo Policial Penal) acessa a categoria correspondente, **Then** ele consegue baixar o arquivo.
3. **Given** um Policial Penal autenticado, **When** ele tenta enviar ou remover um documento, **Then** o sistema nega a operação por falta de permissão.
4. **Given** um arquivo em formato não permitido (ex.: imagem, executável) ou maior que o limite definido, **When** a Chefia/Diretor ou o Supervisor tenta enviar esse arquivo, **Then** o sistema recusa o envio e informa o motivo.
5. **Given** um documento publicado por engano ou desatualizado, **When** a Chefia/Diretor ou o Supervisor o remove, **Then** ele deixa de aparecer na categoria e não pode mais ser baixado.
6. **Given** já existe um documento ativo chamado "X" na categoria Formulários, **When** a Chefia/Diretor ou o Supervisor tenta enviar outro documento chamado "X" na mesma categoria, **Then** o sistema recusa o envio e pede um nome diferente.

---

### User Story 3 - Troca de Senha pelo Próprio Usuário (Priority: P3)

Qualquer usuário autenticado no painel web troca sua própria senha a partir da tela de perfil, informando a senha atual e a nova senha duas vezes, com a opção de exibir o que foi digitado em cada campo. O mesmo controle de exibir/ocultar senha passa a existir também no formulário de login.

**Why this priority**: Reduz a dependência da Chefia/Diretor para trocas de senha rotineiras (User Story 1), mas é a menor e mais isolada das três — pode ser entregue por último sem afetar as outras.

**Independent Test**: Pode ser testado de forma independente logando com um usuário existente, abrindo a troca de senha pelo perfil, informando a senha atual e uma nova senha válida, e confirmando que o login seguinte só funciona com a nova senha.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado, **When** ele abre a troca de senha pelo ícone de perfil e informa a senha atual correta, a nova senha e a confirmação (iguais entre si e atendendo à política de senha), **Then** a senha é alterada, passa a valer no próximo login, e as demais sessões ativas desse usuário em outros dispositivos/navegadores são encerradas (a sessão atual continua válida).
2. **Given** um usuário autenticado, **When** ele informa a senha atual incorretamente, **Then** o sistema recusa a troca e informa o motivo, sem alterar a senha.
3. **Given** um usuário autenticado, **When** a nova senha e a confirmação não coincidem, **Then** o sistema impede o envio do formulário e indica a divergência.
4. **Given** o formulário de troca de senha ou o formulário de login, **When** o usuário aciona o ícone de exibir senha em qualquer campo de senha, **Then** o conteúdo digitado nesse campo passa a ser exibido em texto simples até ser ocultado novamente.

---

### Edge Cases

- O que acontece com movimentações e rotinas já registradas por um usuário desativado ou que teve a lotação alterada? Devem permanecer no histórico sem alteração.
- Ao usar "Adicionar lotação", como o texto de confirmação evita que a Chefia/Diretor confunda com "Trocar lotação" e some uma unidade por engano quando queria substituir?
- Um usuário com mais de uma unidade (depois de uma "Adicionar lotação") pode ser alvo de uma "Trocar lotação" depois? Nesse caso, a troca substitui todas as unidades atuais pela nova selecionada.
- O que acontece se a nova senha escolhida na troca de senha for igual à senha atual?
- O que acontece se alguém tentar baixar um documento por um link direto sem estar autenticado?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A Chefia/Diretor DEVE poder cadastrar um novo usuário informando nome, e-mail, matrícula, cargo, perfil (Policial Penal ou Supervisor) e a(s) unidade(s) de lotação.
- **FR-002**: O sistema DEVE enviar ao e-mail cadastrado do novo usuário uma senha para o primeiro acesso, no momento da criação.
- **FR-002a**: Se o envio desse e-mail falhar, o sistema DEVE concluir a criação do usuário mesmo assim, avisar a Chefia/Diretor do problema, e oferecer uma opção para reenviar o e-mail.
- **FR-003**: A Chefia/Diretor DEVE poder editar os dados cadastrais de um usuário existente (nome, matrícula, cargo e perfil), incluindo promover um usuário para o perfil Chefia/Diretor ou rebaixar um Chefia/Diretor para Supervisor/Policial Penal.
- **FR-004**: A Chefia/Diretor DEVE poder desativar e reativar um usuário existente.
- **FR-005**: Um usuário desativado NÃO DEVE conseguir se autenticar, mas seu histórico de ações anteriores DEVE ser preservado sem alteração.
- **FR-006**: A Chefia/Diretor DEVE poder "Trocar lotação" de um usuário, substituindo a(s) unidade(s) de lotação atual(is) pela(s) nova(s) escolhida(s).
- **FR-006a**: A Chefia/Diretor DEVE poder, como ação distinta de "Trocar lotação", "Adicionar lotação" a um usuário, somando uma unidade nova às unidades já vinculadas, sem removê-las. O sistema DEVE exigir uma confirmação explícita antes de efetivar essa ação, com texto que deixe claro que se trata de uma adição e não de uma substituição.
- **FR-007**: A Chefia/Diretor DEVE poder forçar a redefinição da senha de um usuário existente; o sistema DEVE gerar uma senha temporária, enviá-la ao e-mail cadastrado do usuário, invalidar a senha anterior, encerrar todas as sessões ativas desse usuário, e exigir que ele a troque no primeiro acesso seguinte ao reset.
- **FR-007a**: Se o envio desse e-mail falhar, o sistema DEVE concluir o reset mesmo assim (a senha anterior já foi invalidada), avisar a Chefia/Diretor do problema, e oferecer uma opção para reenviar o e-mail.
- **FR-008**: Somente a Chefia/Diretor DEVE poder criar, editar, desativar, ativar, trocar lotação, adicionar lotação ou resetar a senha de usuários; Supervisor e Policial Penal NÃO DEVEM ter acesso a essas operações.
- **FR-008a**: O sistema NÃO DEVE permitir que uma Chefia/Diretor desative, rebaixe de perfil, troque ou adicione lotação na própria conta; essas ações exigem outra Chefia/Diretor.
- **FR-009**: O sistema DEVE oferecer três categorias de documentos: Formulários, Modelos de Documentos e Manuais.
- **FR-010**: A Chefia/Diretor e o Supervisor DEVEM poder enviar um arquivo para qualquer uma das três categorias, associando um nome de exibição ao documento.
- **FR-010a**: O sistema DEVE recusar o envio de um documento cujo nome de exibição já esteja em uso por outro documento ativo na mesma categoria, e pedir um nome diferente.
- **FR-011**: Qualquer usuário autenticado no painel web, incluindo o Policial Penal, DEVE poder consultar e baixar os documentos de qualquer categoria.
- **FR-012**: Somente a Chefia/Diretor e o Supervisor DEVEM poder enviar ou remover documentos; o Policial Penal NÃO DEVE ter essa permissão.
- **FR-013**: O sistema DEVE recusar o envio de um documento cujo formato não seja DOCX, DOC, TXT ou PDF, e informar o motivo da recusa.
- **FR-013a**: O sistema DEVE verificar o conteúdo real do arquivo (não apenas a extensão do nome), recusando o envio se o conteúdo não corresponder a um dos formatos permitidos — inclusive quando um arquivo de outro tipo for renomeado para parecer um dos formatos aceitos.
- **FR-014**: O sistema DEVE recusar o envio de um arquivo acima do tamanho máximo permitido, e informar o motivo da recusa.
- **FR-015**: O sistema DEVE impedir que o conteúdo de um arquivo enviado seja executado ou interpretado como código, tanto pelo servidor quanto por quem o baixar.
- **FR-016**: Qualquer usuário autenticado DEVE poder trocar sua própria senha a partir da tela de perfil, informando a senha atual, a nova senha e a confirmação da nova senha.
- **FR-017**: O sistema DEVE recusar a troca de senha se a senha atual informada estiver incorreta, ou se a nova senha e a confirmação não coincidirem.
- **FR-017a**: Ao concluir a troca da própria senha, o sistema DEVE encerrar as demais sessões ativas do usuário em outros dispositivos/navegadores, mantendo válida apenas a sessão atual usada para efetuar a troca.
- **FR-018**: Todo campo de senha do formulário de troca de senha e do formulário de login DEVE oferecer um controle para exibir ou ocultar o conteúdo digitado.
- **FR-019**: Nenhuma das funcionalidades desta fase (administração de usuários, biblioteca de documentos, troca de senha) DEVE ficar acessível pelo aplicativo móvel.
- **FR-020**: Toda ação de administração de usuário (criar, editar, desativar, ativar, trocar lotação, adicionar lotação, resetar senha) e toda ação sobre documentos (enviar, remover) DEVE ficar registrada na trilha de auditoria já existente no sistema.
- **FR-021**: Toda tela nova desta fase no painel web (administração de usuários, biblioteca de documentos, troca de senha) DEVE seguir o padrão visual, a paleta de cores e os componentes (cards, modais) já em uso no sistema — layout moderno e profissional, sem introduzir estilo, cor ou estrutura de tela novos fora do que já está em uso.

### Key Entities *(include if feature involves data)*

- **Usuário**: entidade já existente no sistema; passa a suportar edição de dados cadastrais (incluindo perfil), reativação, troca ou adição de lotação (uma ou mais unidades) e redefinição de senha por terceiro (Chefia/Diretor), além da troca da própria senha.
- **Documento**: um arquivo publicado por Chefia/Diretor ou Supervisor, com nome de exibição, categoria (Formulário, Modelo de Documento ou Manual), autor e data de publicação.
- **Categoria de Documento**: agrupa documentos em Formulários, Modelos de Documentos ou Manuais; determina em qual menu o documento aparece.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Chefia/Diretor consegue corrigir o cadastro de um usuário (editar, ativar, desativar, transferir ou resetar senha) sem precisar de suporte técnico fora do sistema.
- **SC-002**: Um usuário recém-criado ou com a senha redefinida consegue acessar o sistema poucos minutos depois de receber o e-mail, sem intervenção manual de terceiros.
- **SC-003**: Qualquer usuário autenticado encontra e baixa um formulário, modelo ou manual publicado em poucas interações (abrir o menu da categoria, localizar o card, baixar).
- **SC-004**: Nenhum arquivo fora dos formatos permitidos ou acima do tamanho máximo é aceito pelo sistema.
- **SC-005**: Um usuário troca sua própria senha sem precisar acionar a Chefia/Diretor, numa única sessão, a partir do próprio perfil.

## Assumptions

- Os perfis "diretor", "supervisor" e "policial" citados na descrição correspondem aos perfis já existentes no sistema: Chefia/Diretor, Supervisor e Policial Penal.
- A política de complexidade da nova senha (criação, reset ou troca pelo próprio usuário) é a mesma já aplicada hoje na definição da senha inicial do usuário.
- Existe um tamanho máximo de arquivo razoável para os documentos (formulários, modelos e manuais são tipicamente arquivos de texto/PDF de poucos megabytes); o valor exato é uma decisão técnica a ser definida no planejamento.
- Documentos publicados podem ser removidos, mas esta fase não exige versionamento (histórico de versões de um mesmo documento) nem edição do arquivo já enviado — para atualizar um documento, remove-se o antigo e publica-se um novo.
- O envio de e-mail (para senha inicial e para reset de senha) depende de um serviço de envio de e-mail; esta fase assume que esse serviço será disponibilizado ou configurado como parte da implementação.
- Esta fase é exclusiva do painel web; nenhuma das três funcionalidades (administração de usuários, biblioteca de documentos, troca de senha) é exposta no aplicativo móvel, nem para leitura.
- O padrão visual, a paleta de cores e os componentes de tela/modal/card a seguir são os já documentados e em uso no painel web (ver `docs/style-guide.md`), não um novo sistema de design.
