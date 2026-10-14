#!/usr/bin/env bash
# Restore the private transfer package into a NEW local Docker database only.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
bundle="${1:?Usage: bash scripts/restore-mac.sh /absolute/path/to/extracted-private-package}"
bundle="$(cd "$bundle" && pwd)"
[[ -f "$bundle/database.dump" && -f "$bundle/SHA256SUMS" && -f "$bundle/.env" ]] || { echo 'Incomplete transfer package'; exit 1; }
[[ ! -e .env && ! -e imports/private/amelia3/local_accounts.json ]] || { echo 'Existing local configuration detected. Nothing overwritten. Use a fresh clone.'; exit 1; }
docker info >/dev/null
(cd "$bundle" && shasum -a 256 -c SHA256SUMS >/dev/null)
cp "$bundle/.env" .env
docker compose up -d db redis
ready=false
for attempt in {1..60}; do
  if docker compose exec -T db sh -c 'pg_isready -U "$POSTGRES_USER"' >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]] || { echo 'PostgreSQL did not become ready'; exit 1; }
exists="$(docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d postgres -Atc "SELECT count(*) FROM pg_database WHERE datname = '\''hfs_agents_development'\''"')"
[[ "$exists" == 0 ]] || { echo 'Database already exists. Nothing restored or deleted. Use a fresh Docker project.'; exit 1; }
mkdir -p imports/private
cp -R "$bundle/imports/private/." imports/private/
if [[ -d "$bundle/storage" ]]; then mkdir -p storage; cp -R "$bundle/storage/." storage/; fi
if [[ -f "$bundle/config/master.key" ]]; then cp "$bundle/config/master.key" config/master.key; fi
# Recreate infrastructure with the restored environment before initializing the database.
docker compose up -d db redis
docker compose exec -T db sh -c 'createdb -U "$POSTGRES_USER" hfs_agents_development'
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" --dbname hfs_agents_development --no-owner --no-acl --exit-on-error' < "$bundle/database.dump"
docker compose build web
mkdir -p backups/mac-restore
cp "$bundle/database-fingerprint.json" backups/mac-restore/database-fingerprint.json
# No migrations, seeds or background jobs run before the integrity comparison.
docker compose run --rm --no-deps -e HFS_EXPECT_FINGERPRINT=/app/backups/mac-restore/database-fingerprint.json web bin/rails runner scripts/database-fingerprint.rb
docker compose up -d web
for attempt in {1..60}; do
  if curl --fail --silent http://127.0.0.1:3002/up >/dev/null; then
    echo 'Restore verified. Open http://127.0.0.1:3002/amelia3'
    echo 'FTP credentials/settings preserved; worker intentionally not started during restore.'
    echo 'To enable scheduled updates: docker compose up -d worker'
    exit 0
  fi
  sleep 2
done
echo 'Database restored and verified, but web readiness timed out. Inspect: docker compose logs --tail=60 web'
exit 1
