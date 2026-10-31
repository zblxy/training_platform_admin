import { Module } from '@nestjs/common';
import { HealthController } from './modules/health/health.controller.js';
import { CacheModule } from './common/cache/cache.module.js';
@Module({ imports: [CacheModule], controllers: [HealthController] })
export class AppModule {}
