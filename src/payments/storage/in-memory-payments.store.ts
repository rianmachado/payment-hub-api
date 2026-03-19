import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CreatePaymentRecordInput,
  InternalPaymentStatus,
  PaymentAggregate,
} from '../contracts/payment.types';
import { PaymentsStore } from './payments-store.interface';

@Injectable()
export class InMemoryPaymentsStore implements PaymentsStore {
  private readonly paymentsById = new Map<string, PaymentAggregate>();
  private readonly paymentIdByScopedIdempotencyKey = new Map<string, string>();

  async create(input: CreatePaymentRecordInput): Promise<PaymentAggregate> {
    const now = new Date();
    const payment: PaymentAggregate = {
      id: randomUUID(),
      clientScope: input.clientScope,
      customerId: input.customerId,
      merchantId: input.merchantId,
      amount: input.amount,
      currency: input.currency,
      paymentMethod: input.paymentMethod,
      externalReference: input.externalReference,
      metadata: input.metadata,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      status: 'INITIATED',
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };

    this.paymentsById.set(payment.id, payment);
    this.paymentIdByScopedIdempotencyKey.set(
      this.scopedKey(payment.clientScope, payment.idempotencyKey),
      payment.id,
    );

    return payment;
  }

  async findByPaymentId(paymentId: string): Promise<PaymentAggregate | null> {
    return this.paymentsById.get(paymentId) ?? null;
  }

  async findByScopedIdempotencyKey(input: {
    clientScope: string;
    idempotencyKey: string;
  }): Promise<PaymentAggregate | null> {
    const paymentId = this.paymentIdByScopedIdempotencyKey.get(
      this.scopedKey(input.clientScope, input.idempotencyKey),
    );

    if (!paymentId) {
      return null;
    }

    return this.paymentsById.get(paymentId) ?? null;
  }

  async updateStatus(input: {
    paymentId: string;
    status: InternalPaymentStatus;
    completedAt?: Date | null;
  }): Promise<PaymentAggregate | null> {
    const current = this.paymentsById.get(input.paymentId);

    if (!current) {
      return null;
    }

    const next: PaymentAggregate = {
      ...current,
      status: input.status,
      completedAt:
        input.completedAt === undefined ? current.completedAt : input.completedAt,
      updatedAt: new Date(),
    };

    this.paymentsById.set(next.id, next);
    return next;
  }

  private scopedKey(clientScope: string, idempotencyKey: string): string {
    return `${clientScope}:${idempotencyKey}`;
  }
}
