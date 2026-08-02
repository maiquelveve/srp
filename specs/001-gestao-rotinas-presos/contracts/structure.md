# Contract: Cadastro e Mapa da Unidade (`/api/v1/units`, `/galleries`, `/cells`, `/inmates`)

Cobre User Story 1 (FR-005…FR-007). Todas as rotas exigem autenticação; escritas exigem perfil
`CHEFIA_DIRETOR` (FR-004), exceto onde indicado.

| Método | Rota | Perfis (escrita) | Descrição |
|---|---|---|---|
| GET | `/api/v1/units` | qualquer autenticado, escopado por FR-004a | Lista unidades acessíveis ao usuário. |
| POST | `/api/v1/units` | CHEFIA_DIRETOR | Cadastra unidade. |
| PATCH | `/api/v1/units/:id` | CHEFIA_DIRETOR | Atualiza unidade. |
| GET | `/api/v1/units/:id/galleries` | qualquer autenticado | Lista galerias de uma unidade. |
| POST | `/api/v1/galleries` | CHEFIA_DIRETOR | Cadastra galeria vinculada a uma unidade. |
| GET | `/api/v1/galleries/:id/cells` | qualquer autenticado | Lista celas de uma galeria, com ocupação atual. |
| POST | `/api/v1/cells` | CHEFIA_DIRETOR | Cadastra cela vinculada a uma galeria. |
| GET | `/api/v1/inmates?galleryId=&cellId=&status=` | qualquer autenticado | Lista presos filtrados por cela/galeria/unidade/status (FR-007). |
| GET | `/api/v1/inmates/:id` | qualquer autenticado | Detalhe de um preso, incluindo status atual. |
| POST | `/api/v1/inmates` | CHEFIA_DIRETOR | Cadastra preso (FR-006). |
| PATCH | `/api/v1/inmates/:id` | CHEFIA_DIRETOR | Atualiza dados cadastrais do preso (não altera status/cela — ver contracts/movements.md). |

## Regras

- Todas as respostas de listagem MUST ser filtradas pelo escopo de unidade do usuário autenticado
  (FR-004a), mesmo quando o cliente não envia filtro explícito.
- `POST/PATCH` em qualquer destas rotas MUST gerar log de auditoria (Constituição III).
- `POST /cells` MUST validar `capacidade >= 0`; ocupação corrente é calculada, não armazenada
  diretamente nesta entidade.

## Exemplo — GET /api/v1/inmates?cellId=42

Response 200:
```json
{
  "data": [
    {
      "id": 101,
      "nome": "...",
      "status": "ATIVO",
      "celaAtualId": 42,
      "emMovimentacao": false
    }
  ],
  "total": 1
}
```
