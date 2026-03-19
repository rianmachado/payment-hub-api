import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class GetPaymentByIdempotencyKeyParamsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey!: string;
}
