import { AuthModule } from '../auth/auth.module.js';
import { CertificatesController } from './certificates.controller.js';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database/database.module.js';
import { CertificatesService } from './certificates.service.js';
@Module({ imports: [DatabaseModule, AuthModule], controllers: [CertificatesController], providers: [CertificatesService], exports: [CertificatesService] })
export class CertificatesModule {}
