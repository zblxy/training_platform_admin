import { randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client.js';
import { DatabaseService } from '../../common/database/database.service.js';

export const exportQueueLock = 731042619;
export const exportStatusSelect = {
  id: true, search: true, sortBy: true, sortDirection: true, status: true,
  processed: true, total: true, createdAt: true, expiresAt: true, error: true,
} as const;
export async function claimExport(db: DatabaseService) {
  return db.$transaction(async tx => {
    const [lock] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${exportQueueLock}) AS locked`;
    if (!lock?.locked) return null;
    const now = new Date();
    await tx.certificateExport.deleteMany({ where: { expiresAt: { lte: now } } });
    // One generation at a time across replicas; queued requests remain responsive.
    if (await tx.certificateExport.findFirst({ where: { status: 'running', leaseUntil: { gt: now } }, select: { id: true } })) return null;
    const job = await tx.certificateExport.findFirst({
      where: { OR: [{ status: 'queued' }, { status: 'running', leaseUntil: { lte: now } }] },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    if (!job) return null;
    const ownership = { id: job.id, status: job.status, leaseId: job.leaseId };
    if (job.attempts >= 3) {
      const failed = await tx.certificateExport.updateMany({ where: ownership, data: { status: 'failed', error: 'Export interrupted repeatedly. Please start a new export.', leaseId: null, leaseUntil: null } });
      if (failed.count) await tx.certificateExportChunk.deleteMany({ where: { exportId: job.id } });
      return null;
    }
    const claimed = await tx.certificateExport.updateMany({ where: ownership, data: {
      status: 'running', leaseId: randomUUID(), leaseUntil: new Date(Date.now() + 90000),
      attempts: { increment: 1 }, processed: 0, total: 0, error: null,
    } });
    if (!claimed.count) return null;
    // Fence the old worker under the job row lock BEFORE deleting its chunks.
    // Otherwise an in-flight old writer could insert a stale trailing chunk.
    await tx.certificateExportChunk.deleteMany({ where: { exportId: job.id } });
    return tx.certificateExport.findUniqueOrThrow({ where: { id: job.id } });
  });
}
export function exportFilter(tenantId: string, search: string): Prisma.Sql {
  return Prisma.sql`c."tenantId" = ${tenantId}::uuid ${search ? Prisma.sql`AND (c."serialNumber" = ${search.toUpperCase()} OR l.name ILIKE ${'%' + search.replace(/[\\%_]/g, '\\$&') + '%'})` : Prisma.empty}`;
}
export function exportOrder(sortBy: string, sortDirection: string): Prisma.Sql {
  const fields: Record<string, Prisma.Sql> = {
    issuedAt: Prisma.sql`c."issueDate"`, learnerName: Prisma.sql`l.name`,
    serialNumber: Prisma.sql`c."serialNumber"`, courseTitle: Prisma.sql`co.title`,
  };
  const field = fields[sortBy];
  if (!field || !['asc', 'desc'].includes(sortDirection)) throw new Error('Invalid export sort');
  return Prisma.sql`${field} ${sortDirection === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`}, c.id ASC`;
}
export const exportJoins = Prisma.sql`FROM "Certificate" c
  JOIN "Enrollment" e ON e.id = c."enrollmentId" AND e."tenantId" = c."tenantId"
  JOIN "Learner" l ON l.id = e."learnerId" AND l."tenantId" = e."tenantId"
  JOIN "Course" co ON co.id = e."courseId" AND co."tenantId" = e."tenantId"`;
