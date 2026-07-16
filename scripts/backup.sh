#!/usr/bin/env bash
# Back up the hesab Postgres database from the docker-compose "db" service.
# Usage: ./scripts/backup.sh [label]   ->   backups/hesab-<label>-<date>.sql
set -euo pipefail

LABEL="${1:-manual}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="backups/hesab-${LABEL}-${STAMP}.sql"
mkdir -p backups

: "${POSTGRES_USER:=hesab}"
: "${POSTGRES_DB:=hesab}"

docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$OUT"
echo "Wrote $OUT"
