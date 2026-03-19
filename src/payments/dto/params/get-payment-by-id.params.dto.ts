import { IsUUID } from 'class-validator';

export class GetPaymentByIdParamsDto {
  @IsUUID()
  paymentId!: string;
}
