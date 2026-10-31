import 'reflect-metadata';
import { createHash, randomBytes } from 'node:crypto';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { hashToken } from '../dist/modules/auth/auth.module.js';
import { CertificatesService, localIssueDate } from '../dist/modules/certificates/certificates.service.js';

export const demoTenants = [
  { key: 'east', name: 'East', timeZone: 'Australia/Sydney', admin: 'alice@east.test' },
  { key: 'west', name: 'West', timeZone: 'Australia/Perth', admin: 'bob@west.test' },
];

export function demoId(key) {
  const hex = createHash('sha256').update(`training-demo:${key}`).digest('hex').slice(0, 32);
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export function requireDemoEnvironment() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo generation is disabled in production');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
}

export async function seedDemoData(db, tokenFile) {
  let saved = [];
  try { saved = JSON.parse(await readFile(tokenFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const service = new CertificatesService(db);
  const tokens = [];
  for (const { key, name, timeZone, admin } of demoTenants) {
    const tenantId = demoId(key), adminId = demoId(`${key}:admin`);
    const token = saved.find(row => row.adminId === adminId)?.token ?? randomBytes(32).toString('base64url');
    const actor = { id: adminId, tenantId, name: admin };
    // Original IDs let an existing demo upgrade without replacing certificate history.
    await db.$transaction(async tx => {
      await tx.tenant.upsert({ where: { id: tenantId }, create: { id: tenantId, name, timeZone }, update: { name, timeZone } });
      await tx.admin.upsert({ where: { id: adminId }, create: { ...actor, tokenHash: hashToken(token) }, update: { name: admin, tokenHash: hashToken(token) } });
      for (const [courseKey, title] of [['Safety', 'Safety 101'], ['Leadership', 'Leadership']]) {
        const courseId = demoId(`${key}:${courseKey}`);
        await tx.course.upsert({ where: { id: courseId }, create: { id: courseId, tenantId, title }, update: { title } });
        for (const [index, state] of ['INCOMPLETE', 'COMPLETED', 'CERTIFIED', 'REVOKED'].entries()) {
          const learnerId = demoId(`${key}:learner:${index}`), enrollmentId = demoId(`${key}:${courseKey}:${index}`);
          const learnerName = ['Jordan Smith', 'Sam Taylor', 'Alex Lee', 'Morgan Chen'][index];
          await tx.learner.upsert({ where: { id: learnerId }, create: { id: learnerId, tenantId, name: learnerName, email: `learner${index + 1}@${key}.example.test` }, update: { name: learnerName } });
          const completed = state !== 'INCOMPLETE';
          await tx.enrollment.upsert({ where: { id: enrollmentId }, create: { id: enrollmentId, tenantId, learnerId, courseId, status: completed ? 'COMPLETED' : 'INCOMPLETE', completedAt: completed ? new Date() : null }, update: {} });
        }
      }
    });
    for (const courseKey of ['Safety', 'Leadership']) {
      for (const index of [2, 3]) {
        const certificate = await service.issue(actor, demoId(`${key}:${courseKey}:${index}`));
        if (index === 3) await service.revoke(actor, certificate.id, 'Demo revocation');
      }
    }
    tokens.push({ tenantId, adminId, tenant: name, admin, token });
  }
  await writeFile(tokenFile, JSON.stringify(tokens, null, 2) + '\n', { mode: 0o600 });
  await chmod(tokenFile, 0o600);
}

// Each bounded batch is atomic. Tenant locking serializes concurrent generators;
// triggers remain enabled, validating dates and generating exactly one issuance audit.
export async function generateEastCertificates(db, { target = 100_000, batchSize = 1000, onProgress = () => {} } = {}) {
  if (!Number.isSafeInteger(target) || target < 1 || !Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 1000) throw new Error('Invalid demo target or batch size');
  const tenantId = demoId('east'), courseId = demoId('east:Safety'), adminId = demoId('east:admin');
  for (;;) {
    const result = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id = ${tenantId}::uuid FOR UPDATE`;
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
      const total = await tx.certificate.count({ where: { tenantId } });
      if (total > target) throw new Error(`East already has ${total} certificates, exceeding target ${target}; no data was deleted`);
      if (total === target) return { total, done: true };
      const size = Math.min(batchSize, target - total);
      const learners = [], enrollments = [], certificates = [];
      const issuedAt = new Date(), issueDate = localIssueDate(issuedAt, tenant.timeZone);
      for (let index = total; index < total + size; index++) {
        const learnerId = demoId(`east:bulk:learner:${index}`), enrollmentId = demoId(`east:bulk:enrollment:${index}`);
        learners.push({ id: learnerId, tenantId, name: `Volume Learner ${String(index + 1).padStart(6, '0')}`, email: `volume-${index + 1}@east.test` });
        enrollments.push({ id: enrollmentId, tenantId, learnerId, courseId, status: 'COMPLETED', completedAt: issuedAt });
        certificates.push({ id: demoId(`east:bulk:certificate:${index}`), tenantId, enrollmentId, issuedById: adminId, issuedAt, issueDate, issueTimeZone: tenant.timeZone });
      }
      await tx.learner.createMany({ data: learners });
      await tx.enrollment.createMany({ data: enrollments });
      await tx.certificate.createMany({ data: certificates });
      return { total: total + size, done: total + size === target };
    }, { timeout: 60_000, maxWait: 60_000 });
    onProgress(result.total);
    if (result.done) return result.total;
  }
}
