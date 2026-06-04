#!/bin/bash
# Backup PostgreSQL — eseguire dalla directory root del progetto
# Cron suggerito: 0 2 * * * /opt/moneto/scripts/backup.sh >> /var/log/moneto-backup.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETAIN_DAYS=30

mkdir -p "$BACKUP_DIR"

# Legge variabili dal .env.prod
source "$PROJECT_DIR/.env.prod" 2>/dev/null || true

POSTGRES_USER="${POSTGRES_USER:-moneto}"
POSTGRES_DB="${POSTGRES_DB:-monetodb}"

echo "[$(date)] Avvio backup $POSTGRES_DB..."

docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" exec -T db \
    pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
    | gzip > "$BACKUP_DIR/moneto_${DATE}.sql.gz"

SIZE=$(du -sh "$BACKUP_DIR/moneto_${DATE}.sql.gz" | cut -f1)
echo "[$(date)] Backup completato: moneto_${DATE}.sql.gz ($SIZE)"

# Elimina backup più vecchi di RETAIN_DAYS giorni
find "$BACKUP_DIR" -name "moneto_*.sql.gz" -mtime +$RETAIN_DAYS -delete
echo "[$(date)] Pulizia: rimossi backup più vecchi di $RETAIN_DAYS giorni"
