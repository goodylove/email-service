

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  //  Create HTTP application (for health checks, testing, etc.)
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Global validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true
  }));

  //  Connect RabbitMQ Microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL as string],
      queue: 'email_queue',
      exchange: 'notifications.direct',
      exchangeType: 'direct',
      noAck: false,
      queueOptions: {
        durable: true
      }
    },
  });

  await app.startAllMicroservices();

  const port = configService.get('PORT', 8080);
  await app.listen(port);

  logger.log(`Email Service is running on port ${port}`);
  logger.log(`Health check available at: http://localhost:${port}/health`);
  logger.log(` RabbitMQ connected to: ${configService.get('RABBITMQ_URL')?.split('@')[1]}`);
}

bootstrap();