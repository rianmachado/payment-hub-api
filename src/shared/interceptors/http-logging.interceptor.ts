import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';

type RequestWithCorrelationId = Request & { correlationId?: string };

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpLoggingInterceptor.name);
  private readonly serviceName = process.env.SERVICE_NAME ?? 'payment-hub-api';
  private readonly environment = process.env.NODE_ENV ?? 'development';
  private readonly version = process.env.npm_package_version ?? '0.0.0';

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = Date.now();
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<RequestWithCorrelationId>();
    const response = httpContext.getResponse<Response>();

    let capturedError: unknown;
    let hasLogged = false;
    const logWhenResponseFinishes = (): void => {
      if (hasLogged) {
        return;
      }

      hasLogged = true;
      const payload = this.buildLogPayload(
        request,
        response.statusCode,
        Date.now() - startedAt,
        capturedError,
      );

      if (capturedError) {
        this.logger.error(JSON.stringify(payload));
        return;
      }

      this.logger.log(JSON.stringify(payload));
    };

    response.once('finish', logWhenResponseFinishes);
    response.once('close', logWhenResponseFinishes);

    return new Observable((subscriber) => {
      const streamSubscription = next.handle().subscribe({
        next: (value) => subscriber.next(value),
        error: (error: unknown) => {
          capturedError = error;
          subscriber.error(error);
        },
        complete: () => subscriber.complete(),
      });

      return () => {
        streamSubscription.unsubscribe();
      };
    });
  }

  private buildLogPayload(
    request: RequestWithCorrelationId,
    statusCode: number,
    durationMs: number,
    error?: unknown,
  ): Record<string, string | number> {
    const payload: Record<string, string | number> = {
      message: 'HTTP request completed',
      service: this.serviceName,
      environment: this.environment,
      version: this.version,
      correlationId: request.correlationId ?? 'n/a',
      httpMethod: request.method,
      path: request.originalUrl || request.url,
      statusCode,
      durationMs,
    };

    const idempotencyKey = request.header('idempotency-key')?.trim();
    if (idempotencyKey) {
      payload.idempotencyKey = idempotencyKey;
    }

    if (error instanceof Error) {
      payload.errorName = error.name;
      payload.errorMessage = error.message;
    }

    return payload;
  }
}
