import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  CREATE_PAYMENT_IDEMPOTENCY_SCOPE,
  IDEMPOTENCY_ERROR_CODE_CONFLICT,
  IDEMPOTENCY_ERROR_CODE_REQUIRED,
  IDEMPOTENCY_ERROR_CODE_VALIDATION,
  IDEMPOTENCY_KEY_MAX_LENGTH,
} from './idempotency.constants';
import { EvaluateIdempotencyInput, IdempotencyDecision } from './contracts/idempotency.types';
import { IDEMPOTENCY_STORE, IdempotencyStore } from './storage/idempotency-store.interface';

@Injectable()
export class IdempotencyService {
  constructor(
    @Inject(IDEMPOTENCY_STORE)
    private readonly store: IdempotencyStore,
  ) {}

  async evaluateCreatePayment(input: {
    clientScope: string;
    idempotencyKey: string | undefined;
    requestHash: string;
  }): Promise<IdempotencyDecision> {
    return this.evaluate({
      ...input,
      scope: CREATE_PAYMENT_IDEMPOTENCY_SCOPE,
    });
  }

  async registerCreatePaymentFirstCall(input: {
    clientScope: string;
    idempotencyKey: string;
    requestHash: string;
    paymentId: string;
  }): Promise<void> {
    const normalizedKey = this.validateIdempotencyKey(input.idempotencyKey);
    await this.store.saveFirstCall({
      ...input,
      idempotencyKey: normalizedKey,
      scope: CREATE_PAYMENT_IDEMPOTENCY_SCOPE,
    });

    // TODO(step-payment-service): persist responseStatusCode/responseBody once orchestration exists.
  }

  validateIdempotencyKey(idempotencyKey: string | undefined): string {
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new BadRequestException({
        code: IDEMPOTENCY_ERROR_CODE_REQUIRED,
        message: 'Cabecalho Idempotency-Key e obrigatorio para este recurso.',
      });
    }

    const normalizedKey = idempotencyKey.trim();

    if (normalizedKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      throw new BadRequestException({
        code: IDEMPOTENCY_ERROR_CODE_VALIDATION,
        message: 'Idempotency-Key excede o tamanho maximo permitido.',
        details: {
          field: 'Idempotency-Key',
          maxLength: IDEMPOTENCY_KEY_MAX_LENGTH,
        },
      });
    }

    return normalizedKey;
  }

  assertNoConflict(decision: IdempotencyDecision): void {
    if (decision.kind !== 'conflict') {
      return;
    }

    throw new ConflictException({
      code: IDEMPOTENCY_ERROR_CODE_CONFLICT,
      message: 'Conflito de idempotencia com requisicao anterior.',
      details: {
        idempotencyKey: decision.record.idempotencyKey,
        existingPaymentId: decision.record.paymentId,
      },
    });
  }

  private async evaluate(input: EvaluateIdempotencyInput): Promise<IdempotencyDecision> {
    const normalizedKey = this.validateIdempotencyKey(input.idempotencyKey);
    const record = await this.store.findByScopedKey({
      clientScope: input.clientScope,
      idempotencyKey: normalizedKey,
      scope: input.scope,
    });

    if (!record) {
      return { kind: 'first_call' };
    }

    if (record.requestHash === input.requestHash) {
      return { kind: 'replay', record };
    }

    return { kind: 'conflict', record };
  }
}
