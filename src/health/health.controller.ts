import { Controller, Get } from '@nestjs/common';
import {
    HealthCheckService,
    TypeOrmHealthIndicator,
    HealthCheck,
} from '@nestjs/terminus';

@Controller()
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private db: TypeOrmHealthIndicator,
    ) { }

    @Get('health')
    @HealthCheck()
    check() {
        return this.health.check([() => this.db.pingCheck('database')]);
    }


    @Get('kaithhealth')
    @HealthCheck()
    check_health() {
        return { status: 'ok', timestamp: new Date().toISOString() };
    }
}

// @Controller()
// export class AppController {
//     @Get('kaithheathcheck')
//     healthCheck() {
//         
//     }
// }