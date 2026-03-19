import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Currency, PaymentStatus } from '../payment-contract.enums';
import { PartyDto } from '../common/party.dto';
import { PaymentMethodResponseDto } from '../common/payment-method.dto';

export class PaymentResponseDto {
  @IsUUID()
  paymentId!: string;

  @IsEnum(PaymentStatus)
  status!: PaymentStatus;

  @IsNumber()
  amount!: number;

  @IsEnum(Currency)
  currency!: Currency;

  @ValidateNested()
  @Type(() => PartyDto)
  payer!: PartyDto;

  @ValidateNested()
  @Type(() => PartyDto)
  payee!: PartyDto;

  @ValidateNested()
  @Type(() => PaymentMethodResponseDto)
  paymentMethod!: PaymentMethodResponseDto;

  @IsOptional()
  @IsString()
  externalReference?: string | null;

  @IsDateString()
  createdAt!: string;

  @IsDateString()
  updatedAt!: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string | null;

  @IsString()
  @IsNotEmpty()
  correlationId!: string;
}

export class CreatePaymentResponseDto extends PaymentResponseDto {
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @IsOptional()
  @IsBoolean()
  idempotencyReplay?: boolean;
}
