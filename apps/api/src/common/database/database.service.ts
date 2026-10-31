import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    // Connections stay lazy so process health does not depend on database availability.
    const schema = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).searchParams.get('schema') ?? 'public' : 'public';
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) throw new Error('Invalid database schema');
    super({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 3000, options: `-c search_path=${schema}` }, { schema }) });
  }
  async onModuleDestroy(): Promise<void> { await this.$disconnect(); }
}
