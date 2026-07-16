#!/usr/bin/env bash
# Restore the hesab Postgres database from a SQL dump into the docker-compose "db" service.
# Usage: ./scripts/restore.sh backups/hesab-manual-YYYYMMDD-HHMMSS.sql
set -euo pipefail

FILE="${1:?usage: ./scripts/restore.sh <dump.sql>}"
: "${POSTGRES_USER:=hesab}"
: "${POSTGRES_DB:=hesab}"

echo "Restoring $FILE into database '$POSTGRES_DB'…"
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$FILE"
echo "Done."
