import { CanActivate, Controller, ExecutionContext, Get, Injectable, Module, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { DatabaseModule } from '../../common/database/database.module.js';
import { DatabaseService } from '../../common/database/database.service.js';

export interface Actor { id: string; tenantId: string; name: string }
export interface ActorRequest extends Request { actor: Actor }
export function hashToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }

@Injectable()
export class ActorGuard implements CanActivate {
  constructor(private readonly db: DatabaseService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ActorRequest>();
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(request.headers.authorization ?? '');
    if (!match?.[1]) throw new UnauthorizedException('A valid bearer token is required');
    const actor = await this.db.admin.findUnique({ where: { tokenHash: hashToken(match[1]) }, select: { id: true, tenantId: true, name: true } });
    if (!actor) throw new UnauthorizedException('A valid bearer token is required');
    request.actor = actor;
    return true;
  }
}
@Controller('actor')
@UseGuards(ActorGuard)
class ActorController {
  @Get()
  getActor(@Req() request: ActorRequest): Actor { return request.actor; }
}
@Module({ imports: [DatabaseModule], providers: [ActorGuard], controllers: [ActorController], exports: [ActorGuard] })
export class AuthModule {}
