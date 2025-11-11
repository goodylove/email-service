import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';

export const cache_service = 'CACHE_SERVICE';

@Module({
    imports: [ConfigModule],
    providers: [
        {
            provide: cache_service,
            useFactory: (configService: ConfigService) => {
                const client = new Redis({
                    url: configService.get<string>('UPSTASH_REDIS_REST_URL'),
                    token: configService.get<string>('UPSTASH_REDIS_REST_TOKEN'),
                });
                return client;
            },
            inject: [ConfigService],
        },
    ],
    exports: [cache_service]
})
export class CacheModule { }
