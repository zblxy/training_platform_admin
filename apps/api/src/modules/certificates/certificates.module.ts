import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database/database.module.js';
import { CertificatesService } from './certificates.service.js';
@Module({ imports: [DatabaseModule], providers: [CertificatesService], exports: [CertificatesService] })
export class CertificatesModule {}
