# Contract: Autenticação (`/api/v1/auth`)

Base para todos os outros contratos: todo endpoint listado nos demais arquivos de `contracts/`
exige um `Authorization: Bearer <access_token>` válido, exceto os desta seção. O corpo do JWT
(`access_token`) carrega `sub` (userId), `role` e `units: number[]` (FR-004a).

| Método | Rota | Perfis | Descrição |
|---|---|---|---|
| POST | `/api/v1/auth/login` | público | Autentica com email/senha; retorna `accessToken` (curta duração) e `refreshToken`. |
| POST | `/api/v1/auth/refresh` | autenticado (refresh token) | Troca um `refreshToken` válido por um novo par de tokens (rotação — o token antigo é revogado). |
| POST | `/api/v1/auth/logout` | autenticado | Revoga o `refreshToken` atual; gera log de auditoria (`action=LOGOUT`). |
| POST | `/api/v1/auth/set-initial-password` | público (requer `inviteToken` válido) | Resgata o convite gerado por `POST /api/v1/users` (research.md #10) e define a senha do usuário recém-criado. |

## Regras

- Falha de autenticação MUST responder `401` sem revelar se o e-mail existe (mensagem genérica).
- Toda tentativa de login (sucesso ou falha) e todo logout MUST gerar log de auditoria
  (`docs/srp_plan.md` — "Registrar automaticamente: login, logout").
- Rate limiting (`@nestjs/throttler`) aplicado especificamente em `/auth/login` para mitigar força
  bruta (research.md #7).
- `refreshToken` é persistido como hash (`refresh_tokens.token_hash`) no backend; `/auth/refresh`
  e `/auth/logout` MUST validar contra essa tabela e rejeitar (`401`) tokens desconhecidos,
  expirados ou já revogados (research.md #11).
- `inviteToken` (usado por `/auth/set-initial-password`) MUST ser de uso único, expirar em curto
  prazo (ex.: 24h) e nunca ser aceito novamente após o primeiro uso bem-sucedido (`409` em reuso).

## Exemplo — POST /api/v1/auth/set-initial-password

Request:
```json
{ "inviteToken": "eyJ...", "password": "..." }
```

Response 200:
```json
{ "message": "Senha definida com sucesso" }
```

Response 409 (token já utilizado ou expirado):
```json
{ "message": "Convite inválido ou expirado" }
```

## Exemplo — POST /api/v1/auth/login

Request:
```json
{ "email": "policial@srp.rs.gov.br", "password": "..." }
```

Response 200:
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": { "id": 1, "name": "...", "role": "PRISON_OFFICER", "units": [3] }
}
```

Response 401:
```json
{ "message": "Credenciais inválidas" }
```

## Exemplo — POST /api/v1/auth/logout

Request:
```json
{ "refreshToken": "eyJ..." }
```

Response 200:
```json
{ "message": "Sessão encerrada" }
```
