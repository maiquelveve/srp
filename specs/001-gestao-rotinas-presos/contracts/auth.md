# Contract: Autenticação (`/api/v1/auth`)

Base para todos os outros contratos: todo endpoint listado nos demais arquivos de `contracts/`
exige um `Authorization: Bearer <access_token>` válido, exceto os desta seção. O corpo do JWT
(`access_token`) carrega `sub` (usuario_id), `perfil` e `unidades: number[]` (FR-004a).

| Método | Rota | Perfis | Descrição |
|---|---|---|---|
| POST | `/api/v1/auth/login` | público | Autentica com email/senha; retorna `access_token` (curta duração) e `refresh_token`. |
| POST | `/api/v1/auth/refresh` | autenticado (refresh token) | Troca um `refresh_token` válido por um novo par de tokens. |
| POST | `/api/v1/auth/logout` | autenticado | Revoga o `refresh_token` atual; gera log de auditoria (`acao=LOGOUT`). |

## Regras

- Falha de autenticação MUST responder `401` sem revelar se o e-mail existe (mensagem genérica).
- Toda tentativa de login (sucesso ou falha) e todo logout MUST gerar log de auditoria
  (`docs/srp_plan.md` — "Registrar automaticamente: login, logout").
- Rate limiting (`@nestjs/throttler`) aplicado especificamente em `/auth/login` para mitigar força
  bruta (research.md #7).

## Exemplo — POST /api/v1/auth/login

Request:
```json
{ "email": "policial@srp.rs.gov.br", "senha": "..." }
```

Response 200:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "usuario": { "id": 1, "nome": "...", "perfil": "POLICIAL_PENAL", "unidades": [3] }
}
```

Response 401:
```json
{ "message": "Credenciais inválidas" }
```
