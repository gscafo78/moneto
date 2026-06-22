#!/usr/bin/env bash
# Automatizza il bump di versione, il tag git e l'aggiornamento del CHANGELOG.
# Uso: ./scripts/release.sh <patch|minor|major>
#
# Passi eseguiti:
#   1. Legge la versione corrente da VERSION
#   2. Calcola la nuova versione (patch / minor / major)
#   3. Aggiorna VERSION
#   4. Sincronizza "version" in frontend/package.json
#   5. Aggiorna APP_VERSION in .env (file letto da docker-compose per la
#      sostituzione delle variabili — non .env.prod, che viene solo passato
#      come env_file al container e non partecipa all'interpolazione ${...})
#   6. Inserisce intestazione vuota in CHANGELOG.md pronta per essere riempita
#   7. Crea il commit e il tag git

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION_FILE="$ROOT_DIR/VERSION"
CHANGELOG_FILE="$ROOT_DIR/CHANGELOG.md"
PKG_FILE="$ROOT_DIR/frontend/package.json"
ENV_FILE="$ROOT_DIR/.env"

# ── validazione argomento ────────────────────────────────────────────────────
BUMP="${1:-}"
if [[ "$BUMP" != "patch" && "$BUMP" != "minor" && "$BUMP" != "major" ]]; then
  echo "Uso: $0 <patch|minor|major>"
  exit 1
fi

# ── versione corrente ─────────────────────────────────────────────────────────
CURRENT="$(cat "$VERSION_FILE" | tr -d '[:space:]')"
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

# ── calcolo nuova versione ────────────────────────────────────────────────────
case "$BUMP" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
TODAY="$(date +%Y-%m-%d)"

echo "🔖  $CURRENT  →  $NEW_VERSION"

# ── aggiorna VERSION ──────────────────────────────────────────────────────────
echo "$NEW_VERSION" > "$VERSION_FILE"
echo "✅  VERSION aggiornato"

# ── aggiorna package.json ─────────────────────────────────────────────────────
if [[ -f "$PKG_FILE" ]]; then
  sed -i "0,/\"version\": \"[^\"]*\"/s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" "$PKG_FILE"
  echo "✅  frontend/package.json aggiornato"
fi

# ── aggiorna APP_VERSION in .env (usata da docker-compose per il container backend)
if [[ -f "$ENV_FILE" ]]; then
  if grep -q "^APP_VERSION=" "$ENV_FILE"; then
    sed -i "s/^APP_VERSION=.*/APP_VERSION=$NEW_VERSION/" "$ENV_FILE"
  else
    echo "APP_VERSION=$NEW_VERSION" >> "$ENV_FILE"
  fi
  echo "✅  .env — APP_VERSION aggiornato"
else
  echo "⚠️   .env non trovato — aggiungi manualmente: APP_VERSION=$NEW_VERSION"
fi

# ── prepara CHANGELOG ─────────────────────────────────────────────────────────
PLACEHOLDER="## [$NEW_VERSION] — $TODAY
### Added
-

### Fixed
-

### Changed
-

---

"

# Inserisce il placeholder dopo l'intestazione fissa (prima riga con "## [")
if grep -q "^## \[" "$CHANGELOG_FILE"; then
  TMP_FILE="$(mktemp)"
  awk -v block="$PLACEHOLDER" '
    /^## \[/ && !done { printf "%s", block; done=1 }
    { print }
  ' "$CHANGELOG_FILE" > "$TMP_FILE"
  mv "$TMP_FILE" "$CHANGELOG_FILE"
else
  printf "\n%s" "$PLACEHOLDER" >> "$CHANGELOG_FILE"
fi
echo "✅  CHANGELOG.md — intestazione $NEW_VERSION inserita (da completare prima del commit)"

# ── riepilogo e prossimi passi ────────────────────────────────────────────────
echo ""
echo "──────────────────────────────────────────────"
echo "  Versione:  $CURRENT  →  $NEW_VERSION"
echo "──────────────────────────────────────────────"
echo ""
echo "Prossimi passi:"
echo "  1. Compila CHANGELOG.md con le novità di $NEW_VERSION"
echo "  2. git add VERSION frontend/package.json CHANGELOG.md .env"
echo "  3. git commit -m \"chore: release v$NEW_VERSION\""
echo "  4. git tag v$NEW_VERSION"
echo "  5. docker compose -f docker-compose.prod.yml build && docker compose -f docker-compose.prod.yml up -d"
