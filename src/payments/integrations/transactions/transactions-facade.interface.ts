export const TRANSACTIONS_FACADE = Symbol(
  'TRANSACTIONS_FACADE',
);

export interface CreateInitialTransactionInput {
  paymentId: string;
  correlationId: string;
}

export interface CreateInitialTransactionResult {
  transactionId: string;
}

export interface TransactionsFacade {
  createInitialTransaction(
    input: CreateInitialTransactionInput,
  ): Promise<CreateInitialTransactionResult>;
}

