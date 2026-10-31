import 'reflect-metadata';
import { randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { DatabaseService } from '../dist/common/database/database.service.js';
import { CertificatesService } from '../dist/modules/certificates/certificates.service.js';
import { hashToken } from '../dist/modules/auth/auth.module.js';

if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const tokenFile = process.env.DEMO_TOKEN_FILE ?? new URL('../../../.demo-tokens.json', import.meta.url);
let saved = [];
try { saved = JSON.parse(await readFile(tokenFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const id = key => {
  const hex = createHash('sha256').update(`training-demo:${key}`).digest('hex').slice(0, 32);
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};
const db = new DatabaseService();
const service = new CertificatesService(db);
const tokens = [];
try {
  for (const [key, name, timeZone] of [['east', 'Shanghai Training', 'Asia/Shanghai'], ['west', 'New York Training', 'America/New_York']]) {
    const tenantId = id(key), adminId = id(`${key}:admin`);
    const token = saved.find(row => row.adminId === adminId)?.token ?? randomBytes(32).toString('base64url');
    const actor = { id: adminId, tenantId, name: `${name} Admin` };
    await db.$transaction(async tx => {
      await tx.tenant.upsert({ where: { id: tenantId }, create: { id: tenantId, name, timeZone }, update: {} });
      await tx.admin.upsert({ where: { id: adminId }, create: { ...actor, tokenHash: hashToken(token) }, update: { tokenHash: hashToken(token) } });
      for (const title of ['Safety', 'Leadership']) {
        const courseId = id(`${key}:${title}`);
        await tx.course.upsert({ where: { id: courseId }, create: { id: courseId, tenantId, title }, update: {} });
        for (const [index, state] of ['INCOMPLETE', 'COMPLETED', 'CERTIFIED', 'REVOKED'].entries()) {
          const learnerId = id(`${key}:learner:${index}`), enrollmentId = id(`${key}:${title}:${index}`);
          await tx.learner.upsert({ where: { id: learnerId }, create: { id: learnerId, tenantId, name: `Demo Learner ${index + 1}`, email: `learner${index + 1}@${key}.example.test` }, update: {} });
          const completed = state !== 'INCOMPLETE';
          await tx.enrollment.upsert({ where: { id: enrollmentId }, create: { id: enrollmentId, tenantId, learnerId, courseId, status: completed ? 'COMPLETED' : 'INCOMPLETE', completedAt: completed ? new Date() : null }, update: {} });
        }
      }
    });
    for (const title of ['Safety', 'Leadership']) {
      for (const index of [2, 3]) {
        const certificate = await service.issue(actor, id(`${key}:${title}:${index}`));
        if (index === 3) await service.revoke(actor, certificate.id, 'Demo revocation');
      }
    }
    tokens.push({ tenantId, adminId, tenant: name, token });
  }
  await writeFile(tokenFile, JSON.stringify(tokens, null, 2) + '\n', { mode: 0o600 });
  await chmod(tokenFile, 0o600);
  console.log('Demo seed complete. Bearer tokens are in the repository-root .demo-tokens.json (mode 0600).');
} finally { await db.$disconnect(); }
