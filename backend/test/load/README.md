# Teste de carga da troca de turno (SC-004)

Script k6 que simula 200 usuários virtuais durante a troca de turno. Cada usuário faz login uma
vez e repete a consulta de presos (por galeria e por ID) e uma saída temporária com retorno.
Thresholds (falham a execução se não forem atendidos):

- `http_req_duration{phase:run}`: p(95) < 500 ms (SC-004), e o mesmo para cada etapa (`login`, `lookup`, `movement`)
- `http_req_failed{phase:run}`: menos de 1%
- `server_errors`: nenhuma resposta 5xx

## Como rodar

O teste escreve dados (galeria, celas, presos e movimentações). Rode só contra um banco descartável.

```bash
cd backend
npm run build
npm run pretest:integration        # recria srp_db_test com os dados de base
# Backend isolado, com os limites de requisição elevados: o k6 envia tudo de um único IP,
# e os padrões (100 requisições/min e 5 logins/min) responderiam 429.
PORT=3100 POSTGRES_DB=srp_db_test THROTTLE_LIMIT=1000000 THROTTLE_LOGIN_LIMIT=1000000 \
  CORS_ALLOWED_ORIGINS= node dist/main &

BASE_URL=http://localhost:3100/api/v1 k6 run test/load/shift-change.js
```

Variáveis opcionais do script: `BASE_URL`, `WARDEN_EMAIL`, `OFFICER_EMAIL`, `PASSWORD`, `UNIT_ID`,
`MOVEMENT_TYPE_ID`, `VUS` (padrão 200) e `HOLD_SECONDS` (padrão 90). Sem o binário do k6, use a
imagem `grafana/k6`. Ela não enxerga o `localhost` do WSL nem `host.docker.internal`; aponte `BASE_URL`
para o IP do WSL (`hostname -I`), que o container alcança:

```bash
docker run --rm -v "$PWD/test/load:/scripts" \
  -e BASE_URL=http://$(hostname -I | awk '{print $1}'):3100/api/v1 \
  grafana/k6 run /scripts/shift-change.js
```

Se o container não alcançar o backend, o `setup()` falha com "login failed" e os limites aparecem
como "✓" com `p(95)=0s`, porque não houve requisição nenhuma. Confira que `http_reqs` passa de
algumas dezenas.

## Último resultado (2026-09-24)

Ambiente: máquina de desenvolvimento com 16 núcleos; backend, PostgreSQL (Docker) e k6 no mesmo
computador; backend em modo de produção (`node dist/main`) sobre o banco `srp_db_test`.
Rampa de 30 s até 200 usuários, 90 s sustentados, 10 s de descida.

| Métrica | Resultado |
|---|---|
| Requisições no teste | 20.212, cerca de 149 por segundo |
| p95 geral (`phase:run`) | 23,4 ms |
| p95 login | 106 ms (200 logins concorrentes durante a rampa) |
| p95 consulta de presos | 11,9 ms |
| p95 movimentação (saída e retorno) | 27,9 ms |
| Requisições com falha | 0% |
| Respostas 5xx | 0 |
| Verificações (checks) | 19.760 de 19.760 |

Resultado: **SC-004 atendido neste ambiente**. Os números de produção dependem do servidor, do
banco e da rede reais; repita o teste no ambiente de destino antes de um go-live.

## Resultado após as mudanças de 2026-09-25 (T106, T107, T112)

Repetido depois de três mudanças que mexem no caminho quente: uma consulta `SELECT EXISTS` por
requisição autenticada (`JwtStrategy`, desativação imediata de usuário), o lock na linha do preso ao
registrar saída e o lock nas trocas e situações definitivas. Mesmo ambiente e mesmo roteiro do teste
anterior; k6 pela imagem `grafana/k6`.

| Métrica | Resultado |
|---|---|
| Requisições no teste | 20.184, cerca de 147 por segundo |
| p95 geral (`phase:run`) | 29,5 ms |
| p95 login | 96,3 ms |
| p95 consulta de presos | 17,8 ms |
| p95 movimentação (saída e retorno) | 33,6 ms |
| Requisições com falha | 0% |
| Respostas 5xx | 0 |
| Verificações (checks) | 19.732 de 19.732 |

Resultado: **SC-004 continua atendido**. O p95 geral subiu de 23,4 ms para 29,5 ms (o custo da
consulta extra e dos locks), bem abaixo do limite de 500 ms. Este teste não cobre troca de cela,
permuta nem situação definitiva; a contenção dos locks nesses fluxos não foi medida sob carga.
