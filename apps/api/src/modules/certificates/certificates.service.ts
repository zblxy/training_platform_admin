import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service.js';
import type { Actor } from '../auth/auth.module.js';

export function localIssueDate(instant: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  return new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00.000Z`);
}
export function enrollmentDisplayStatus(status: 'INCOMPLETE' | 'COMPLETED', certificate: { revokedAt: Date | null } | null): 'incomplete' | 'completed' | 'certified' {
  return certificate && !certificate.revokedAt ? 'certified' : status === 'COMPLETED' ? 'completed' : 'incomplete';
}

@Injectable()
export class CertificatesService {
  constructor(private readonly db: DatabaseService) {}
  async issue(actor: Actor, enrollmentId: string) {
    return this.db.$transaction(async tx => {
      // One lock per enrollment serializes concurrent issuance without retrying side effects.
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Enrollment" WHERE id = ${enrollmentId}::uuid AND "tenantId" = ${actor.tenantId}::uuid FOR UPDATE`;
      if (!rows.length) throw new NotFoundException('Enrollment not found');
      const enrollment = await tx.enrollment.findUniqueOrThrow({ where: { id: enrollmentId }, include: { certificate: true } });
      if (enrollment.certificate) return enrollment.certificate;
      if (enrollment.status !== 'COMPLETED') throw new ConflictException('Only completed enrollments are eligible');
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: actor.tenantId } });
      const issuedAt = new Date();
      // The database independently verifies eligibility/date and creates the audit event.
      return tx.certificate.create({ data: { tenantId: actor.tenantId, enrollmentId, issuedById: actor.id, issuedAt, issueDate: localIssueDate(issuedAt, tenant.timeZone), issueTimeZone: tenant.timeZone } });
    });
  }
  async revoke(actor: Actor, certificateId: string, reason: string) {
    if (!reason.trim() || reason.length > 1000) throw new ConflictException('A revocation reason of 1–1000 characters is required');
    return this.db.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Certificate" WHERE id = ${certificateId}::uuid AND "tenantId" = ${actor.tenantId}::uuid FOR UPDATE`;
      if (!rows.length) throw new NotFoundException('Certificate not found');
      const certificate = await tx.certificate.findUniqueOrThrow({ where: { id: certificateId } });
      if (certificate.revokedAt) return certificate;
      return tx.certificate.update({ where: { id: certificateId }, data: { revokedAt: new Date(), revokedById: actor.id, revocationReason: reason.trim() } });
    });
  }
}
