import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL as string],
        queue: 'email_queue',
        exchange:'notifications.direct',
        exchangeType:'direct',
        noAck:false,
        queueOptions:{
         durable:true
        }
      },
    },
  );
  await app.listen();
}
bootstrap();
