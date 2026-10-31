import { parentPort } from 'node:worker_threads';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseService } from '../../common/database/database.service.js';
import type { CertificateExport } from '../../generated/prisma/client.js';
import { claimExport, exportFilter, exportJoins, exportOrder } from './export-queue.js';
import { csvHeader, csvRow } from './csv.js';

const db = new DatabaseService();
let stopped = false;
parentPort?.on('message', () => { stopped = true; });
interface ExportRow { learnerName: string; courseTitle: string; serialNumber: string; issueDate: string }
async function generate(job: CertificateExport) {
  const ownership = { id: job.id, leaseId: job.leaseId, status: 'running' };
  try {
    await db.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '45s'`;
      const filter = exportFilter(job.tenantId, job.search);
      const [count] = await tx.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total ${exportJoins} WHERE ${filter}`;
      const total = count!.total;
      const updated = await db.certificateExport.updateMany({ where: ownership, data: { total } });
      if (!updated.count) throw new Error('Lost lease');
      await tx.$executeRaw`DECLARE certificate_export_cursor NO SCROLL CURSOR FOR
        SELECT l.name AS "learnerName", co.title AS "courseTitle", c."serialNumber", to_char(c."issueDate", 'YYYY-MM-DD') AS "issueDate"
        ${exportJoins} WHERE ${filter} ORDER BY ${exportOrder(job.sortBy, job.sortDirection)}`;
      let processed = 0, sequence = 0, bytes = 0;
      // Each persisted chunk is bounded. Rows never accumulate across batches.
      async function persist(content: string) {
        const buffer = Buffer.from(content, 'utf8');
        bytes += buffer.byteLength;
        if (bytes > 128 * 1024 * 1024) throw new Error('Export exceeds size limit');
        await db.$transaction(async write => {
          const owned = await write.certificateExport.updateMany({ where: ownership, data: { processed } });
          if (!owned.count) throw new Error('Lost lease');
          await write.certificateExportChunk.create({ data: { exportId: job.id, sequence: sequence++, content: buffer } });
        });
      }
      await persist(csvHeader);
      while (!stopped) {
        const rows = await tx.$queryRaw<ExportRow[]>`FETCH FORWARD 1000 FROM certificate_export_cursor`;
        if (!rows.length) break;
        let content = '', contentBytes = 0;
        for (const row of rows) {
          const line = csvRow(row);
          const lineBytes = Buffer.byteLength(line);
          if (lineBytes > 2 * 1024 * 1024) throw new Error('Export row exceeds size limit');
          if (contentBytes + lineBytes > 2 * 1024 * 1024) {
            await persist(content); content = ''; contentBytes = 0;
          }
          content += line; contentBytes += lineBytes; processed++;
        }
        if (content) await persist(content);
      }
      if (stopped) throw new Error('Worker stopped');
      await tx.$executeRaw`CLOSE certificate_export_cursor`;
    }, { isolationLevel: 'RepeatableRead', timeout: 55000, maxWait: 3000 });
    await db.certificateExport.updateMany({ where: ownership, data: {
      status: 'completed', completedAt: new Date(), expiresAt: new Date(Date.now() + 86400000), leaseId: null, leaseUntil: null,
    } });
  } catch {
    if (stopped) return; // Leave the durable lease for recovery on restart.
    await db.$transaction(async tx => {
      const owned = await tx.certificateExport.updateMany({ where: ownership, data: {
        status: 'failed', error: 'Export could not be completed. Please retry.', leaseId: null, leaseUntil: null,
      } });
      if (owned.count) await tx.certificateExportChunk.deleteMany({ where: { exportId: job.id } });
    }).catch(() => {}); // A database outage leaves a recoverable lease.
  }
}
try {
  while (!stopped) {
    try {
      const job = await claimExport(db);
      if (job) { await generate(job); continue; }
    } catch { /* Database outages do not affect HTTP health or expose credentials. */ }
    await delay(500);
  }
} finally { await db.$disconnect(); parentPort?.close(); }
