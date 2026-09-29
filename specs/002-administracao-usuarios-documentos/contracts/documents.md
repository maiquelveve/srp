# Contract: Biblioteca de Documentos (`/api/v1/documents`, `/api/v1/document-types`)

Todo endpoint exige `Authorization: Bearer <access_token>` válido (qualquer perfil autenticado),
exceto onde indicado.

| Método | Rota | Perfis | Descrição |
|---|---|---|---|
| GET | `/api/v1/document-types` | qualquer autenticado | Lista as 3 categorias fixas (Formulários, Modelos de Documentos, Manuais), para montar o menu (FR-009). |
| GET | `/api/v1/documents?documentTypeId=` | qualquer autenticado | Lista documentos de uma categoria, mais recente primeiro (FR-011). |
| GET | `/api/v1/documents/:id/download` | qualquer autenticado | Baixa o arquivo (streaming), nomeado com `originalFileName` (FR-011). |
| POST | `/api/v1/documents` | WARDEN, SUPERVISOR | Envia um novo documento (`multipart/form-data`: `file`, `name`, `documentTypeId`) (FR-010). |
| DELETE | `/api/v1/documents/:id` | WARDEN, SUPERVISOR | Remove definitivamente um documento (FR-012). |

## Regras

- `POST /documents` e `DELETE /documents/:id` MUST responder `403` para o perfil `PRISON_OFFICER`
  (FR-012).
- `POST /documents` MUST responder `400` se a extensão do arquivo não for `.docx`, `.doc`, `.txt`
  ou `.pdf` (FR-013), ou se o conteúdo real do arquivo (assinatura) não corresponder a um desses 4
  formatos — inclusive quando a extensão foi trocada para simular um formato aceito (FR-013a,
  research.md #3).
- `POST /documents` MUST responder `413` se o arquivo exceder `DOCUMENTS_MAX_FILE_SIZE_MB`
  (FR-014, research.md #4).
- `POST /documents` MUST responder `409` se já existir um documento com o mesmo `name` na mesma
  `documentTypeId` (FR-010a, constraint de banco — research.md #9).
- `GET /documents/:id/download` MUST responder `401`/`403` para requisição sem token válido —
  nenhum link de download funciona sem autenticação (Edge Case do spec.md).
- Toda chamada bem-sucedida a `POST /documents` e `DELETE /documents/:id` MUST gerar uma entrada
  de auditoria (`AuditAction.INSERT`/`AuditAction.DELETE` respectivamente) (FR-020).

## Exemplo — GET /api/v1/document-types

Response 200:
```json
[
  { "id": 1, "code": "FORM", "label": "Formulários" },
  { "id": 2, "code": "TEMPLATE", "label": "Modelos de Documentos" },
  { "id": 3, "code": "MANUAL", "label": "Manuais" }
]
```

## Exemplo — GET /api/v1/documents?documentTypeId=1

Response 200:
```json
[
  {
    "id": 8,
    "name": "Portaria de Transferência",
    "originalFileName": "portaria-transferencia.pdf",
    "sizeBytes": 245678,
    "documentTypeId": 1,
    "createdAt": "2026-09-29T12:00:00.000Z"
  }
]
```

## Exemplo — POST /api/v1/documents

Request (`multipart/form-data`):
```
file: <binário>
name: "Portaria de Transferência"
documentTypeId: 1
```

Response 201:
```json
{ "id": 8, "name": "Portaria de Transferência", "documentTypeId": 1 }
```

Response 400 (formato não permitido ou conteúdo não corresponde à extensão):
```json
{ "message": "Formato de arquivo não permitido. Envie DOCX, DOC, TXT ou PDF." }
```

Response 409 (nome duplicado na mesma categoria):
```json
{ "message": "Já existe um documento com esse nome nesta categoria" }
```
