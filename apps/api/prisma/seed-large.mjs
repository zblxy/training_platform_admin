import { DatabaseService } from '../dist/common/database/database.service.js';
import { generateEastCertificates, requireDemoEnvironment, seedDemoData } from './demo-data.mjs';

requireDemoEnvironment();
const db = new DatabaseService();
try {
  await seedDemoData(db, process.env.DEMO_TOKEN_FILE ?? new URL('../../../.demo-tokens.json', import.meta.url));
  await generateEastCertificates(db, { onProgress: total => console.log(`East certificates: ${total}/100000`) });
  console.log('Demo data ready: East has exactly 100000 certificates. West retains its small fixture dataset.');
} finally { await db.$disconnect(); }
