import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * Logs method/path/status/duration for every request — separate from the
 * audit trail (audit_logs is business-event auditing, this is operational
 * logging; Constitution X).
 */
@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - start;
      this.logger.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
    });
    next();
  }
}
