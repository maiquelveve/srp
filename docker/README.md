# Docker Compose stacks

Cada stack de infraestrutura local vive na sua própria subpasta aqui, com o
`docker-compose.yml` e o `.env`/`.env.example` correspondentes juntos —
nunca soltos na raiz do repositório.

```
docker/
├── postgres/
│   ├── docker-compose.yml
│   ├── .env            # gitignored — valores reais
│   └── .env.example    # versionado — documenta as variáveis
├── ollama/             # IA local (chat e embeddings) da base de conhecimento
│   ├── docker-compose.yml
│   └── .env.example
└── <novo-stack>/
    ├── docker-compose.yml
    └── .env(.example)
```

## Convenção para novos stacks

Ao adicionar um novo `docker-compose.yml` (ex.: Redis, MinIO, mailhog):

1. Criar `docker/<nome-do-stack>/`.
2. Colocar o `docker-compose.yml` e o `.env.example` ali dentro.
3. Nunca commitar o `.env` real — só o `.env.example`.

## Como rodar

```bash
cd docker/postgres
docker compose up -d
```

O Compose carrega o `.env` automaticamente por estar na mesma pasta do
`docker-compose.yml`.

**Nota**: as credenciais aqui (`docker/postgres/.env`) e as do backend
(`backend/.env`) são arquivos separados e precisam ser mantidas coerentes
manualmente por enquanto — ver discussão no histórico do projeto sobre as
opções de unificação avaliadas e adiadas.

## PostgreSQL com pgvector (feature 003)

O serviço `postgres` usa a imagem `pgvector/pgvector:pg16`, que é o PostgreSQL 16
com a extensão `vector` (busca por similaridade) já instalada. Ela é baseada em
Debian; a imagem anterior (`postgres:16-alpine`) era Alpine. Os dois sistemas
ordenam texto de forma diferente, então **não reaproveite um volume criado pela
imagem antiga sem cuidado**: índices de texto podem ficar inconsistentes.

Para trocar com segurança, escolha uma das opções:

```bash
# Opção 1: dump e restore (preserva os dados)
docker exec srp-postgres pg_dumpall -U "$POSTGRES_USER" > /tmp/srp-dump.sql
cd docker/postgres && docker compose down -v      # apaga o volume antigo
docker compose up -d                              # sobe com a imagem nova
docker exec -i srp-postgres psql -U "$POSTGRES_USER" < /tmp/srp-dump.sql

# Opção 2: banco novo (ambiente de dev; perde os dados)
cd docker/postgres && docker compose down -v && docker compose up -d
cd ../../backend && npm run migration:run && npm run seed
```

## Ollama (IA local, feature 003)

```bash
cd docker/ollama
docker compose up -d
```

Sobe o servidor do Ollama na porta `11434` e, em seguida, um job de uma
execução (`ollama-pull`) baixa os dois modelos: o de embeddings (`bge-m3`) e o
de chat (`qwen2.5:7b-instruct`). A primeira vez baixa alguns GB; acompanhe com
`docker compose logs -f ollama-pull`. Os modelos ficam no volume
`srp-ollama-models`, então não são baixados de novo. Para conferir:
`curl localhost:11434/api/tags`.

Sem GPU o Ollama usa a CPU: funciona, mas cada resposta leva dezenas de segundos.
