import { db } from './src/lib/db/index';
import { migrate } from 'drizzle-orm/neon-http/migrator';

async function runMigrations() {
  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: './src/lib/db/migrations' });
  console.log('Migrations completed!');
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
