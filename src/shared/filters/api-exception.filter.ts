import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';

type ErrorResponsePayload = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  correlationId: string;
};

type StandardErrorBody = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    const correlationId = this.resolveCorrelationId(request);
    const status = this.resolveHttpStatus(exception);
    const payload = this.resolvePayload(exception, status, correlationId);

    response.setHeader('X-Correlation-Id', correlationId);
    response.status(status).json(payload);
  }

  private resolveCorrelationId(request: Request): string {
    const headerValue = request.headers['x-correlation-id'];
    const rawValue = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const normalizedValue = rawValue?.trim();

    return normalizedValue && normalizedValue.length > 0 ? normalizedValue : randomUUID();
  }

  private resolveHttpStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolvePayload(
    exception: unknown,
    status: number,
    correlationId: string,
  ): ErrorResponsePayload {
    if (exception instanceof BadRequestException) {
      return this.handleBadRequestException(exception, correlationId);
    }

    if (exception instanceof HttpException) {
      const responseBody = exception.getResponse();
      if (this.hasStandardErrorBody(responseBody)) {
        return this.buildStandardPayload(responseBody, correlationId);
      }

      const fallbackMessage =
        typeof responseBody === 'string' ? responseBody : this.defaultMessageByStatus(status);

      return {
        code: this.defaultCodeByStatus(status),
        message: fallbackMessage,
        correlationId,
      };
    }

    return {
      code: 'INTERNAL_ERROR',
      message: this.isProduction()
        ? 'Ocorreu um erro interno no servidor.'
        : this.getUnknownErrorMessage(exception),
      correlationId,
    };
  }

  private handleBadRequestException(
    exception: BadRequestException,
    correlationId: string,
  ): ErrorResponsePayload {
    const responseBody = exception.getResponse();

    if (this.hasStandardErrorBody(responseBody)) {
      return this.buildStandardPayload(responseBody, correlationId);
    }

    if (this.isValidationErrorResponse(responseBody)) {
      return {
        code: 'PAYMENT_VALIDATION_ERROR',
        message: 'Dados de pagamento invalidos.',
        details: {
          fieldErrors: this.mapValidationErrors(responseBody.message),
        },
        correlationId,
      };
    }

    return {
      code: 'PAYMENT_VALIDATION_ERROR',
      message: this.defaultMessageFromUnknownHttpBody(responseBody, HttpStatus.BAD_REQUEST),
      correlationId,
    };
  }

  private defaultCodeByStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'PAYMENT_VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'AUTH_TOKEN_INVALID';
      case HttpStatus.FORBIDDEN:
        return 'AUTH_INSUFFICIENT_PERMISSION';
      case HttpStatus.NOT_FOUND:
        return 'PAYMENT_NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'PAYMENT_IDEMPOTENCY_CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'PAYMENT_BUSINESS_RULE_VIOLATION';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMIT_EXCEEDED';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'SERVICE_UNAVAILABLE';
      default:
        return 'INTERNAL_ERROR';
    }
  }

  private defaultMessageByStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'Dados de pagamento invalidos.';
      case HttpStatus.UNAUTHORIZED:
        return 'Nao autenticado.';
      case HttpStatus.FORBIDDEN:
        return 'Acesso negado.';
      case HttpStatus.NOT_FOUND:
        return 'Pagamento nao encontrado.';
      case HttpStatus.CONFLICT:
        return 'Conflito de idempotencia com requisicao anterior.';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'Pagamento nao autorizado pelas regras de negocio.';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'Limite de requisicoes excedido.';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'Servico indisponivel.';
      default:
        return 'Ocorreu um erro interno no servidor.';
    }
  }

  private defaultMessageFromUnknownHttpBody(responseBody: unknown, status: number): string {
    if (typeof responseBody === 'string') {
      return responseBody;
    }

    if (responseBody && typeof responseBody === 'object' && 'message' in responseBody) {
      const message = (responseBody as { message?: unknown }).message;
      if (typeof message === 'string') {
        return message;
      }
    }

    return this.defaultMessageByStatus(status);
  }

  private getUnknownErrorMessage(exception: unknown): string {
    if (exception instanceof Error && exception.message) {
      return exception.message;
    }

    return 'Ocorreu um erro interno no servidor.';
  }

  private hasStandardErrorBody(
    responseBody: unknown,
  ): responseBody is StandardErrorBody {
    return Boolean(
      responseBody &&
        typeof responseBody === 'object' &&
        'code' in responseBody &&
        typeof (responseBody as { code?: unknown }).code === 'string' &&
        'message' in responseBody &&
        typeof (responseBody as { message?: unknown }).message === 'string',
    );
  }

  private isValidationErrorResponse(
    responseBody: unknown,
  ): responseBody is { message: string[]; error: string; statusCode: number } {
    return Boolean(
      responseBody &&
        typeof responseBody === 'object' &&
        'message' in responseBody &&
        Array.isArray((responseBody as { message?: unknown }).message),
    );
  }

  private isProduction(): boolean {
    return (process.env.NODE_ENV ?? 'development') === 'production';
  }

  private buildStandardPayload(
    responseBody: StandardErrorBody,
    correlationId: string,
  ): ErrorResponsePayload {
    return {
      code: responseBody.code,
      message: responseBody.message,
      details: responseBody.details,
      correlationId,
    };
  }

  private mapValidationErrors(messages: string[]): Array<{ error: string; field?: string }> {
    return messages.map((errorMessage) => {
      const fieldMatch = /^([a-zA-Z0-9_.[\]]+)\s+/.exec(errorMessage.trim());
      if (!fieldMatch) {
        return { error: errorMessage };
      }

      return {
        field: fieldMatch[1],
        error: errorMessage,
      };
    });
  }
}
