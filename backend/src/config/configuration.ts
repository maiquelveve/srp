import 'dotenv/config';

export interface AppConfig {
  port: number;
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  corsAllowedOrigins: string[];
  inviteTokenExpiresIn: string;
  throttle: {
    ttlMs: number;
    limit: number;
    loginLimit: number;
  };
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    from: string;
  };
  documents: {
    storagePath: string;
    maxFileSizeMb: number;
  };
  ai: {
    /** Qual implementação de EmbeddingProvider usar: 'ollama' | 'openai' (validado na factory). */
    embeddingProvider: string;
    /** Qual implementação de ChatProvider usar: 'ollama' | 'openai' | 'claude' (validado na factory). */
    chatProvider: string;
    /** Tamanho do vetor de embedding; precisa ser igual ao da coluna vector(N) no banco. */
    embeddingDimensions: number;
    embeddingTimeoutMs: number;
    chatTimeoutMs: number;
    /** Quantos textos vão por chamada ao gerar embeddings de vários trechos. */
    embeddingBatchSize: number;
    ollama: {
      baseUrl: string;
      embeddingModel: string;
      chatModel: string;
      /** Janela de contexto do chat; sem isso o Ollama trunca em silêncio os trechos enviados. */
      chatNumCtx: number;
    };
    openai: {
      apiKey: string;
      baseUrl: string;
      embeddingModel: string;
      chatModel: string;
    };
    anthropic: {
      apiKey: string;
      baseUrl: string;
      chatModel: string;
    };
  };
  knowledge: {
    storagePath: string;
    /** Similaridade mínima (0 a 1, cosseno) para um trecho contar como relevante. */
    minSimilarity: number;
    /** Consultas por usuário por minuto. */
    queryRateLimit: number;
    questionMaxLength: number;
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export default (): AppConfig => ({
  port: Number(process.env.PORT ?? 3000),
  jwt: {
    accessSecret: requireEnv('JWT_SECRET'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: requireEnv('JWT_REFRESH_SECRET'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  inviteTokenExpiresIn: process.env.INVITE_TOKEN_EXPIRES_IN ?? '24h',
  // Requests per client IP per window; raised only for load tests, where k6 sends everything from one IP.
  throttle: {
    ttlMs: Number(process.env.THROTTLE_TTL_MS ?? 60_000),
    limit: Number(process.env.THROTTLE_LIMIT ?? 100),
    // Brute-force guard on POST /auth/login, per client IP per window.
    loginLimit: Number(process.env.THROTTLE_LOGIN_LIMIT ?? 5),
  },
  // Senha inicial/reset por e-mail (research.md #6, feature 002).
  smtp: {
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? '',
    password: process.env.SMTP_PASSWORD ?? '',
    from: process.env.SMTP_FROM ?? 'no-reply@srp.rs.gov.br',
  },
  // Biblioteca de documentos (research.md #4, #8, feature 002).
  documents: {
    storagePath: process.env.DOCUMENTS_STORAGE_PATH ?? './storage/documents',
    maxFileSizeMb: Number(process.env.DOCUMENTS_MAX_FILE_SIZE_MB ?? 10),
  },
  // Camada de provedores de IA da base de conhecimento (research.md #4 a #6, feature 003).
  ai: {
    embeddingProvider: process.env.EMBEDDING_PROVIDER ?? 'ollama',
    chatProvider: process.env.CHAT_PROVIDER ?? 'ollama',
    embeddingDimensions: Number(process.env.EMBEDDING_DIMENSIONS ?? 1024),
    embeddingTimeoutMs: Number(process.env.AI_EMBEDDING_TIMEOUT_MS ?? 30_000),
    chatTimeoutMs: Number(process.env.AI_CHAT_TIMEOUT_MS ?? 60_000),
    embeddingBatchSize: Number(process.env.AI_EMBEDDING_BATCH_SIZE ?? 16),
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
      embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL ?? 'bge-m3',
      chatModel: process.env.OLLAMA_CHAT_MODEL ?? 'qwen2.5:7b-instruct',
      chatNumCtx: Number(process.env.OLLAMA_CHAT_NUM_CTX ?? 8192),
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY ?? '',
      baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com',
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
      chatModel: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY ?? '',
      baseUrl: process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com',
      chatModel: process.env.ANTHROPIC_CHAT_MODEL ?? 'claude-sonnet-5-5',
    },
  },
  // Base de conhecimento (research.md #10, #11, feature 003).
  knowledge: {
    storagePath: process.env.KNOWLEDGE_STORAGE_PATH ?? './storage/knowledge',
    minSimilarity: Number(process.env.KNOWLEDGE_MIN_SIMILARITY ?? 0.45),
    queryRateLimit: Number(process.env.KNOWLEDGE_QUERY_RATE_LIMIT ?? 10),
    questionMaxLength: Number(process.env.KNOWLEDGE_QUESTION_MAX_LENGTH ?? 1000),
  },
});
