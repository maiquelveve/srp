# Feature Specification: Base de Conhecimento com Consulta Assistida por IA (RAG)

**Feature Branch**: `003-knowledge-base-rag`

**Created**: 2026-10-10

**Status**: Draft

**Input**: User description: "Nova fase do SRP (versão 2.0): Base de Conhecimento com RAG sobre documentos normativos. O Supervisor e a Chefia/Diretor perguntam em linguagem natural (ex.: \"quais os passos para fazer uma escolta hospitalar\") em uma tela com um campo de texto e um botão de enviar, e recebem uma resposta baseada nos documentos internos (normativas, procedimentos) previamente carregados no sistema. Inclui ingestão de documentos (PDF/DOCX/TXT) com visualização, edição e exclusão, e histórico de consultas imutável. Camada de provedores de IA intercambiável (adapter pattern), com Ollama via docker-compose como provedor inicial. Nada disso é acessível pelo aplicativo móvel."

## Clarifications

### Session 2026-10-10

- Q: Quem pode ver as perguntas e respostas do histórico? → A: Todos os usuários autorizados (Supervisor e Chefia/Diretor) veem o histórico completo de todos, com indicação de quem perguntou.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Perguntar e receber resposta baseada nos documentos internos (Priority: P1)

O Supervisor ou a Chefia/Diretor abre a tela "Base de Conhecimento", digita uma pergunta em linguagem natural (ex.: "quais os passos para fazer uma escolta hospitalar") e clica em enviar. O sistema localiza os trechos mais relevantes dos documentos internos já carregados e devolve uma resposta escrita com base neles, indicando de quais documentos a informação veio.

**Why this priority**: É o objetivo central da fase: transformar normativas e procedimentos hoje espalhados em arquivos em uma resposta direta, rápida e rastreável até o documento de origem. Sem isso, o restante (carga de documentos, histórico) não entrega valor ao usuário final.

**Independent Test**: Com ao menos um documento já carregado, fazer uma pergunta cujo assunto está nesse documento e verificar que a resposta reflete o conteúdo dele e cita o documento de origem; fazer uma pergunta sem relação com nenhum documento e verificar a resposta "Não foi possível encontrar a resposta".

**Acceptance Scenarios**:

1. **Given** um documento carregado que descreve os passos de uma escolta hospitalar, **When** o Supervisor pergunta "quais os passos para fazer uma escolta hospitalar", **Then** o sistema exibe uma resposta baseada no conteúdo desse documento e lista o(s) documento(s) usados como fonte.
2. **Given** que nenhum documento carregado trata do assunto perguntado, **When** o usuário envia a pergunta, **Then** o sistema responde "Não foi possível encontrar a resposta" e não inventa conteúdo.
3. **Given** que o serviço de IA está indisponível, sem créditos ou com limite de uso excedido, **When** o usuário envia uma pergunta, **Then** o sistema não exibe erro genérico: apresenta os trechos brutos mais relevantes dos documentos, com aviso claro de que não foi possível gerar uma resposta elaborada.
4. **Given** um usuário com perfil Policial Penal, **When** ele tenta acessar a tela de consulta (pela interface ou diretamente pela API), **Then** o acesso é negado.
5. **Given** que uma pergunta foi enviada e está sendo processada, **When** o usuário aguarda, **Then** a tela indica que a consulta está em andamento e impede o reenvio duplicado da mesma pergunta.

---

### User Story 2 - Carregar documentos na base de conhecimento (Priority: P1)

O Supervisor ou a Chefia/Diretor envia um arquivo (PDF, DOCX ou TXT) de uma normativa ou procedimento. O sistema guarda o arquivo, extrai seu texto, o divide em trechos e o torna pesquisável pela consulta. O usuário acompanha o andamento até o documento ficar "Disponível para consulta" ou "Falhou".

**Why this priority**: A consulta só responde algo se existir conteúdo carregado. É pré-requisito direto da User Story 1 e, juntas, formam o MVP.

**Independent Test**: Enviar um arquivo TXT/PDF/DOCX válido e verificar que ele aparece na lista com o estado "Disponível para consulta" e que uma pergunta sobre seu conteúdo passa a ser respondida; enviar um arquivo inválido (conteúdo diferente da extensão, sem texto extraível) e verificar a recusa/falha com mensagem compreensível.

**Acceptance Scenarios**:

1. **Given** o Supervisor na tela de documentos da base de conhecimento, **When** ele envia um PDF válido com nome de exibição, **Then** o arquivo é guardado, processado e o documento passa para "Disponível para consulta".
2. **Given** um arquivo cujo conteúdo real não corresponde à extensão (ex.: executável renomeado para .pdf), **When** o usuário tenta enviá-lo, **Then** o envio é recusado com mensagem clara e nada é registrado.
3. **Given** um PDF escaneado sem texto extraível, **When** o processamento termina, **Then** o documento fica no estado "Falhou" com o motivo (sem texto extraível) e não participa das consultas.
4. **Given** que o serviço de IA usado no processamento está indisponível, **When** o documento é processado, **Then** ele fica "Falhou" com a possibilidade de reprocessar depois, sem perder o arquivo enviado.
5. **Given** um documento com o mesmo nome de exibição, **When** o usuário tenta enviar outro com esse nome, **Then** o envio é bloqueado pedindo um nome diferente.

---

### User Story 3 - Visualizar, atualizar e excluir documentos já carregados (Priority: P2)

Na tela de consulta, o usuário vê a lista dos documentos da base (nome, tipo, data de envio, autor, estado), pode substituir um documento por uma versão atualizada e pode excluí-lo quando deixar de valer.

**Why this priority**: Normativas mudam; sem atualizar/excluir, a base passaria a responder com conteúdo desatualizado e perderia a confiança dos usuários. Não bloqueia o primeiro uso, por isso P2.

**Independent Test**: Substituir um documento por uma nova versão com conteúdo diferente e verificar que as respostas passam a refletir só a nova versão; excluir um documento e verificar que ele some da lista e deixa de ser usado nas respostas.

**Acceptance Scenarios**:

1. **Given** documentos carregados, **When** o usuário abre a tela de consulta, **Then** vê a lista com nome, tipo, data de envio, autor e estado de cada documento.
2. **Given** um documento existente, **When** o usuário envia uma versão atualizada, **Then** o conteúdo antigo deixa de ser usado nas respostas e o novo passa a ser, sem que haja momento em que o documento fique totalmente fora da base por causa de uma atualização que falhou.
3. **Given** que a atualização falha no processamento, **When** isso acontece, **Then** a versão anterior continua disponível e o usuário é informado da falha.
4. **Given** um documento existente, **When** o usuário o exclui e confirma, **Then** o documento, seu arquivo e seus trechos deixam de existir na base e não aparecem mais nas respostas.
5. **Given** que um documento já foi usado em consultas anteriores, **When** ele é excluído, **Then** o histórico dessas consultas permanece intacto, inclusive a indicação do nome do documento que serviu de fonte.

---

### User Story 4 - Consultar o histórico de perguntas e respostas (Priority: P2)

O usuário vê, na própria tela de consulta, o histórico de perguntas já feitas por todos os usuários autorizados, com a resposta recebida, quem perguntou e a data/hora da consulta. O histórico é permanente: ninguém pode apagá-lo ou editá-lo.

**Why this priority**: Dá rastreabilidade ao que foi orientado com base na IA (importante num ambiente de segurança/penal) e evita refazer perguntas. Depende da US1 já gerar os registros.

**Independent Test**: Fazer duas perguntas e verificar que ambas aparecem no histórico com pergunta, resposta e data; verificar que não existe nenhuma ação (interface ou API) para excluir ou alterar um registro.

**Acceptance Scenarios**:

1. **Given** consultas já realizadas, **When** o usuário abre o histórico, **Then** vê, da mais recente para a mais antiga, a pergunta, a resposta e a data da consulta.
2. **Given** uma pergunta sem resposta nos documentos, **When** ela é registrada, **Then** o histórico guarda a pergunta e a resposta "Não foi possível encontrar a resposta".
3. **Given** um registro do histórico, **When** qualquer usuário, inclusive a Chefia/Diretor, tenta apagá-lo ou alterá-lo, **Then** a operação não existe na interface e é recusada se tentada diretamente pela API.
4. **Given** um histórico longo, **When** o usuário navega, **Then** a lista é paginada e permite filtrar por texto da pergunta.
5. **Given** consultas feitas por vários usuários autorizados, **When** um Supervisor ou a Chefia/Diretor abre o histórico, **Then** vê as consultas de todos, cada uma com o nome de quem perguntou.

---

### Edge Cases

- Pergunta vazia, só com espaços ou acima do tamanho máximo permitido: o envio é recusado antes de consultar a IA, com mensagem clara.
- Base sem nenhum documento "Disponível para consulta": a tela informa que ainda não há documentos e a consulta responde "Não foi possível encontrar a resposta" (ou fica desabilitada com orientação, sem erro).
- Arquivo acima do tamanho máximo permitido para documentos: recusado com mensagem clara, mesmo limite já usado na biblioteca de documentos.
- Documento muito grande (centenas de páginas): é processado por inteiro, em segundo plano, sem travar a tela; o usuário vê o estado "Processando".
- Dois usuários enviam o mesmo documento ao mesmo tempo: só um é aceito (regra de nome único entre os documentos da base).
- O usuário fecha a tela ou perde a conexão durante o processamento: o processamento continua e o estado final fica visível depois.
- O serviço de IA é trocado (outro modelo/provedor) e os conteúdos já indexados deixam de ser compatíveis com o novo: o sistema não devolve resultados enganosos; os documentos são sinalizados como "Precisa reprocessar" até serem reindexados.
- O texto de um documento contém instruções dirigidas à IA (ex.: "ignore as regras anteriores"): o conteúdo do documento é tratado apenas como material de consulta, nunca como instrução ao sistema.
- Falha no meio da ingestão (arquivo já guardado, trechos parcialmente gravados): o documento nunca fica meio indexado; ou fica completo, ou nenhum trecho dele participa das respostas.
- Pergunta fora do contexto dos documentos mas que a IA saberia responder por conhecimento próprio: o sistema NÃO responde com conhecimento externo; responde "Não foi possível encontrar a resposta".
- Usuário desativado ou com perfil rebaixado enquanto a tela está aberta: a próxima requisição é recusada conforme o perfil atual.

## Requirements *(mandatory)*

### Functional Requirements

**Acesso e perfis**

- **FR-001**: O sistema MUST restringir todas as telas e operações desta funcionalidade (consulta, histórico, carga, listagem, atualização e exclusão de documentos) aos perfis Supervisor e Chefia/Diretor; o perfil Policial Penal MUST ter o acesso negado, inclusive via chamada direta à API.
- **FR-002**: O sistema MUST validar o perfil no backend em toda operação, independentemente da interface usada (Princípio IV da constituição).
- **FR-003**: A funcionalidade MUST existir somente no painel web; o aplicativo móvel MUST NOT oferecê-la.

**Consulta (chat)**

- **FR-004**: A tela de consulta MUST oferecer um campo de texto para a pergunta e um botão de enviar, e exibir a resposta recebida na própria tela.
- **FR-005**: O sistema MUST responder a pergunta com base exclusivamente nos trechos dos documentos "Disponíveis para consulta" ou "Atualizando" (nesse caso, da versão anterior, que segue disponível) mais relevantes para ela; a resposta MUST NOT incluir informação que não esteja nesses trechos.
- **FR-006**: Cada resposta MUST indicar os documentos de origem utilizados (nome do documento).
- **FR-007**: Quando não houver trechos suficientemente relevantes ou a IA não souber responder, o sistema MUST responder exatamente com a mensagem "Não foi possível encontrar a resposta".
- **FR-008**: Quando o serviço de IA falhar (limite de uso, falta de créditos, indisponibilidade, tempo esgotado), o sistema MUST retornar os trechos brutos mais relevantes com aviso explícito, em vez de erro; a pergunta MUST ser registrada normalmente no histórico, com indicação de que a resposta foi só de trechos.
- **FR-009**: O sistema MUST recusar perguntas vazias ou acima do tamanho máximo, sem acionar o serviço de IA.
- **FR-010**: O sistema MUST limitar o número de consultas por usuário em um intervalo de tempo, para evitar uso abusivo e consumo descontrolado de recursos/créditos de IA.

**Ingestão de documentos**

- **FR-011**: O usuário MUST poder enviar documentos nos formatos PDF, DOCX e TXT, informando um nome de exibição.
- **FR-012**: O sistema MUST validar a extensão e o conteúdo real do arquivo e recusar o envio quando não corresponderem, aplicando o mesmo limite de tamanho e as mesmas regras de validação já usadas pela biblioteca de documentos (reutilização, sem duplicar a lógica).
- **FR-013**: O sistema MUST primeiro armazenar o arquivo no armazenamento de arquivos do sistema e, em seguida, processá-lo: extrair o texto, dividi-lo em trechos de aproximadamente 300 a 500 palavras com sobreposição de aproximadamente 50 palavras, gerar a representação pesquisável de cada trecho e persistir os trechos associados ao documento.
- **FR-014**: Cada documento MUST ter um estado visível ao usuário: "Processando", "Disponível para consulta", "Atualizando" (nova versão em processamento; a anterior segue disponível), "Falhou" ou "Precisa reprocessar"; somente documentos "Disponíveis para consulta" ou "Atualizando" participam das respostas.
- **FR-015**: Quando o processamento falhar (sem texto extraível, arquivo corrompido, serviço de IA indisponível), o sistema MUST registrar o motivo, mostrá-lo ao usuário e permitir reprocessar sem novo envio do arquivo.
- **FR-016**: O sistema MUST garantir que um documento nunca fique parcialmente indexado: ou todos os seus trechos estão persistidos e o documento fica disponível, ou nenhum trecho dele participa das respostas.
- **FR-017**: O sistema MUST bloquear o envio quando já existir um documento com o mesmo nome de exibição na base e pedir outro nome.
- **FR-018**: O sistema MUST registrar para cada documento: nome de exibição, tipo (formato do arquivo), data de envio, autor (usuário que enviou), estado e, quando falhou, o motivo.

**Gestão de documentos**

- **FR-019**: O usuário MUST poder visualizar, na tela de consulta, a lista de documentos já carregados com nome, tipo, data de envio, autor e estado, com busca por nome e paginação.
- **FR-020**: O usuário MUST poder atualizar um documento enviando uma nova versão do arquivo (e, opcionalmente, novo nome); durante o processamento da nova versão, a versão anterior MUST continuar disponível, e só deixa de existir quando a nova estiver disponível. Se a nova falhar, a anterior permanece.
- **FR-021**: O usuário MUST poder excluir um documento, mediante confirmação explícita; a exclusão MUST remover o registro, o arquivo armazenado e todos os trechos do documento.
- **FR-022**: Envio, atualização, exclusão e reprocessamento de documentos MUST gerar registro de auditoria (usuário, data/hora, ação, documento afetado), conforme o Princípio III da constituição.

**Histórico de consultas**

- **FR-023**: O sistema MUST persistir cada consulta realizada — pergunta, resposta entregue, data/hora, usuário que perguntou, documentos de origem e indicação de resposta só com trechos — inclusive quando a resposta for "Não foi possível encontrar a resposta".
- **FR-024**: O histórico MUST ser imutável: o sistema MUST NOT oferecer, em interface ou API, qualquer operação para alterar ou excluir registros do histórico, para nenhum perfil.
- **FR-025**: O usuário MUST poder visualizar o histórico na tela de consulta, completo de todos os usuários autorizados (Supervisor e Chefia/Diretor), com pergunta, resposta, autor da pergunta e data da consulta, ordenado da mais recente para a mais antiga, paginado e com filtro por texto da pergunta.
- **FR-026**: O registro do histórico MUST permanecer íntegro e legível mesmo após a exclusão ou atualização dos documentos que serviram de fonte (o nome da fonte é guardado no próprio registro).

**Camada de provedores de IA**

- **FR-027**: A geração da representação pesquisável (embeddings) e a geração da resposta (chat) MUST ser acessadas por contratos independentes de fornecedor, de modo que trocar de provedor/modelo seja uma mudança de configuração, sem alteração das regras de negócio de ingestão e consulta.
- **FR-028**: A seleção do provedor de embeddings e do provedor de chat MUST ser feita por configuração de ambiente, de forma independente entre os dois.
- **FR-029**: O sistema MUST suportar, como provedores selecionáveis, Ollama (inicial, rodando localmente), OpenAI e Claude (chat), sem uso de biblioteca/SDK externo de IA.
- **FR-030**: O sistema MUST falhar na inicialização, com mensagem clara, quando a configuração de provedor for inválida ou incompleta (provedor desconhecido, chave ausente para provedor externo).
- **FR-031**: O ambiente de desenvolvimento MUST disponibilizar o Ollama (chat e embeddings) via docker-compose, seguindo a convenção de stacks já existente em `docker/`.

**Segurança e privacidade**

- **FR-032**: O conteúdo dos documentos e as perguntas MUST ser tratados como dados confidenciais: MUST NOT aparecer em logs de aplicação além do necessário para diagnóstico (nunca o texto completo), nem ser exposto a quem não tem o perfil autorizado.
- **FR-033**: O texto dos documentos MUST ser usado apenas como contexto de consulta; instruções embutidas nos documentos MUST NOT alterar o comportamento do sistema.

### Key Entities *(include if feature involves data)*

- **Documento da Base de Conhecimento**: arquivo normativo/procedimento carregado para consulta. Atributos: nome de exibição, tipo (formato), data de envio, autor, estado (Processando / Disponível para consulta / Atualizando / Falhou / Precisa reprocessar), motivo da falha, referência ao arquivo armazenado. Distinto dos documentos da biblioteca de Formulários/Modelos/Manuais (feature 002), embora reutilize seu mecanismo de armazenamento e validação de arquivo.
- **Trecho do Documento**: fragmento de texto de um documento (~300–500 palavras), com ordem de posição no documento e sua representação pesquisável. Pertence a exatamente um documento; é removido junto com ele.
- **Consulta (Histórico)**: registro imutável de uma pergunta e da resposta entregue. Atributos: pergunta, resposta, data/hora, usuário, nomes dos documentos de origem (cópia, não vínculo), indicador de resposta só com trechos / sem resposta. Nunca é alterado nem excluído.
- **Provedor de IA**: capacidade configurável de gerar embeddings ou respostas de chat; não é dado persistido, mas parte do contrato da feature (FR-027 a FR-031).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em um conjunto de ao menos 20 perguntas de validação elaboradas a partir dos documentos carregados, pelo menos 85% recebem resposta cujo conteúdo corresponde ao documento correto e citam a fonte correta.
- **SC-002**: 100% das perguntas sem correspondência nos documentos recebem "Não foi possível encontrar a resposta", sem conteúdo inventado, no conjunto de validação de perguntas fora de escopo.
- **SC-003**: O usuário recebe a resposta (ou os trechos brutos, em caso de falha da IA) em até 30 segundos em 90% das consultas, em ambiente com a configuração local inicial.
- **SC-004**: Um documento de até 50 páginas fica "Disponível para consulta" em até 5 minutos após o envio, sem que o usuário precise permanecer na tela.
- **SC-005**: 100% das consultas realizadas (com resposta, sem resposta ou só com trechos) aparecem no histórico com pergunta, resposta e data; 0 registros alteráveis ou excluíveis por qualquer perfil.
- **SC-006**: Quando o serviço de IA está indisponível, 100% das consultas retornam trechos brutos ou mensagem clara, sem erro genérico de sistema.
- **SC-007**: 100% das tentativas de acesso por Policial Penal (interface ou API) às operações da feature são negadas.
- **SC-008**: Um usuário consegue enviar um documento e fazer a primeira pergunta sobre ele em menos de 3 minutos, sem treinamento.
- **SC-009**: Trocar o provedor de IA (de Ollama para outro suportado) exige apenas mudança de configuração e reprocessamento dos documentos, sem alteração de código das regras de ingestão e consulta.

## Assumptions

- **Perfis**: "Supervisor e diretor" correspondem aos perfis já existentes Supervisor e Chefia/Diretor (`SUPERVISOR` e `WARDEN` no sistema); a autenticação e a gestão de perfis vêm da feature 002.
- **Escopo web**: apenas o painel web; a feature não aparece no aplicativo móvel, assim como as funcionalidades administrativas da 002.
- **Nomes técnicos em inglês**: pela Constituição (Princípio XI), tabelas, colunas e código em inglês. As tabelas citadas na descrição (`documentos`, `documento_chunks` e a de histórico) serão nomeadas em inglês na fase de plano (ex.: `knowledge_documents`, `knowledge_document_chunks`, `knowledge_queries`), também para não colidir com a tabela `documents` já existente da biblioteca. Os textos exibidos ao usuário permanecem em português.
- **Mensagem sem resposta**: a descrição original escreve "Nao foi possivel encontrar a resposta"; adota-se a grafia correta em português ("Não foi possível encontrar a resposta"), por ser texto de interface (Princípio XI).
- **Reutilização**: o armazenamento de arquivos, os limites de tamanho e a verificação de assinatura/extensão da biblioteca de documentos (feature 002) são reutilizados; documentos da base de conhecimento ficam separados da biblioteca de Formulários/Modelos/Manuais.
- **Tipo do documento**: o "tipo" exibido é o formato do arquivo (PDF, DOCX ou TXT); não há categorias de negócio nesta fase.
- **Visibilidade do histórico**: o histórico é compartilhado entre todos os usuários autorizados (Supervisor e Chefia/Diretor), cada registro com indicação de quem perguntou (ver Clarifications).
- **Processamento assíncrono**: o processamento do documento acontece em segundo plano após o envio; a tela mostra o estado e atualiza sem exigir recarga manual.
- **Recuperação**: por consulta, os 5 trechos mais similares à pergunta são usados como contexto; trechos abaixo de um limiar mínimo de similaridade (definido no plano) são ignorados, e sem trechos acima do limiar vale FR-007.
- **Privacidade e provedor**: na fase inicial, o conteúdo dos documentos e das perguntas é processado apenas por modelos locais (Ollama). Usar provedores externos (OpenAI/Claude) em produção implica enviar esse conteúdo a terceiros e é uma decisão consciente de configuração, a ser avaliada pela instituição antes de ativar.
- **Reindexação**: ao trocar o modelo de embeddings, os documentos existentes precisam ser reprocessados; não há migração automática silenciosa.
- **Fora de escopo**: busca web, resposta com conhecimento externo aos documentos, conversa com memória de múltiplos turnos, OCR de PDFs escaneados, feedback "útil/não útil" nas respostas, controle de acesso por documento (todos os documentos valem para todos os usuários autorizados).
- **Detalhes técnicos de contratos**: modelo de dados completo, assinaturas das interfaces de provedores, fluxos detalhados de ingestão e consulta e variáveis de ambiente serão entregues na fase `/speckit-plan` (data-model.md, contracts/, research.md), conforme o padrão das features 001 e 002. A decisão de implementar manualmente (sem SDK de IA pronto) e com adapter pattern já está tomada e não será reavaliada.
