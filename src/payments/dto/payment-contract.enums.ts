export enum PaymentStatus {
  CREATED = 'CREATED',
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  SETTLED = 'SETTLED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum Currency {
  BRL = 'BRL',
  USD = 'USD',
}

export enum PaymentMethodType {
  PIX = 'PIX',
  CARD = 'CARD',
  BOLETO = 'BOLETO',
}
