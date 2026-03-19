import { Injectable } from '@nestjs/common';
import {
  ProcessPaymentIntentInput,
  ProvidersFacade,
  ProcessPaymentIntentResult,
} from './providers-facade.interface';

@Injectable()
export class NoopProvidersFacade implements ProvidersFacade {
  async processPaymentIntent(
    input: ProcessPaymentIntentInput,
  ): Promise<ProcessPaymentIntentResult> {
    // Stub controlado para o baseline:
    // - nao chama PSP/provedor real
    // - retorna uma transicao inicial coerente para o status do payment.
    void input;
    return { paymentStatus: 'PENDING', completedAt: null };
  }
}
