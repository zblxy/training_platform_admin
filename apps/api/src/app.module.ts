import { AuthModule } from './modules/auth/auth.module.js';
import { CertificatesModule } from './modules/certificates/certificates.module.js';
import { Module } from '@nestjs/common';
import { HealthController } from './modules/health/health.controller.js';
import { CacheModule } from './common/cache/cache.module.js';
@Module({ imports: [CacheModule, AuthModule, CertificatesModule], controllers: [HealthController] })
export class AppModule {}
