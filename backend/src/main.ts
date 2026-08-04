import 'reflect-metadata';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  const corsAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsAllowedOrigins.length > 0 ? corsAllowedOrigins : false,
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SRP API')
    .setDescription('Sistema de Rotinas Penitenciárias — API REST')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/v1/docs', app, swaggerDocument);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

void bootstrap();
