"""Restore into a new disposable database and compare every table's contents."""
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
bundle = (ROOT / sys.argv[1]).resolve()
if not bundle.is_relative_to(ROOT / "backups"):
    raise SystemExit("Expected private package inside backups/")
compose = ["node", "scripts/docker.mjs", "compose"]
database = "hfs_transfer_verify_" + datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")


def run(args, **kwargs):
    return subprocess.run(compose + args, cwd=ROOT, check=True, **kwargs)


# createdb fails on any collision. Never use --clean against an existing database.
run(["exec", "-T", "db", "sh", "-c", 'createdb -U "$POSTGRES_USER" "$1"', "sh", database])
with (bundle / "database.dump").open("rb") as source:
    run(["exec", "-T", "db", "sh", "-c",
         'pg_restore -U "$POSTGRES_USER" --dbname "$1" --no-owner --no-acl --exit-on-error', "sh", database], stdin=source)
expected = "/app/" + (bundle / "database-fingerprint.json").relative_to(ROOT).as_posix()
run(["run", "--rm", "--no-deps", "-e", "HFS_DATABASE=" + database, "-e", "HFS_EXPECT_FINGERPRINT=" + expected,
     "web", "bin/rails", "runner", "scripts/database-fingerprint.rb"])
# Only the uniquely named database created above is removed, after successful comparison.
run(["exec", "-T", "db", "sh", "-c", 'dropdb -U "$POSTGRES_USER" "$1"', "sh", database])
report = {"status": "PASS", "restore": "new disposable PostgreSQL 16 database", "all_rows_identical": True,
          "source_database_untouched": True, "physical_mac": "NOT_RUN"}
(ROOT / "qa/amelia3-v5/handoff-restore.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report))
