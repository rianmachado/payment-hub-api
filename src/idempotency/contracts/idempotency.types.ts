import { CREATE_PAYMENT_IDEMPOTENCY_SCOPE } from '../idempotency.constants';

export type IdempotencyScope = typeof CREATE_PAYMENT_IDEMPOTENCY_SCOPE;

export interface IdempotencyRecordSnapshot {
  clientScope: string;
  idempotencyKey: string;
  scope: IdempotencyScope;
  requestHash: string;
  paymentId: string;
  responseStatusCode?: number;
  responseBody?: unknown;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface EvaluateIdempotencyInput {
  clientScope: string;
  idempotencyKey: string | undefined;
  scope: IdempotencyScope;
  requestHash: string;
}

export type IdempotencyDecision =
  | { kind: 'first_call' }
  | { kind: 'replay'; record: IdempotencyRecordSnapshot }
  | { kind: 'conflict'; record: IdempotencyRecordSnapshot };
