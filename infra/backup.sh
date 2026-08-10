#!/usr/bin/env bash
#
# Backup do Postgres. Agendar no cron do usuário de deploy:
#   0 3 * * * /opt/madmail/backup.sh >> /opt/madmail/backups/backup.log 2>&1
#
set -euo pipefail

STACK_DIR="${STACK_DIR:-/opt/madmail}"
BACKUP_DIR="$STACK_DIR/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

# shellcheck disable=SC1091
set -a; . "$STACK_DIR/.env"; set +a

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="$BACKUP_DIR/madmail-$STAMP.sql.gz"

echo "[$(date '+%F %T')] iniciando backup"

docker compose -f "$STACK_DIR/compose.prod.yml" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists \
  | gzip > "$FILE"

SIZE=$(du -h "$FILE" | cut -f1)

# Um dump saudável não tem 20 bytes: se veio vazio, é falha silenciosa.
if [ "$(stat -c%s "$FILE")" -lt 1024 ]; then
  echo "[$(date '+%F %T')] ERRO: dump menor que 1KB, backup suspeito: $FILE" >&2
  exit 1
fi

echo "[$(date '+%F %T')] backup ok: $FILE ($SIZE)"

find "$BACKUP_DIR" -name 'madmail-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
echo "[$(date '+%F %T')] backups mantidos: $(find "$BACKUP_DIR" -name 'madmail-*.sql.gz' | wc -l)"
