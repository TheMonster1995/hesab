# hesab

A small, self-hosted expense-splitting ledger for a group of friends — who paid, who
shares, and the shortest path back to even.

See [`docs/hesab-overview.html`](docs/hesab-overview.html) for the full product brief
and phased build plan.

## Stack

- **Frontend** — Vite + React (TypeScript), Tailwind CSS
- **API** — Express + GraphQL (Apollo Server)
- **Database** — PostgreSQL via Prisma
- **Auth** — JWT (argon2 password hashing) *(Phase 1)*
- **Deploy** — Docker Compose (web + api + db)

## Layout

```
packages/
  api/   Express + Apollo GraphQL server, Prisma schema
  web/   Vite + React client
docs/    Product brief
```

## Local development

Requires Node 20+ and a reachable PostgreSQL (or use Docker for the DB only).

```bash
npm install

# point the API at your database
cp .env.example .env            # then edit DATABASE_URL to localhost for local dev

# generate the Prisma client
npm run prisma:generate

# run api (:4000) and web (:5173) together
npm run dev
```

The Vite dev server proxies `/graphql` to the API, so open http://localhost:5173.

## Testing

No external database needed — `scripts/pg-daemon.mjs` boots a throwaway Postgres
(via `embedded-postgres`) on port 5433.

```bash
node scripts/pg-daemon.mjs &   # wait for "PGREADY", DB = hesab_test on :5433
DATABASE_URL='postgresql://postgres:password@localhost:5433/hesab_test' \
  npx prisma migrate dev --schema packages/api/prisma/schema.prisma

# pure unit tests (no server)
node scripts/test-split.mjs
node scripts/test-simplify.mjs
node scripts/test-notifications.mjs

# integration tests — start the API on :4100 first, then:
DATABASE_URL='postgresql://postgres:password@localhost:5433/hesab_test' \
  JWT_SECRET=test PORT=4100 node packages/api/dist/index.js &
node scripts/test-auth.mjs        # also: test-groups, test-expenses,
                                  # test-balances, test-advanced, test-polish, test-export
```

## Self-host with Docker

```bash
cp .env.example .env            # set a real JWT_SECRET
docker compose up --build
```

- Web: http://localhost:8080
- GraphQL API: http://localhost:4000/graphql

The API runs `prisma migrate deploy` on start, so the schema is applied automatically
once migrations exist (added from Phase 1 onward).

## Email notifications

Members with an account are emailed when an expense they're in is added, or when they're
paid. With no mail server configured, notifications are written to the API logs. To send
real email, set these on the `api` service:

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM="hesab <hesab@example.com>"
```

## Backup & restore

```bash
./scripts/backup.sh nightly        # -> backups/hesab-nightly-<timestamp>.sql
./scripts/restore.sh backups/hesab-nightly-20260101-020000.sql
```

Both use `docker compose exec db …`, so run them from the project root with the stack up.
Schedule `backup.sh` from cron for automatic nightly dumps.
