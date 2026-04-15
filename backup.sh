#!/usr/bin/env bash
#
# PostgreSQL backup script for autochat-ai
# Dumps the database via docker compose, compresses with gzip,
# and removes backups older than 30 days.
#

set -euo pipefail

BACKUP_DIR="/opt/autochat-ai/backups"
COMPOSE_FILE="/opt/autochat-ai/docker-compose.yml"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M)"
BACKUP_FILE="${BACKUP_DIR}/autochat_${TIMESTAMP}.sql.gz"
LOG_FILE="${BACKUP_DIR}/backup.log"
RETENTION_DAYS=30

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

log "Starting PostgreSQL backup..."

# Dump and compress
if sudo docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U autochat autochat | gzip > "$BACKUP_FILE"; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log "Backup successful: ${BACKUP_FILE} (${SIZE})"
else
    log "ERROR: Backup failed!"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Verify the backup is not empty
if [ ! -s "$BACKUP_FILE" ]; then
    log "ERROR: Backup file is empty, removing it."
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Delete backups older than 30 days
DELETED=$(find "$BACKUP_DIR" -name "autochat_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
    log "Cleaned up ${DELETED} backup(s) older than ${RETENTION_DAYS} days."
fi

log "Backup complete."
