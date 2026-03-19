import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class ApiErrorResponseDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;

  @IsString()
  @IsNotEmpty()
  correlationId!: string;
}
