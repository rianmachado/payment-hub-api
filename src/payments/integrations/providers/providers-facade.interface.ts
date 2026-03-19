import { InternalPaymentStatus } from '../../contracts/payment.types';

export const PROVIDERS_FACADE = Symbol('PROVIDERS_FACADE');

export interface ProcessPaymentIntentInput {
  paymentId: string;
  transactionId: string;
  correlationId: string;
}

export interface ProcessPaymentIntentResult {
  paymentStatus: InternalPaymentStatus;
  completedAt?: Date | null;
}

export interface ProvidersFacade {
  processPaymentIntent(
    input: ProcessPaymentIntentInput,
  ): Promise<ProcessPaymentIntentResult>;
}

