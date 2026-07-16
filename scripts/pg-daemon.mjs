// Local throwaway Postgres for development / verification without Docker.
// Boots a real postgres on :5433, keeps it alive until killed (SIGINT/SIGTERM).
// Connection: postgresql://postgres:password@localhost:5433/hesab_test
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';

const DATA_DIR = './.pgdata';

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: 'postgres',
  password: 'password',
  port: 5433,
  persistent: true,
});

if (!fs.existsSync(`${DATA_DIR}/PG_VERSION`)) {
  await pg.initialise();
}
await pg.start();
try {
  await pg.createDatabase('hesab_test');
} catch {
  // already exists — fine
}
console.log('PGREADY postgresql://postgres:password@localhost:5433/hesab_test');

async function shutdown() {
  try {
    await pg.stop();
  } catch {
    /* ignore */
  }
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
setInterval(() => {}, 1 << 30);
