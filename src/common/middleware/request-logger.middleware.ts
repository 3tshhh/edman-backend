import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggerMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const startedAt = Date.now();

    const forwardedFor = req.headers['x-forwarded-for'];
    const clientIp =
      typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0]?.trim()
        : req.ip;

    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      const contentLength = res.getHeader('content-length');
      const safeHeaders = {
        ...req.headers,
        authorization: req.headers.authorization ? '[REDACTED]' : undefined,
      };

      this.logger.log(
        JSON.stringify({
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          ip: clientIp,
          userAgent: req.get('user-agent') ?? null,
          referer: req.get('referer') ?? null,
          contentLength: contentLength ? Number(contentLength) : null,
          durationMs,
          query: req.query,
          params: req.params,
          body: req.body,
          headers: safeHeaders,
        }),
      );
    });

    next();
  }
}
