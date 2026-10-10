# Quickstart: Base de Conhecimento com RAG

Guia de validação ponta a ponta. Endpoints em [contracts/knowledge-api.md](./contracts/knowledge-api.md); modelo em [data-model.md](./data-model.md); fluxos em [contracts/flows.md](./contracts/flows.md).

## Pré-requisitos

- Ambiente da 001/002 rodando (backend, frontend, seed com 1 usuário por perfil: `WARDEN`, `SUPERVISOR`, `PRISON_OFFICER`).
- Postgres com `pgvector`: `cd docker/postgres && docker compose up -d` (imagem `pgvector/pgvector:pg16`).
- Ollama: `cd docker/ollama && docker compose up -d` e aguardar o download dos modelos (`bge-m3`, `qwen2.5:7b-instruct`). Verificar: `curl localhost:11434/api/tags`.
- `.env` do backend com as variáveis de [contracts/ai-providers.md](./contracts/ai-providers.md) (os defaults servem para Ollama local) e `KNOWLEDGE_STORAGE_PATH`.
- `npm run migration:run` em `backend/`.
- 3 arquivos de teste: `escolta.pdf` (procedimento de escolta hospitalar), `plantao.docx`, `regras.txt`; e um `fake.pdf` que na verdade é um executável.

## Cenário 1 — Carregar e consultar (US2 + US1)

1. Login como `SUPERVISOR`; abrir **Base de Conhecimento → Documentos** e enviar `escolta.pdf` com nome "Procedimento de Escolta Hospitalar".
   **Esperado**: `202`; estado "Processando" e, em até 5 min (SC-004), "Disponível para consulta".
2. Aba **Perguntar**: "quais os passos para fazer uma escolta hospitalar".
   **Esperado**: resposta baseada no PDF, fonte "Procedimento de Escolta Hospitalar" listada.
3. Perguntar algo sem relação ("qual a capital da França?").
   **Esperado**: "Não foi possível encontrar a resposta", `outcome = NO_ANSWER`, sem texto inventado.
4. Enviar `fake.pdf`. **Esperado**: `400`, nada registrado.
5. Enviar de novo com o mesmo nome. **Esperado**: `409`.

## Cenário 2 — Falha da IA devolve trechos (US1 #3)

1. Parar o Ollama de chat (`docker compose stop ollama`) **ou** configurar `CHAT_PROVIDER=openai` com chave inválida.
2. Se só o chat falhou (embeddings por outro provedor/instância): perguntar. **Esperado**: `201`, `outcome = EXCERPTS_ONLY`, trechos brutos e aviso na tela.
3. Se o provedor de embeddings também está fora: **Esperado**: `503` com mensagem para tentar novamente, nada no histórico.

## Cenário 3 — Gestão de documentos (US3)

1. Atualizar o documento enviando outra versão. **Esperado**: durante `UPDATING` as perguntas continuam respondidas pela versão antiga; depois, pela nova.
2. Atualizar com um PDF sem texto (escaneado). **Esperado**: volta a `READY` com aviso de falha; versão anterior intacta.
3. Excluir o documento com confirmação. **Esperado**: some da lista; pergunta anterior sobre ele passa a dar `NO_ANSWER`; o histórico antigo permanece com o nome da fonte.

## Cenário 4 — Histórico imutável (US4)

1. Aba **Histórico** como `SUPERVISOR` A: ver consultas de todos, com o autor (Clarifications).
2. `DELETE /api/v1/knowledge/queries/41` e `PUT`: **Esperado**: `404`.
3. Direto no banco: `UPDATE knowledge_queries SET answer='x'` e `DELETE`. **Esperado**: erro `knowledge_queries is immutable`.

## Cenário 5 — Acesso (FR-001)

1. Login como `PRISON_OFFICER`: o item de menu não aparece e qualquer rota `/api/v1/knowledge/*` responde `403`.
2. Aplicativo móvel: não há tela nem chamada (FR-003).

## Cenário 6 — Troca de provedor (SC-009)

1. Alterar `EMBEDDING_PROVIDER=openai` com `OPENAI_API_KEY` válida e reiniciar.
   **Esperado**: documentos viram "Precisa reprocessar"; consulta responde `NO_ANSWER` até reprocessar; após `POST .../reprocess`, volta a funcionar.
2. Configuração inválida (`CHAT_PROVIDER=xyz`): o backend não sobe, com mensagem clara (FR-030).

## Validação de qualidade (SC-001/SC-002)

Montar ≥ 20 perguntas com resposta conhecida nos documentos e ≥ 10 fora de escopo; registrar acertos. Alvo: ≥ 85% corretas com fonte certa; 100% das fora de escopo em `NO_ANSWER`. Ajustar `KNOWLEDGE_MIN_SIMILARITY` e o modelo de chat conforme o resultado.

## Testes automatizados

- `cd backend && npm test` (unit: chunker, extratores, adapters, factory, prompt-builder).
- `cd backend && npm run test:integration` (knowledge.spec.ts com providers falsos).
- `cd frontend && npm test`.
