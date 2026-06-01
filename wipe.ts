import { db } from './src/lib/db/index';
import { sql } from 'drizzle-orm';

async function wipeAndMigrate() {
  console.log('Wiping public schema...');
  await db.execute(sql`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
  console.log('Schema wiped!');
}

wipeAndMigrate().catch((err) => {
  console.error('Wipe failed:', err);
  process.exit(1);
});
