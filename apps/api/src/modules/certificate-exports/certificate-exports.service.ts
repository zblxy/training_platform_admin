import { ConflictException, HttpException, Injectable, NotFoundException, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Worker } from 'node:worker_threads';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Response } from 'express';
import { DatabaseService } from '../../common/database/database.service.js';
import type { Actor } from '../auth/auth.module.js';
import type { CertificateQueryDto } from '../certificates/list-certificates.dto.js';
import { exportQueueLock, exportStatusSelect } from './export-queue.js';

@Injectable()
export class CertificateExportsService implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;
  private restart?: ReturnType<typeof setTimeout>;
  private stopping = false;
  constructor(private readonly db: DatabaseService) {}
  onModuleInit() { if (process.env.DATABASE_URL) this.startWorker(); }
  private startWorker() {
    if (this.stopping) return;
    const worker = new Worker(new URL('./export-worker.js', import.meta.url));
    this.worker = worker;
    worker.on('error', () => { /* Exit handler restarts without logging sensitive errors. */ });
    worker.once('exit', () => {
      if (this.worker === worker) this.worker = undefined;
      if (!this.stopping) {
        this.restart = setTimeout(() => this.startWorker(), 1000);
        this.restart.unref();
      }
    });
    worker.unref();
  }
  async onModuleDestroy() {
    this.stopping = true;
    clearTimeout(this.restart);
    if (this.worker) await this.worker.terminate();
  }
  async create(actor: Actor, query: CertificateQueryDto) {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${exportQueueLock})::text`;
      const existing = await tx.certificateExport.findFirst({ where: {
        tenantId: actor.tenantId, requestedById: actor.id, status: { in: ['queued', 'running'] },
      }, select: exportStatusSelect });
      if (existing) {
        if (existing.search === query.search && existing.sortBy === query.sortBy && existing.sortDirection === query.sortDirection) return existing;
        throw new ConflictException('An export is already in progress. Wait for it to finish.');
      }
      if (await tx.certificateExport.count({ where: { status: { in: ['queued', 'running'] } } }) >= 20)
        throw new HttpException('Export queue is full. Please try again shortly.', 429);
      return tx.certificateExport.create({ data: {
        tenantId: actor.tenantId, requestedById: actor.id,
        search: query.search, sortBy: query.sortBy, sortDirection: query.sortDirection,
        expiresAt: new Date(Date.now() + 86400000),
      }, select: exportStatusSelect });
    });
  }
  async status(actor: Actor, id: string) {
    const job = await this.db.certificateExport.findFirst({ where: {
      id, tenantId: actor.tenantId, requestedById: actor.id, expiresAt: { gt: new Date() },
    }, select: exportStatusSelect });
    if (!job) throw new NotFoundException('Export not found or expired');
    return job;
  }
  async download(actor: Actor, id: string, response: Response) {
    const job = await this.status(actor, id);
    if (job.status !== 'completed') throw new ConflictException('Export is not ready for download');
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="certificates-${id}.csv"`);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      await this.db.$transaction(async tx => {
        async function* chunks() {
          let sequence = 0;
          while (!response.destroyed) {
            const chunk = await tx.certificateExportChunk.findUnique({ where: { exportId_sequence: { exportId: id, sequence } } });
            if (!chunk) {
              if (sequence === 0) throw new Error('Export file unavailable');
              return;
            }
            yield Buffer.from(chunk.content); sequence++;
          }
        }
        await pipeline(Readable.from(chunks(), { objectMode: false, highWaterMark: 65536 }), response, { signal: AbortSignal.timeout(60000) });
      }, { isolationLevel: 'RepeatableRead', timeout: 65000 });
    } catch { response.destroy(); }
  }
}
