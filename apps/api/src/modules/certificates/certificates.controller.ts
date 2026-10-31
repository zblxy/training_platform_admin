import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ActorGuard, type ActorRequest } from '../auth/auth.module.js';
import { CertificatesService } from './certificates.service.js';
import { ListCertificatesDto } from './list-certificates.dto.js';
@Controller('certificates')
@UseGuards(ActorGuard)
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}
  @Get()
  list(@Req() request: ActorRequest, @Query() query: ListCertificatesDto) {
    return this.certificates.list(request.actor, query);
  }
}
