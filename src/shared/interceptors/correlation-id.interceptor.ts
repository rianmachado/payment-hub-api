import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';
import { Request, Response } from 'express';

type RequestWithCorrelationId = Request & { correlationId?: string };

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<RequestWithCorrelationId>();
    const response = httpContext.getResponse<Response>();

    const correlationId = this.resolveCorrelationId(request);
    request.correlationId = correlationId;
    response.setHeader('X-Correlation-Id', correlationId);

    return next.handle();
  }

  private resolveCorrelationId(request: Request): string {
    const headerValue = request.headers['x-correlation-id'];
    const rawValue = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const normalizedValue = rawValue?.trim();

    return normalizedValue && normalizedValue.length > 0 ? normalizedValue : randomUUID();
  }
}
