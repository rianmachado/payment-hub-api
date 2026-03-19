import { Injectable } from '@nestjs/common';
import { IdempotencyRecordSnapshot } from '../contracts/idempotency.types';
import { IdempotencyStore, SaveIdempotencyRecordInput } from './idempotency-store.interface';

@Injectable()
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecordSnapshot>();

  async findByScopedKey(params: {
    clientScope: string;
    idempotencyKey: string;
    scope: IdempotencyRecordSnapshot['scope'];
  }): Promise<IdempotencyRecordSnapshot | null> {
    const key = this.buildRecordKey(params);
    return this.records.get(key) ?? null;
  }

  async saveFirstCall(input: SaveIdempotencyRecordInput): Promise<void> {
    const now = new Date();
    const record: IdempotencyRecordSnapshot = {
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    const key = this.buildRecordKey(input);
    this.records.set(key, record);

    // Temporary store: does not provide multi-instance consistency.
    // TODO(step-typeorm): replace in-memory map by persistence/caching implementation.
  }

  private buildRecordKey(input: {
    clientScope: string;
    idempotencyKey: string;
    scope: IdempotencyRecordSnapshot['scope'];
  }): string {
    return `${input.clientScope}::${input.scope}::${input.idempotencyKey}`;
  }
}
