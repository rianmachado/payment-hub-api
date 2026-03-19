import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { PartyDto } from './dto/common/party.dto';
import { CreatePaymentRequestDto } from './dto/requests/create-payment.request.dto';
import { CreatePaymentResponseDto, PaymentResponseDto } from './dto/responses/payment.response.dto';
import { mapInternalStatusToApiStatus, PaymentAggregate } from './contracts/payment.types';
import { PAYMENTS_STORE, PaymentsStore } from './storage/payments-store.interface';
import {
  TRANSACTIONS_FACADE,
  TransactionsFacade,
} from './integrations/transactions/transactions-facade.interface';
import {
  PROVIDERS_FACADE,
  ProvidersFacade,
} from './integrations/providers/providers-facade.interface';

const PAYMENT_ERROR_CODE_NOT_FOUND = 'PAYMENT_NOT_FOUND';
const PAYMENT_ERROR_CODE_ACCESS_DENIED = 'PAYMENT_ACCESS_DENIED';
const PAYMENT_ERROR_CODE_VALIDATION = 'PAYMENT_VALIDATION_ERROR';
const IDEMPOTENCY_ERROR_CODE_NOT_FOUND = 'IDEMPOTENCY_KEY_NOT_FOUND';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly idempotencyService: IdempotencyService,
    @Inject(PAYMENTS_STORE)
    private readonly paymentsStore: PaymentsStore,
    @Inject(TRANSACTIONS_FACADE)
    private readonly transactionsFacade: TransactionsFacade,
    @Inject(PROVIDERS_FACADE)
    private readonly providersFacade: ProvidersFacade,
  ) {}

  async createPayment(input: {
    clientScope: string;
    idempotencyKey: string | undefined;
    correlationId: string;
    request: CreatePaymentRequestDto;
  }): Promise<CreatePaymentResponseDto> {
    const requestHash = this.hashCreatePaymentRequest(input.request);
    const decision = await this.idempotencyService.evaluateCreatePayment({
      clientScope: input.clientScope,
      idempotencyKey: input.idempotencyKey,
      requestHash,
    });

    this.idempotencyService.assertNoConflict(decision);

    if (decision.kind === 'replay') {
      const replayPayment = await this.paymentsStore.findByPaymentId(decision.record.paymentId);

      if (!replayPayment) {
        throw new NotFoundException({
          code: PAYMENT_ERROR_CODE_NOT_FOUND,
          message: 'Pagamento nao encontrado para o replay de idempotencia.',
          details: { paymentId: decision.record.paymentId },
        });
      }

      this.assertAccess(input.clientScope, replayPayment);

      return {
        ...this.toPaymentResponse(replayPayment),
        idempotencyKey: replayPayment.idempotencyKey,
        idempotencyReplay: true,
      };
    }

    const payment = await this.paymentsStore.create({
      clientScope: input.clientScope,
      customerId: this.resolvePartyIdentifier(input.request.payer, 'payer'),
      merchantId: this.resolvePartyIdentifier(input.request.payee, 'payee'),
      amount: input.request.amount,
      currency: input.request.currency,
      paymentMethod: {
        type: input.request.paymentMethod.type,
        masked: this.maskPaymentMethodValue(input.request),
      },
      externalReference: input.request.externalReference ?? null,
      metadata: input.request.metadata,
      idempotencyKey: this.idempotencyService.validateIdempotencyKey(input.idempotencyKey),
      correlationId: input.correlationId,
    });

    // Baseline controlado: instancia uma transacao e dispara uma transicao inicial
    // via ProvidersFacade (stub). No replay, este caminho nao e executado.
    const transaction = await this.transactionsFacade.createInitialTransaction({
      paymentId: payment.id,
      correlationId: input.correlationId,
    });

    const providerOutcome = await this.providersFacade.processPaymentIntent({
      paymentId: payment.id,
      transactionId: transaction.transactionId,
      correlationId: input.correlationId,
    });

    const updatedPayment = await this.paymentsStore.updateStatus({
      paymentId: payment.id,
      status: providerOutcome.paymentStatus,
      completedAt: providerOutcome.completedAt ?? null,
    });

    const paymentForResponse = updatedPayment ?? payment;

    await this.idempotencyService.registerCreatePaymentFirstCall({
      clientScope: input.clientScope,
      idempotencyKey: paymentForResponse.idempotencyKey,
      requestHash,
      paymentId: paymentForResponse.id,
    });

    return {
      ...this.toPaymentResponse(paymentForResponse),
      idempotencyKey: paymentForResponse.idempotencyKey,
    };
  }

  async getPaymentById(input: {
    clientScope: string;
    paymentId: string;
  }): Promise<PaymentResponseDto> {
    const payment = await this.paymentsStore.findByPaymentId(input.paymentId);
    if (!payment) {
      throw new NotFoundException({
        code: PAYMENT_ERROR_CODE_NOT_FOUND,
        message: 'Pagamento nao encontrado.',
        details: { paymentId: input.paymentId },
      });
    }

    this.assertAccess(input.clientScope, payment);
    return this.toPaymentResponse(payment);
  }

  async getPaymentByIdempotencyKey(input: {
    clientScope: string;
    idempotencyKey: string;
  }): Promise<PaymentResponseDto> {
    const normalizedKey = this.idempotencyService.validateIdempotencyKey(input.idempotencyKey);
    const payment = await this.paymentsStore.findByScopedIdempotencyKey({
      clientScope: input.clientScope,
      idempotencyKey: normalizedKey,
    });

    if (!payment) {
      throw new NotFoundException({
        code: IDEMPOTENCY_ERROR_CODE_NOT_FOUND,
        message: 'Nenhum pagamento encontrado para a chave de idempotencia informada.',
        details: { idempotencyKey: normalizedKey },
      });
    }

    this.assertAccess(input.clientScope, payment);
    return this.toPaymentResponse(payment);
  }

  private hashCreatePaymentRequest(request: CreatePaymentRequestDto): string {
    const canonicalPayload = JSON.stringify(this.sortKeysRecursively(request));
    return createHash('sha256').update(canonicalPayload).digest('hex');
  }

  private sortKeysRecursively(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortKeysRecursively(item));
    }

    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, entryValue]) => [key, this.sortKeysRecursively(entryValue)]);
      return Object.fromEntries(entries);
    }

    return value;
  }

  private resolvePartyIdentifier(party: PartyDto, role: 'payer' | 'payee'): string {
    const value = party.id ?? party.externalId;
    if (!value || value.trim().length === 0) {
      throw new BadRequestException({
        code: PAYMENT_ERROR_CODE_VALIDATION,
        message: 'Dados de pagamento invalidos.',
        details: { field: role },
      });
    }

    return value;
  }

  private maskPaymentMethodValue(request: CreatePaymentRequestDto): string | undefined {
    if (request.paymentMethod.cardToken) {
      return this.maskTail(request.paymentMethod.cardToken);
    }

    if (request.paymentMethod.pixKey) {
      return this.maskTail(request.paymentMethod.pixKey);
    }

    if (request.paymentMethod.boletoNumber) {
      return this.maskTail(request.paymentMethod.boletoNumber);
    }

    return undefined;
  }

  private maskTail(value: string): string {
    if (value.length <= 4) {
      return '*'.repeat(value.length);
    }
    return `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
  }

  private toPaymentResponse(payment: PaymentAggregate): PaymentResponseDto {
    return {
      paymentId: payment.id,
      status: mapInternalStatusToApiStatus(payment.status),
      amount: payment.amount,
      currency: payment.currency,
      payer: { id: payment.customerId },
      payee: { id: payment.merchantId },
      paymentMethod: payment.paymentMethod,
      externalReference: payment.externalReference,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
      completedAt: payment.completedAt?.toISOString() ?? null,
      correlationId: payment.correlationId,
    };
  }

  private assertAccess(clientScope: string, payment: PaymentAggregate): void {
    if (payment.clientScope === clientScope) {
      return;
    }

    throw new ForbiddenException({
      code: PAYMENT_ERROR_CODE_ACCESS_DENIED,
      message: 'Voce nao tem acesso a este pagamento.',
      details: { paymentId: payment.id },
    });
  }
}
