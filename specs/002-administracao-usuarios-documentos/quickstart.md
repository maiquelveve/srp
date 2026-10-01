# Quickstart: Administração de Usuários e Documentos

Guia para validar, de ponta a ponta, que o sistema atende às User Stories de
[spec.md](./spec.md). Referências de endpoint em [contracts/](./contracts/), modelo de dados em
[data-model.md](./data-model.md).

## Pré-requisitos

- Ambiente da feature 001 já rodando (PostgreSQL com schema aplicado, backend, frontend web) —
  ver `specs/001-gestao-rotinas-presos/quickstart.md` para o seed base (Unit, Gallery, Cells,
  1 Usuário por Role).
- Migration desta fase aplicada (`typeorm migration:run`), incluindo o seed das 3
  `DocumentType` fixas (`FORM`, `TEMPLATE`, `MANUAL`).
- `.env` do backend com as variáveis novas configuradas: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
  `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `DOCUMENTS_STORAGE_PATH`,
  `DOCUMENTS_MAX_FILE_SIZE_MB` (research.md #4, #6, #8). Para validação local sem SMTP real,
  usar um servidor de teste (ex.: Mailhog/Mailpit) e apontar `SMTP_HOST`/`SMTP_PORT` para ele.
- Um segundo usuário com perfil `WARDEN` no seed (além do já existente), para exercitar os
  cenários que proíbem autogestão (FR-008a) sem travar o ambiente de teste.
- `mobile/` não participa desta fase (FR-019) — nenhum cenário aqui usa o app móvel.

## Cenário 1 — Administração de Usuários (User Story 1)

1. Login como `WARDEN` A (`POST /api/v1/auth/login`).
2. `POST /api/v1/users` cadastrando um novo `PRISON_OFFICER` vinculado à Unit do seed.
   **Esperado**: `201`; se o servidor SMTP de teste estiver acessível, o e-mail com a senha inicial
   chega à caixa configurada; `emailDelivered: true` na resposta.
3. `PATCH /api/v1/users/:id` no usuário criado, alterando `jobTitle` e promovendo `role` para
   `SUPERVISOR`. **Esperado**: `200`; `GET /api/v1/users` mostra os novos dados.
4. `PATCH /api/v1/users/:id/deactivate`, depois `PATCH /api/v1/users/:id/reactivate`.
   **Esperado**: `200` nos dois; login do usuário falha (`401`) só entre os dois passos.
5. `PUT /api/v1/users/:id/units` trocando para outra Unit do seed. **Esperado**: `200`;
   `GET /api/v1/users` mostra só a nova unidade.
6. `POST /api/v1/users/:id/units` somando uma unidade adicional. **Esperado**: `200`;
   `GET /api/v1/users` mostra as duas unidades (a do passo 5 + a nova).
7. `PATCH /api/v1/users/:id/reset-password`. **Esperado**: `200`; um novo e-mail chega com senha
   temporária; um access/refresh token emitido para esse usuário antes do reset passa a responder
   `401` em qualquer rota autenticada e em `POST /api/v1/auth/refresh` (FR-007, research.md #1).
8. Repetir os passos usando `:id` = o próprio `WARDEN` A autenticado (FR-008a cobre exatamente 4
   ações sobre a própria conta — as demais são permitidas):
   - Passo 3 (editar) mudando o `role`: `403`. Repetir só mudando `jobTitle` (sem tocar `role`):
     `200` — editar a própria conta é permitido fora da troca de perfil.
   - Passo 4, a metade "desativar": `403`. ("Reativar" não é restrito, mas fica inalcançável
     porque o próprio usuário nunca chega a ficar inativo.)
   - Passo 5 (trocar lotação) e passo 6 (adicionar lotação): `403` nos dois.
   - Passo 7 (resetar a própria senha): `200` — reset de senha sobre a própria conta é permitido
     (FR-008a não cobre esse caso).
9. Repetir o passo 3 autenticado como `SUPERVISOR` ou `PRISON_OFFICER`. **Esperado**: `403`
   (FR-008).
10. Derrubar o SMTP de teste e repetir o passo 2 ou o passo 7. **Esperado**: a operação ainda
    responde `200`/`201` com `emailDelivered: false`; `POST /api/v1/users/:id/resend-password-email`
    (com o SMTP de volta) entrega o e-mail pendente (FR-002a, FR-007a).

## Cenário 2 — Biblioteca de Documentos (User Story 2)

1. Login como `WARDEN` (`POST /api/v1/auth/login`).
2. `GET /api/v1/document-types`. **Esperado**: as 3 categorias fixas (FORM/TEMPLATE/MANUAL).
3. `POST /api/v1/documents` enviando um PDF pequeno com `documentTypeId` da categoria Formulários.
   **Esperado**: `201`; `GET /api/v1/documents?documentTypeId=<id>` lista o documento.
4. `GET /api/v1/documents/:id/download`. **Esperado**: `200`, corpo = bytes do arquivo enviado,
   nome de download igual ao `originalFileName`.
5. Repetir o passo 3 com um arquivo `.exe` renomeado para `.pdf` (mesmo conteúdo binário, extensão
   trocada). **Esperado**: `400` — a verificação de assinatura rejeita mesmo com extensão correta
   (FR-013a, research.md #3).
6. Repetir o passo 3 com o mesmo `name` e `documentTypeId` do passo 3. **Esperado**: `409`
   (FR-010a).
7. Repetir o passo 3 autenticado como `PRISON_OFFICER`. **Esperado**: `403` (FR-012).
8. Autenticado como `PRISON_OFFICER`, repetir os passos 2 e 4. **Esperado**: `200` nos dois —
   qualquer perfil autenticado consulta e baixa (FR-011).
9. `GET /api/v1/documents/:id/download` sem `Authorization`. **Esperado**: `401`.
10. `DELETE /api/v1/documents/:id` (do documento criado no passo 3) como `WARDEN` ou `SUPERVISOR`.
    **Esperado**: `200`; o passo 4 repetido depois retorna `404`.

## Cenário 3 — Troca de Senha pelo Próprio Usuário (User Story 3)

1. Login como qualquer usuário (`PRISON_OFFICER`, `SUPERVISOR` ou `WARDEN`), guardando
   `accessToken` e `refreshToken` de duas sessões diferentes (ex.: dois logins seguidos,
   simulando dois dispositivos).
2. `PATCH /api/v1/auth/change-password` na sessão 1, informando a senha atual correta, uma nova
   senha e o `refreshToken` da sessão 1. **Esperado**: `200`.
3. Tentar `POST /api/v1/auth/refresh` com o `refreshToken` da sessão 2. **Esperado**: `401` — a
   troca de senha revogou a outra sessão (FR-017a, research.md #1).
4. Tentar `POST /api/v1/auth/refresh` com o `refreshToken` da sessão 1 (o informado no passo 2).
   **Esperado**: `200` — a sessão atual continua válida.
5. Repetir o passo 2 informando a senha atual errada. **Esperado**: `400` (não `401` — a
   requisição está autenticada; o problema é `currentPassword` não bater, mesmo raciocínio de
   `contracts/auth.md`), senha não alterada (confirmar tentando logar com a senha antiga: ainda
   funciona).
6. Repetir o passo 2 com `newPassword` menor que 8 caracteres. **Esperado**: `400`.
7. No frontend web, abrir a tela de login e o modal de troca de senha (pelo ícone de engrenagem em
   `/perfil`): clicar no ícone de mostrar senha em cada campo de senha. **Esperado**: o conteúdo
   alterna entre oculto e texto simples (FR-018) — validação manual visual, sem endpoint associado.

## Fora de escopo desta validação

- Qualquer fluxo no aplicativo móvel (FR-019) — não há tela ou endpoint destas 3 User Stories
  acessível por lá.
- Versionamento de documento (reenvio de uma nova versão do mesmo arquivo) — spec.md → Assumptions
  define que não há suporte nesta fase; atualizar um documento é remover e enviar de novo.
