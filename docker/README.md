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
