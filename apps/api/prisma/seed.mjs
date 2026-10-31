import { DatabaseService } from '../dist/common/database/database.service.js';
import { requireDemoEnvironment, seedDemoData } from './demo-data.mjs';

requireDemoEnvironment();
const db = new DatabaseService();
try {
  await seedDemoData(db, process.env.DEMO_TOKEN_FILE ?? new URL('../../../.demo-tokens.json', import.meta.url));
  console.log('East/West demo fixtures ready. Private bearer-token file written (mode 0600).');
} finally { await db.$disconnect(); }
