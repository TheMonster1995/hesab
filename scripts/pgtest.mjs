import EmbeddedPostgres from 'embedded-postgres';

const dataDir = process.argv[2] || './.pgdata-smoke';

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'password',
  port: 5433,
  persistent: false,
});

console.log('initialising...');
await pg.initialise();
console.log('starting...');
await pg.start();
console.log('creating database...');
try {
  await pg.createDatabase('hesab_test');
} catch (e) {
  console.log('createDatabase note:', e.message);
}
console.log('OK: postgres up at postgresql://postgres:password@localhost:5433/hesab_test');
await pg.stop();
console.log('stopped cleanly');
process.exit(0);
