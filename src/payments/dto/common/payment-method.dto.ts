import { IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';
import { PaymentMethodType } from '../payment-contract.enums';

export class CreatePaymentMethodDto {
  @IsEnum(PaymentMethodType)
  type!: PaymentMethodType;

  @ValidateIf((o: CreatePaymentMethodDto) => o.type === PaymentMethodType.PIX)
  @IsString()
  @IsNotEmpty()
  pixKey?: string;

  @ValidateIf((o: CreatePaymentMethodDto) => o.type === PaymentMethodType.CARD)
  @IsString()
  @IsNotEmpty()
  cardToken?: string;

  @ValidateIf((o: CreatePaymentMethodDto) => o.type === PaymentMethodType.BOLETO)
  @IsString()
  @IsNotEmpty()
  boletoNumber?: string;
}

export class PaymentMethodResponseDto {
  @IsEnum(PaymentMethodType)
  type!: PaymentMethodType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  masked?: string;
}
