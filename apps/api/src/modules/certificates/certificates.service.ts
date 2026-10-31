import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service.js';
import type { CertificateListResponse } from '@training/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import type { ListCertificatesDto } from './list-certificates.dto.js';
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
  async list(actor: Actor, query: ListCertificatesDto): Promise<CertificateListResponse> {
    const { search, page, pageSize, sortBy, sortDirection } = query;
    const where: Prisma.CertificateWhereInput = {
      tenantId: actor.tenantId,
      ...(search ? { OR: [
        { serialNumber: { equals: search.toUpperCase() } },
        // Escape LIKE metacharacters: the user is searching for literal text.
        { enrollment: { learner: { name: { contains: search.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' } } } },
      ] } : {}),
    };
    const primary: Prisma.CertificateOrderByWithRelationInput = sortBy === 'learnerName'
      ? { enrollment: { learner: { name: sortDirection } } }
      : sortBy === 'courseTitle' ? { enrollment: { course: { title: sortDirection } } }
      : { [sortBy]: sortDirection };
    // Count and rows share a consistent database snapshot, including during issuance.
    const [total, rows] = await this.db.$transaction([
      this.db.certificate.count({ where }),
      this.db.certificate.findMany({
        where, orderBy: [primary, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize,
        select: { id: true, serialNumber: true, issuedAt: true, issueDate: true, revokedAt: true,
          enrollment: { select: { learner: { select: { name: true } }, course: { select: { title: true } } } } },
      }),
    ], { isolationLevel: 'RepeatableRead' });
    return { total, page, pageSize, items: rows.map(row => ({
      id: row.id, serialNumber: row.serialNumber, learnerName: row.enrollment.learner.name,
      courseTitle: row.enrollment.course.title, issuedAt: row.issuedAt.toISOString(),
      issueDate: row.issueDate.toISOString().slice(0, 10), status: row.revokedAt ? 'revoked' : 'active',
    })) };
  }
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
