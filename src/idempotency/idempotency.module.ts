import { Module } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { InMemoryIdempotencyStore } from './storage/in-memory-idempotency.store';
import { IDEMPOTENCY_STORE } from './storage/idempotency-store.interface';

@Module({
  providers: [
    IdempotencyService,
    InMemoryIdempotencyStore,
    {
      provide: IDEMPOTENCY_STORE,
      useExisting: InMemoryIdempotencyStore,
    },
  ],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
