import { Module } from '@nestjs/common';
import { readRedisUrl } from '../../config/environment.js';
import { CACHE_REDIS_URL, CacheService } from './cache.service.js';

@Module({
  providers: [
    { provide: CACHE_REDIS_URL, useFactory: () => readRedisUrl(process.env) },
    CacheService,
  ],
  exports: [CacheService],
})
export class CacheModule {}
