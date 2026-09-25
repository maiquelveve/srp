import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  /** Dados estruturados opcionais de uma exceção (ex.: rotinas sobrepostas para o cliente exibir). */
  details?: unknown;
  path: string;
  timestamp: string;
}

/**
 * Consistent error shape across every module (Constitution VII) — never leaks
 * stack traces or internal details for unhandled (5xx) errors.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = isHttpException ? this.extractMessage(exception) : 'Internal server error';

    if (!isHttpException) {
      this.logger.error(exception);
    }

    const body: ErrorResponseBody = {
      statusCode,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    const details = isHttpException ? this.extractDetails(exception) : undefined;
    if (details !== undefined) {
      body.details = details;
    }

    response.status(statusCode).json(body);
  }

  private extractDetails(exception: HttpException): unknown {
    const response = exception.getResponse();
    return typeof response === 'string' ? undefined : (response as { details?: unknown }).details;
  }

  private extractMessage(exception: HttpException): string | string[] {
    const response = exception.getResponse();
    if (typeof response === 'string') {
      return response;
    }
    const maybeMessage = (response as { message?: string | string[] }).message;
    return maybeMessage ?? exception.message;
  }
}
