import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ActorGuard, type ActorRequest } from '../auth/auth.module.js';
import { CertificatesService } from './certificates.service.js';
import { BulkIssuanceDto } from './bulk-issuance.dto.js';
import { ListCertificatesDto } from './list-certificates.dto.js';
@Controller('certificates')
@UseGuards(ActorGuard)
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}
  @Get('courses')
  courses(@Req() request: ActorRequest) {
    return this.certificates.courses(request.actor);
  }
  @Post('bulk-issuance')
  bulkIssue(@Req() request: ActorRequest, @Body() body: BulkIssuanceDto) {
    return this.certificates.bulkIssue(request.actor, body.courseId);
  }
  @Get()
  list(@Req() request: ActorRequest, @Query() query: ListCertificatesDto) {
    return this.certificates.list(request.actor, query);
  }
}
