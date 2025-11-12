import { Controller, Get, Inject } from '@nestjs/common';
import {
    HealthCheckService,
    TypeOrmHealthIndicator,
    HealthCheck,
} from '@nestjs/terminus';
import { Redis } from '@upstash/redis';
import { cache_service } from '../cache/cache.module';

@Controller('health')
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private db: TypeOrmHealthIndicator,
        @Inject(cache_service) private cache_service_redis: Redis
    ) { }

    @Get()
    @HealthCheck()
    async check() {
        let redisStatus = { status: 'down', error: '' };

        try {
            await this.cache_service_redis.set('health-check', 'ok', { ex: 10 });
            const result = await this.cache_service_redis.get('health-check');

            if (result === 'ok') {
                redisStatus = { status: 'up', error: '' };
            } else {
                redisStatus = { status: 'down', error: 'Redis test failed' };
            }
        } catch (error) {
            redisStatus = { status: 'down', error: error.message };
        }

        const dbHealth = await this.health.check([
            () => this.db.pingCheck('database')
        ]);

        return {
            ...dbHealth,
            redis: redisStatus,
            timestamp: new Date().toISOString(),
            service: 'email-service'
        };
    }


    @Get('kaithheathcheck')
    leapcellHealthCheck() {
        return {
            status: 'ok',
            service: 'email-service',
            timestamp: new Date().toISOString()
        };
    }
}