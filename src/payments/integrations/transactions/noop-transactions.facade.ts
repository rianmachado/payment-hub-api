import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CreateInitialTransactionInput,
  CreateInitialTransactionResult,
  TransactionsFacade,
} from './transactions-facade.interface';

@Injectable()
export class NoopTransactionsFacade implements TransactionsFacade {
  async createInitialTransaction(
    input: CreateInitialTransactionInput,
  ): Promise<CreateInitialTransactionResult> {
    // Stub controlado para o baseline: apenas gera um id de transacao.
    // TODO(step-payment-service): integrar com TransactionsService real e persistencia.
    void input;
    return { transactionId: randomUUID() };
  }
}

