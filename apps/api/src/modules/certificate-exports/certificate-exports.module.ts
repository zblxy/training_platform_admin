import { Body, Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { DatabaseModule } from '../../common/database/database.module.js';
import { ActorGuard, AuthModule, type ActorRequest } from '../auth/auth.module.js';
import { CertificateQueryDto } from '../certificates/list-certificates.dto.js';
import { CertificateExportsService } from './certificate-exports.service.js';
@Controller('certificates/exports')
@UseGuards(ActorGuard)
class CertificateExportsController {
  constructor(private readonly exports: CertificateExportsService) {}
  @Post()
  @HttpCode(202)
  create(@Req() request: ActorRequest, @Body() query: CertificateQueryDto) {
    return this.exports.create(request.actor, query);
  }
  @Get(':id')
  status(@Req() request: ActorRequest, @Param('id', new ParseUUIDPipe()) id: string, @Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    return this.exports.status(request.actor, id);
  }
  @Get(':id/download')
  download(@Req() request: ActorRequest, @Param('id', new ParseUUIDPipe()) id: string, @Res() response: Response) {
    return this.exports.download(request.actor, id, response);
  }
}
@Module({ imports: [DatabaseModule, AuthModule], controllers: [CertificateExportsController], providers: [CertificateExportsService] })
export class CertificateExportsModule {}
