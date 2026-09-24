import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

/**
 * Keeps the OpenAPI document complete (T076, Constitution X): every `/api/v1`
 * operation must have a summary, and every endpoint that needs a login must
 * document the 401 response. Uses the explicit decorators only (the Swagger
 * CLI plugin does not run under ts-jest), so this fails when a new endpoint
 * is added without `@ApiOperation`.
 */
describe('OpenAPI document', () => {
  let app: INestApplication;
  let operations: { method: string; path: string; summary?: string; responses: string[] }[];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    operations = Object.entries(document.paths).flatMap(([path, item]) =>
      Object.entries(item).map(([method, operation]) => ({
        method,
        path,
        summary: (operation as { summary?: string }).summary,
        responses: Object.keys((operation as { responses?: object }).responses ?? {}),
      })),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('documents every /api/v1 endpoint', () => {
    expect(operations.length).toBeGreaterThanOrEqual(54);
    expect(operations.every((operation) => operation.path.startsWith('/api/v1/'))).toBe(true);
  });

  it('gives every operation a summary', () => {
    const withoutSummary = operations
      .filter((operation) => !operation.summary)
      .map((operation) => `${operation.method} ${operation.path}`);
    expect(withoutSummary).toEqual([]);
  });

  it('documents 401 and 403 on every endpoint behind a login', () => {
    const publicPaths = [
      '/api/v1/health',
      '/api/v1/auth/login',
      '/api/v1/auth/refresh',
      '/api/v1/auth/logout',
      '/api/v1/auth/set-initial-password',
    ];
    const missing = operations
      .filter((operation) => !publicPaths.includes(operation.path))
      .filter(
        (operation) => !operation.responses.includes('401') || !operation.responses.includes('403'),
      )
      .map((operation) => `${operation.method} ${operation.path}`);
    expect(missing).toEqual([]);
  });
});
