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
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthContext } from '../auth/auth-context.types';
import { AuthorizationGuard } from '../auth/guards/authorization.guard';
import { GetPaymentByIdParamsDto } from './dto/params/get-payment-by-id.params.dto';
import { GetPaymentByIdempotencyKeyParamsDto } from './dto/params/get-payment-by-idempotency-key.params.dto';
import { CreatePaymentRequestDto } from './dto/requests/create-payment.request.dto';
import { CreatePaymentResponseDto, PaymentResponseDto } from './dto/responses/payment.response.dto';
import { PaymentsService } from './payments.service';

type HttpResponse = {
  status(code: number): void;
};
type RequestWithCorrelationId = Request & {
  correlationId: string;
};
type RequestWithCorrelationIdAndAuth = RequestWithCorrelationId & {
  authContext: AuthContext;
};

@Controller('v1/payments')
@UseGuards(AuthorizationGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPayment(
    @Body() body: CreatePaymentRequestDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: RequestWithCorrelationIdAndAuth,
    @Res({ passthrough: true }) response: HttpResponse,
  ): Promise<CreatePaymentResponseDto> {
    const clientScope = request.authContext.clientScope;
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
    @Req() request: RequestWithCorrelationIdAndAuth,
  ): Promise<PaymentResponseDto> {
    const clientScope = request.authContext.clientScope;

    return this.paymentsService.getPaymentByIdempotencyKey({
      clientScope,
      idempotencyKey: params.idempotencyKey,
    });
  }

  @Get(':paymentId')
  async getPaymentById(
    @Param() params: GetPaymentByIdParamsDto,
    @Req() request: RequestWithCorrelationIdAndAuth,
    @Query('expand') _expand: string | undefined,
  ): Promise<PaymentResponseDto> {
    const clientScope = request.authContext.clientScope;

    return this.paymentsService.getPaymentById({
      clientScope,
      paymentId: params.paymentId,
    });
  }
}
