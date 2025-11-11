import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CacheModule } from './cache/cache.module';

@Module({
  imports: [CacheModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
