import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service.js';
import { isBulkIssuanceResponse } from '@training/shared';
import type { BulkIssuanceOutcome, BulkIssuanceResponse, CertificateDetail, CertificateListResponse, CourseListResponse } from '@training/shared';
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
      : { [sortBy === 'issuedAt' ? 'issueDate' : sortBy]: sortDirection };
    // Count and rows share a consistent database snapshot, including during issuance.
    const [total, rows] = await this.db.$transaction([
      this.db.certificate.count({ where }),
      this.db.certificate.findMany({
        where, orderBy: [primary, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize,
        select: { id: true, serialNumber: true, issuedAt: true, issueDate: true, issueTimeZone: true, revokedAt: true,
          enrollment: { select: { learner: { select: { name: true } }, course: { select: { title: true } } } } },
      }),
    ], { isolationLevel: 'RepeatableRead' });
    return { total, page, pageSize, items: rows.map(row => ({
      id: row.id, serialNumber: row.serialNumber, learnerName: row.enrollment.learner.name,
      courseTitle: row.enrollment.course.title, issuedAt: row.issuedAt.toISOString(),
      issueDate: row.issueDate.toISOString().slice(0, 10), issueTimeZone: row.issueTimeZone, status: row.revokedAt ? 'revoked' : 'active',
    })) };
  }
  async detail(actor: Actor, certificateId: string): Promise<CertificateDetail> {
    // Read certificate and audit history in one consistent snapshot.
    return this.db.$transaction(async tx => {
      const row = await tx.certificate.findFirst({
        where: { id: certificateId, tenantId: actor.tenantId },
        select: { id: true, serialNumber: true, issuedAt: true, issueDate: true, issueTimeZone: true,
          revokedAt: true, revocationReason: true,
          enrollment: { select: { learner: { select: { name: true } }, course: { select: { title: true } } } },
          auditEvents: { where: { tenantId: actor.tenantId }, orderBy: [{ occurredAt: 'asc' }, { action: 'asc' }],
            select: { action: true, occurredAt: true, actor: { select: { name: true } } } },
        },
      });
      if (!row) throw new NotFoundException('Certificate not found');
      return { id: row.id, serialNumber: row.serialNumber, learnerName: row.enrollment.learner.name,
        courseTitle: row.enrollment.course.title, issuedAt: row.issuedAt.toISOString(),
        issueDate: row.issueDate.toISOString().slice(0, 10), issueTimeZone: row.issueTimeZone,
        status: row.revokedAt ? 'revoked' : 'active', revokedAt: row.revokedAt?.toISOString() ?? null,
        revocationReason: row.revocationReason,
        auditEvents: row.auditEvents.map(event => ({ action: event.action, actorName: event.actor.name, occurredAt: event.occurredAt.toISOString() })),
      };
    }, { isolationLevel: 'RepeatableRead' });
  }
  async courses(actor: Actor): Promise<CourseListResponse> {
    return { items: await this.db.course.findMany({ where: { tenantId: actor.tenantId },
      orderBy: [{ title: 'asc' }, { id: 'asc' }], select: { id: true, title: true } }) };
  }
  async bulkIssue(actor: Actor, courseId: string): Promise<BulkIssuanceResponse> {
    const course = await this.db.course.findFirst({ where: { id: courseId, tenantId: actor.tenantId }, select: { id: true } });
    if (!course) throw new NotFoundException('Course not found');
    // Read the membership snapshot with a join: Prisma's relation loader generates
    // an IN parameter per learner, exceeding PostgreSQL's limit for large courses.
    const enrollments = await this.db.$queryRaw<{
      id: string; learnerId: string; learnerName: string;
      certificateId: string | null; revokedAt: Date | null;
    }[]>`SELECT e.id, l.id AS "learnerId", l.name AS "learnerName",
        c.id AS "certificateId", c."revokedAt"
      FROM "Enrollment" e
      JOIN "Learner" l ON l.id = e."learnerId" AND l."tenantId" = e."tenantId"
      LEFT JOIN "Certificate" c ON c."enrollmentId" = e.id AND c."tenantId" = e."tenantId"
      WHERE e."tenantId" = ${actor.tenantId}::uuid AND e."courseId" = ${courseId}::uuid
      ORDER BY e.id ASC`;
    const outcomes: BulkIssuanceOutcome[] = [];
    for (const enrollment of enrollments) {
      const learner = { enrollmentId: enrollment.id, learnerId: enrollment.learnerId, learnerName: enrollment.learnerName };
      // Certificates are permanent, so an existing one can safely be skipped from
      // the snapshot. New issuance still checks eligibility/existence under lock.
      if (enrollment.certificateId) {
        outcomes.push({ ...learner, status: 'skipped', reason: enrollment.revokedAt ? 'revoked' : 'already_issued' });
        continue;
      }
      try {
        const result = await this.issueWithOutcome(actor, enrollment.id);
        outcomes.push(result.created
          ? { ...learner, status: 'issued', certificateId: result.certificate.id, serialNumber: result.certificate.serialNumber }
          : { ...learner, status: 'skipped', reason: result.certificate.revokedAt ? 'revoked' : 'already_issued' });
      } catch (error: unknown) {
        outcomes.push(error instanceof ConflictException
          ? { ...learner, status: 'skipped', reason: 'incomplete' }
          : { ...learner, status: 'failed', reason: 'issuance_failed' });
      }
    }
    return { courseId, total: outcomes.length,
      issued: outcomes.filter(row => row.status === 'issued').length,
      skipped: outcomes.filter(row => row.status === 'skipped').length,
      failed: outcomes.filter(row => row.status === 'failed').length, outcomes };
  }
  async bulkIssueWithKey(actor: Actor, courseId: string, key: string): Promise<BulkIssuanceResponse> {
    const operation = await this.db.$transaction(async tx => {
      // Serialize creation across processes; hash collisions only add contention.
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`${actor.tenantId}:${actor.id}:${key}`}, 0))`;
      const existing = await tx.bulkIssuanceOperation.findUnique({
        where: { tenantId_requestedById_key: { tenantId: actor.tenantId, requestedById: actor.id, key } },
      });
      if (existing) {
        if (existing.courseId !== courseId) throw new ConflictException('Idempotency key already used for a different request');
        return existing;
      }
      const course = await tx.course.findFirst({ where: { id: courseId, tenantId: actor.tenantId }, select: { id: true } });
      if (!course) throw new NotFoundException('Course not found');
      const created = await tx.bulkIssuanceOperation.create({ data: { tenantId: actor.tenantId, requestedById: actor.id, courseId, key } });
      // Persist membership/names in the same transaction as operation creation.
      await tx.$executeRaw`INSERT INTO "BulkIssuanceItem" ("operationId", "enrollmentId", "learnerId", "learnerName")
        SELECT ${created.id}::uuid, e.id, l.id, l.name FROM "Enrollment" e
        JOIN "Learner" l ON l.id = e."learnerId" AND l."tenantId" = e."tenantId"
        WHERE e."tenantId" = ${actor.tenantId}::uuid AND e."courseId" = ${courseId}::uuid`;
      return created;
    }, { timeout: 30000 });
    const items = await this.db.bulkIssuanceItem.findMany({ where: { operationId: operation.id }, orderBy: { enrollmentId: 'asc' } });
    const outcomes: Prisma.JsonValue[] = [];
    for (const item of items) {
      if (item.outcome !== null) { outcomes.push(item.outcome); continue; }
      const where = { operationId_enrollmentId: { operationId: operation.id, enrollmentId: item.enrollmentId } };
      const learner = { enrollmentId: item.enrollmentId, learnerId: item.learnerId, learnerName: item.learnerName };
      const lock = async (tx: Prisma.TransactionClient) => {
        await tx.$queryRaw`SELECT "enrollmentId" FROM "BulkIssuanceItem"
          WHERE "operationId" = ${operation.id}::uuid AND "enrollmentId" = ${item.enrollmentId}::uuid FOR UPDATE`;
        return tx.bulkIssuanceItem.findUniqueOrThrow({ where });
      };
      let outcome: Prisma.JsonValue;
      try {
        outcome = await this.db.$transaction(async tx => {
          const current = await lock(tx);
          if (current.outcome !== null) return current.outcome;
          const issued = await this.issueInTransaction(tx, actor, item.enrollmentId);
          const saved: BulkIssuanceOutcome = issued.created
            ? { ...learner, status: 'issued', certificateId: issued.certificate.id, serialNumber: issued.certificate.serialNumber }
            : { ...learner, status: 'skipped', reason: issued.certificate.revokedAt ? 'revoked' : 'already_issued' };
          await tx.bulkIssuanceItem.update({ where, data: { outcome: saved } });
          return saved;
        });
      } catch (error: unknown) {
        // Failed issuance rolls back before recording its outcome. A concurrent
        // successful caller may already have finalized this item; preserve it.
        outcome = await this.db.$transaction(async tx => {
          const current = await lock(tx);
          if (current.outcome !== null) return current.outcome;
          const saved: BulkIssuanceOutcome = error instanceof ConflictException
            ? { ...learner, status: 'skipped', reason: 'incomplete' }
            : { ...learner, status: 'failed', reason: 'issuance_failed' };
          await tx.bulkIssuanceItem.update({ where, data: { outcome: saved } });
          return saved;
        });
      }
      outcomes.push(outcome);
    }
    const result = { courseId: operation.courseId, total: outcomes.length,
      issued: outcomes.filter(row => typeof row === 'object' && row !== null && !Array.isArray(row) && row.status === 'issued').length,
      skipped: outcomes.filter(row => typeof row === 'object' && row !== null && !Array.isArray(row) && row.status === 'skipped').length,
      failed: outcomes.filter(row => typeof row === 'object' && row !== null && !Array.isArray(row) && row.status === 'failed').length, outcomes };
    if (!isBulkIssuanceResponse(result)) throw new Error('Invalid saved bulk result');
    return result;
  }
  async issue(actor: Actor, enrollmentId: string) {
    return (await this.issueWithOutcome(actor, enrollmentId)).certificate;
  }
  private async issueWithOutcome(actor: Actor, enrollmentId: string) {
    return this.db.$transaction(tx => this.issueInTransaction(tx, actor, enrollmentId));
  }
  private async issueInTransaction(tx: Prisma.TransactionClient, actor: Actor, enrollmentId: string) {
    // One lock per enrollment serializes concurrent issuance without retrying side effects.
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Enrollment" WHERE id = ${enrollmentId}::uuid AND "tenantId" = ${actor.tenantId}::uuid FOR UPDATE`;
    if (!rows.length) throw new NotFoundException('Enrollment not found');
    const enrollment = await tx.enrollment.findUniqueOrThrow({ where: { id: enrollmentId }, include: { certificate: true } });
    if (enrollment.certificate) return { certificate: enrollment.certificate, created: false };
    if (enrollment.status !== 'COMPLETED') throw new ConflictException('Only completed enrollments are eligible');
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: actor.tenantId } });
    const issuedAt = new Date();
    // The database independently verifies eligibility/date and creates the audit event.
    const certificate = await tx.certificate.create({ data: { tenantId: actor.tenantId, enrollmentId, issuedById: actor.id, issuedAt, issueDate: localIssueDate(issuedAt, tenant.timeZone), issueTimeZone: tenant.timeZone } });
    return { certificate, created: true };
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
