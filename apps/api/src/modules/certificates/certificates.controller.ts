import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ActorGuard, type ActorRequest } from '../auth/auth.module.js';
import { CertificatesService } from './certificates.service.js';
import { BulkIssuanceDto } from './bulk-issuance.dto.js';
import { CertificateIdDto, RevokeCertificateDto } from './certificate-detail.dto.js';
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
  bulkIssue(@Req() request: ActorRequest, @Body() body: BulkIssuanceDto, @Headers('idempotency-key') key?: string) {
    if (key !== undefined && !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) throw new BadRequestException('Invalid Idempotency-Key');
    return key === undefined
      ? this.certificates.bulkIssue(request.actor, body.courseId)
      : this.certificates.bulkIssueWithKey(request.actor, body.courseId.toLowerCase(), key);
  }
  @Get(':id')
  detail(@Req() request: ActorRequest, @Param() params: CertificateIdDto) {
    return this.certificates.detail(request.actor, params.id);
  }
  @Post(':id/revoke')
  @HttpCode(200)
  async revoke(@Req() request: ActorRequest, @Param() params: CertificateIdDto, @Body() body: RevokeCertificateDto) {
    await this.certificates.revoke(request.actor, params.id, body.reason);
    return this.certificates.detail(request.actor, params.id);
  }
  @Get()
  list(@Req() request: ActorRequest, @Query() query: ListCertificatesDto) {
    return this.certificates.list(request.actor, query);
  }
}
