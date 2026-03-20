import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { GetPaymentByIdParamsDto } from './dto/params/get-payment-by-id.params.dto';
import { GetPaymentByIdempotencyKeyParamsDto } from './dto/params/get-payment-by-idempotency-key.params.dto';
import { CreatePaymentRequestDto } from './dto/requests/create-payment.request.dto';
import { CreatePaymentResponseDto, PaymentResponseDto } from './dto/responses/payment.response.dto';
import { PaymentsService } from './payments.service';

const AUTH_TOKEN_MISSING_CODE = 'AUTH_TOKEN_MISSING';
type HttpResponse = {
  status(code: number): void;
};
type RequestWithCorrelationId = Request & { correlationId: string };

@Controller('v1/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPayment(
    @Body() body: CreatePaymentRequestDto,
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: RequestWithCorrelationId,
    @Res({ passthrough: true }) response: HttpResponse,
  ): Promise<CreatePaymentResponseDto> {
    const clientScope = this.resolveClientScope(authorization);
    const correlationId = request.correlationId;

    const payment = await this.paymentsService.createPayment({
      clientScope,
      idempotencyKey,
      correlationId,
      request: body,
    });

    if (payment.idempotencyReplay) {
      response.status(HttpStatus.OK);
    }

    return payment;
  }

  @Get('by-idempotency-key/:idempotencyKey')
  async getPaymentByIdempotencyKey(
    @Param() params: GetPaymentByIdempotencyKeyParamsDto,
    @Headers('authorization') authorization: string | undefined,
  ): Promise<PaymentResponseDto> {
    const clientScope = this.resolveClientScope(authorization);

    return this.paymentsService.getPaymentByIdempotencyKey({
      clientScope,
      idempotencyKey: params.idempotencyKey,
    });
  }

  @Get(':paymentId')
  async getPaymentById(
    @Param() params: GetPaymentByIdParamsDto,
    @Headers('authorization') authorization: string | undefined,
    @Query('expand') _expand: string | undefined,
  ): Promise<PaymentResponseDto> {
    const clientScope = this.resolveClientScope(authorization);

    return this.paymentsService.getPaymentById({
      clientScope,
      paymentId: params.paymentId,
    });
  }

  private resolveClientScope(authorization: string | undefined): string {
    const normalizedAuthorization = authorization?.trim();

    if (!normalizedAuthorization) {
      throw new UnauthorizedException({
        code: AUTH_TOKEN_MISSING_CODE,
        message: 'Header Authorization ausente.',
      });
    }

    return normalizedAuthorization;
  }
}
