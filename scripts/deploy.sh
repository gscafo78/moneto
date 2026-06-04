#!/bin/bash
# Deploy / aggiornamento in produzione
# Uso: ./scripts/deploy.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "==> Pull ultime modifiche"
git pull origin main

echo "==> Build immagini"
docker compose -f docker-compose.prod.yml build --no-cache

echo "==> Riavvio servizi"
docker compose -f docker-compose.prod.yml up -d

echo "==> Attesa backend sano..."
sleep 8
docker compose -f docker-compose.prod.yml ps

echo "==> Deploy completato ✓"
