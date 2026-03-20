import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { ApiExceptionFilter } from './shared/filters/api-exception.filter';
import { CorrelationIdInterceptor } from './shared/interceptors/correlation-id.interceptor';
import { HttpLoggingInterceptor } from './shared/interceptors/http-logging.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);

  const nodeEnv = config.get<string>('NODE_ENV', 'development');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: nodeEnv === 'production',
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new CorrelationIdInterceptor(), new HttpLoggingInterceptor());

  await app.listen(port);
}

bootstrap();
