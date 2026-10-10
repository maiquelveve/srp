# Contract: API da Base de Conhecimento (`/api/v1/knowledge`)

Todo endpoint exige `Authorization: Bearer <access_token>` e perfil **WARDEN** ou **SUPERVISOR**. `PRISON_OFFICER` recebe `403` em todos (FR-001/002). Sem endpoint para o aplicativo móvel (FR-003).

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/v1/knowledge/queries` | Faz uma pergunta; persiste no histórico; devolve a resposta (FR-004…FR-010, FR-023). |
| GET | `/api/v1/knowledge/queries?search=&limit=&offset=` | Histórico de todos os usuários, mais recente primeiro (FR-025). |
| GET | `/api/v1/knowledge/documents?search=&limit=&offset=` | Lista documentos (FR-019). |
| POST | `/api/v1/knowledge/documents` | Envia documento (`multipart`: `file`, `name`) (FR-011…FR-018). |
| PUT | `/api/v1/knowledge/documents/:id` | Atualiza (`multipart`: `file` e/ou `name`) (FR-020). |
| POST | `/api/v1/knowledge/documents/:id/reprocess` | Reprocessa `FAILED`/`NEEDS_REPROCESS` (FR-015). |
| DELETE | `/api/v1/knowledge/documents/:id` | Exclui documento, arquivo e trechos (FR-021). |

**Não existem** `PUT`/`PATCH`/`DELETE` em `/knowledge/queries` (FR-024): a rota responde `404`. O banco bloqueia mesmo acesso direto (trigger).

## POST /knowledge/queries

Request: `{ "question": "quais os passos para fazer uma escolta hospitalar" }` — 3 a 1000 caracteres, após `trim`.

Response `201`:
```json
{
  "id": 41,
  "question": "quais os passos para fazer uma escolta hospitalar",
  "answer": "Os passos são: 1) ... 2) ...",
  "outcome": "ANSWERED",
  "sources": [
    { "documentId": 7, "documentName": "Procedimento de Escolta Hospitalar", "position": 3, "excerpt": "..." }
  ],
  "askedBy": { "id": 5, "name": "Maria Souza" },
  "createdAt": "2026-10-10T14:03:11.000Z"
}
```

`outcome`:
- `ANSWERED`: resposta gerada com base nos trechos; `sources` com os trechos usados.
- `NO_ANSWER`: `answer = "Não foi possível encontrar a resposta"`, `sources = []`; o chat não é chamado se não houve trecho acima do limiar.
- `EXCERPTS_ONLY`: o provedor de chat falhou (limite, créditos, indisponibilidade, timeout); `answer` traz os trechos brutos formatados, `sources` os mesmos trechos. HTTP continua `201` (FR-008). A tela exibe o aviso "Não foi possível gerar uma resposta elaborada. Veja os trechos relevantes abaixo."

Erros:
| Código | Quando |
|---|---|
| `400` | `question` vazia/curta/longa demais (nada é persistido, a IA não é chamada, FR-009). |
| `403` | Perfil não autorizado. |
| `429` | Limite de consultas por minuto do usuário excedido (FR-010). |
| `503` | O provedor de **embeddings** está indisponível: sem vetor da pergunta não há nem trechos brutos. Nada é persistido; a tela pede para tentar novamente. |

## GET /knowledge/queries

Response `200`: `{ "data": [ <mesmo objeto acima> ], "total": 128 }`. `search` filtra por substring (case-insensitive) da pergunta. `limit` default 20.

## GET /knowledge/documents

```json
{
  "data": [
    {
      "id": 7,
      "name": "Procedimento de Escolta Hospitalar",
      "fileFormat": "pdf",
      "originalFileName": "escolta.pdf",
      "sizeBytes": 245678,
      "status": "READY",
      "failureReason": null,
      "chunkCount": 12,
      "uploadedBy": { "id": 2, "name": "João Lima" },
      "createdAt": "2026-10-09T12:00:00.000Z",
      "updatedAt": "2026-10-09T12:01:30.000Z"
    }
  ],
  "total": 1
}
```

## POST /knowledge/documents

`multipart/form-data`: `file` (obrigatório), `name` (obrigatório, 1–200).

- `202 Accepted` → `{ "id": 7, "name": "...", "status": "PROCESSING" }`. O processamento segue em segundo plano.
- `400` extensão fora de PDF/DOCX/TXT (inclui `.doc`) ou conteúdo não corresponde à extensão (reutiliza a verificação de assinatura da 002, com lista de formatos restrita).
- `409` já existe documento com esse `name`.
- `413` acima de `DOCUMENTS_MAX_FILE_SIZE_MB` (mesmo limite da biblioteca).
- `403` perfil não autorizado.

## PUT /knowledge/documents/:id

`multipart/form-data`: `file` (opcional) e `name` (opcional); ao menos um.

- Com `file`: `202`, status `UPDATING`; conteúdo anterior segue pesquisável até a troca (FR-020).
- Só `name`: `200`, sem reprocessar.
- `404` inexistente · `409` nome já usado por outro documento · `409` se o documento está `PROCESSING`/`UPDATING` (aguarde terminar) · demais erros como no POST.

## POST /knowledge/documents/:id/reprocess

- `202` → status `PROCESSING`. Só vale para `FAILED` e `NEEDS_REPROCESS`; outros estados → `409`.

## DELETE /knowledge/documents/:id

- `204`. Remove linha, trechos (cascade) e arquivo(s) em disco. Histórico permanece intacto (FR-026).
- `404` inexistente.
- Se o documento está sendo processado, o processamento é cancelado e o resultado descartado.

## Auditoria

`POST`, `PUT`, `reprocess` e `DELETE` de documento geram `AuditService.record` (`INSERT`/`UPDATE`/`UPDATE`/`DELETE`, `affectedTable = 'knowledge_documents'`) com `oldData`/`newData` sem conteúdo do arquivo (FR-022). Consultas não geram auditoria própria: o histórico imutável cumpre esse papel.
