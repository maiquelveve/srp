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
});
