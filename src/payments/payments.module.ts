import { Module } from '@nestjs/common';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { InMemoryPaymentsStore } from './storage/in-memory-payments.store';
import { PAYMENTS_STORE } from './storage/payments-store.interface';
import { NoopTransactionsFacade } from './integrations/transactions/noop-transactions.facade';
import { TRANSACTIONS_FACADE } from './integrations/transactions/transactions-facade.interface';
import { NoopProvidersFacade } from './integrations/providers/noop-providers.facade';
import { PROVIDERS_FACADE } from './integrations/providers/providers-facade.interface';

@Module({
  imports: [IdempotencyModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    InMemoryPaymentsStore,
    NoopTransactionsFacade,
    {
      provide: TRANSACTIONS_FACADE,
      useExisting: NoopTransactionsFacade,
    },
    NoopProvidersFacade,
    {
      provide: PROVIDERS_FACADE,
      useExisting: NoopProvidersFacade,
    },
    {
      provide: PAYMENTS_STORE,
      useExisting: InMemoryPaymentsStore,
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
