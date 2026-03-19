import {
  CreatePaymentRecordInput,
  InternalPaymentStatus,
  PaymentAggregate,
} from '../contracts/payment.types';

export const PAYMENTS_STORE = Symbol('PAYMENTS_STORE');

export interface PaymentsStore {
  create(input: CreatePaymentRecordInput): Promise<PaymentAggregate>;
  findByPaymentId(paymentId: string): Promise<PaymentAggregate | null>;
  findByScopedIdempotencyKey(input: {
    clientScope: string;
    idempotencyKey: string;
  }): Promise<PaymentAggregate | null>;
  updateStatus(input: {
    paymentId: string;
    status: InternalPaymentStatus;
    completedAt?: Date | null;
  }): Promise<PaymentAggregate | null>;
}
