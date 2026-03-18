import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { PaymentsModule } from './payments/payments.module';
import { ProvidersModule } from './providers/providers.module';
import { TransactionsModule } from './transactions/transactions.module';
import { SharedModule } from './shared/shared.module';
import { PersistenceModule } from './persistence/persistence.module';
import { CacheModule } from './cache/cache.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    HealthModule,
    PaymentsModule,
    TransactionsModule,
    IdempotencyModule,
    ProvidersModule,
    AuthModule,
    SharedModule,
    PersistenceModule,
    CacheModule,
  ],
})
export class AppModule {}
