import {
  Currency,
  PaymentMethodType,
  PaymentStatus,
} from '../dto/payment-contract.enums';

export type InternalPaymentStatus =
  | 'INITIATED'
  | 'PENDING'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'CANCELLED';

export interface InternalPaymentMethod {
  type: PaymentMethodType;
  masked?: string;
}

export interface PaymentAggregate {
  id: string;
  clientScope: string;
  customerId: string;
  merchantId: string;
  amount: number;
  currency: Currency;
  paymentMethod: InternalPaymentMethod;
  externalReference: string | null;
  metadata?: Record<string, string>;
  idempotencyKey: string;
  correlationId: string;
  status: InternalPaymentStatus;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface CreatePaymentRecordInput {
  clientScope: string;
  customerId: string;
  merchantId: string;
  amount: number;
  currency: Currency;
  paymentMethod: InternalPaymentMethod;
  externalReference: string | null;
  metadata?: Record<string, string>;
  idempotencyKey: string;
  correlationId: string;
}

export function mapInternalStatusToApiStatus(
  status: InternalPaymentStatus,
): PaymentStatus {
  switch (status) {
    case 'INITIATED':
      return PaymentStatus.CREATED;
    case 'PENDING':
      return PaymentStatus.PENDING;
    case 'AUTHORIZED':
      return PaymentStatus.AUTHORIZED;
    case 'CAPTURED':
      return PaymentStatus.SETTLED;
    case 'FAILED':
      return PaymentStatus.FAILED;
    case 'CANCELLED':
      return PaymentStatus.CANCELLED;
    default: {
      const exhaustiveCheck: never = status;
      return exhaustiveCheck;
    }
  }
}
