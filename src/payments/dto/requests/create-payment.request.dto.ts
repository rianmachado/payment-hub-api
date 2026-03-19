import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  Validate,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Currency } from '../payment-contract.enums';
import { PartyDto } from '../common/party.dto';
import { CreatePaymentMethodDto } from '../common/payment-method.dto';

@ValidatorConstraint({ name: 'isStringRecord', async: false })
class IsStringRecordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.values(value as Record<string, unknown>).every(
      (entry) => typeof entry === 'string',
    );
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'metadata must be an object with string values';
  }
}

export class CreatePaymentRequestDto {
  @ValidateNested()
  @Type(() => PartyDto)
  payer!: PartyDto;

  @ValidateNested()
  @Type(() => PartyDto)
  payee!: PartyDto;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.0000001)
  amount!: number;

  @IsEnum(Currency)
  currency!: Currency;

  @ValidateNested()
  @Type(() => CreatePaymentMethodDto)
  paymentMethod!: CreatePaymentMethodDto;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  externalReference?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  callbackUrl?: string;

  @IsOptional()
  @IsObject()
  @Validate(IsStringRecordConstraint)
  metadata?: Record<string, string>;
}
