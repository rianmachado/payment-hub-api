import { IdempotencyRecordSnapshot, IdempotencyScope } from '../contracts/idempotency.types';

export interface SaveIdempotencyRecordInput {
  clientScope: string;
  idempotencyKey: string;
  scope: IdempotencyScope;
  requestHash: string;
  paymentId: string;
}

export interface IdempotencyStore {
  findByScopedKey(params: {
    clientScope: string;
    idempotencyKey: string;
    scope: IdempotencyScope;
  }): Promise<IdempotencyRecordSnapshot | null>;

  saveFirstCall(input: SaveIdempotencyRecordInput): Promise<void>;
}

export const IDEMPOTENCY_STORE = Symbol('IDEMPOTENCY_STORE');
