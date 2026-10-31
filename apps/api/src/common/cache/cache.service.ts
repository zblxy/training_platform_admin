import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createClient } from 'redis';

export const CACHE_REDIS_URL = Symbol('CACHE_REDIS_URL');
const PREFIX = 'training:cache:';

/** Optional cache: callers must handle misses by consulting their source of truth. */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly client;
  private connecting?: Promise<void>;
  private closed = false;

  constructor(@Inject(CACHE_REDIS_URL) url: string) {
    this.client = createClient({
      url,
      disableOfflineQueue: true,
      commandsQueueMaxLength: 1000,
      socket: { connectTimeout: 500, reconnectStrategy: false },
    });
    // Redis emits connection errors separately from command promise rejections.
    // Handle the event without logging URLs, keys, payloads, or credentials.
    this.client.on('error', () => {});
  }

  private async ready(): Promise<void> {
    if (this.closed) throw new Error('Cache closed');
    if (this.client.isReady) return;
    if (!this.connecting) {
      this.connecting = (async () => {
        // Bound the complete handshake as well as the TCP connection.
        const timeout = setTimeout(() => {
          if (this.client.isOpen) this.client.destroy();
        }, 500);
        try { await this.client.connect(); }
        finally { clearTimeout(timeout); this.connecting = undefined; }
      })();
    }
    await this.connecting;
  }

  /** Returns null for a missing key or unavailable cache. */
  async get(key: string): Promise<string | null> {
    try {
      await this.ready();
      return await this.client.withCommandOptions({ timeout: 500 }).get(PREFIX + key);
    } catch { return null; }
  }

  /** TTL is mandatory, in whole seconds. Returns false if Redis is unavailable. */
  async set(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0) throw new RangeError('Cache TTL must be a positive integer in seconds');
    try {
      await this.ready();
      await this.client.withCommandOptions({ timeout: 500 }).set(PREFIX + key, value, { EX: ttlSeconds });
      return true;
    } catch { return false; }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await this.ready();
      await this.client.withCommandOptions({ timeout: 500 }).del(PREFIX + key);
      return true;
    } catch { return false; }
  }

  onModuleDestroy(): void {
    this.closed = true;
    if (this.client.isOpen) this.client.destroy();
  }
}
