# Contract: Troca da Própria Senha (`/api/v1/auth`)

Estende `contracts/auth.md` da feature 001 (login, refresh, logout, set-initial-password).

| Método | Rota | Perfis | Descrição |
|---|---|---|---|
| PATCH | `/api/v1/auth/change-password` | autenticado (qualquer perfil) | Troca a própria senha, informando a senha atual (FR-016). |

## Regras

- Exige `currentPassword`, `newPassword` e `refreshToken` (o refresh token do dispositivo atual,
  usado para preservar a sessão corrente — research.md #1).
- Responde `401` se `currentPassword` não corresponder à senha atual do usuário autenticado
  (FR-017) — sem alterar nada.
- Responde `400` se `newPassword` não atender a política de senha (mesma regra de
  `set-initial-password`, research.md #7).
- `newPassword` == `currentPassword` MUST ser aceito (nenhuma regra do spec proíbe reescolher a
  mesma senha); não há verificação extra além da política padrão.
- Em caso de sucesso: MUST revogar todos os demais refresh tokens do usuário, exceto o informado
  em `refreshToken` (FR-017a, research.md #1); MUST gerar entrada de auditoria
  (`AuditAction.UPDATE`, sem incluir a senha em `oldData`/`newData`, só a marca de que foi trocada).
- Responde `401` se o `refreshToken` informado não pertencer ao usuário autenticado ou já estiver
  revogado/expirado (mesma validação de `POST /auth/refresh`).

## Exemplo — PATCH /api/v1/auth/change-password

Request:
```json
{
  "currentPassword": "...",
  "newPassword": "...",
  "refreshToken": "eyJ..."
}
```

Response 200:
```json
{ "message": "Senha alterada com sucesso" }
```

Response 401 (senha atual incorreta):
```json
{ "message": "Senha atual incorreta" }
```

Response 400 (nova senha não atende a política):
```json
{ "message": "A senha deve ter no mínimo 8 caracteres" }
```
