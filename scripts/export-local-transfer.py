"""Create a private, consistent local handoff; never uploads files or prints secrets."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
destination = (ROOT / sys.argv[1]).resolve()
if not destination.is_relative_to(ROOT / "backups") or destination.exists():
    raise SystemExit("Use a new destination inside backups/")
destination.mkdir(parents=True)
compose = ["node", "scripts/docker.mjs", "compose"]


def run(args, **kwargs):
    return subprocess.run(compose + args, cwd=ROOT, check=True, **kwargs)


running = run(["ps", "--status", "running", "--services"], capture_output=True, text=True).stdout.splitlines()
paused = [service for service in ("web", "worker") if service in running]
try:
    if paused:
        run(["stop", *paused])
    fingerprint = "/app/" + (destination / "database-fingerprint.json").relative_to(ROOT).as_posix()
    run(["run", "--rm", "--no-deps", "-e", "HFS_FINGERPRINT_FILE=" + fingerprint,
         "web", "bin/rails", "runner", "scripts/database-fingerprint.rb"])
    with (destination / "database.dump").open("wb") as output:
        run(["exec", "-T", "db", "sh", "-c",
             'exec pg_dump -U "$POSTGRES_USER" --format=custom --no-owner --no-acl hfs_agents_development'], stdout=output)
    shutil.copy2(ROOT / ".env", destination / ".env")
    shutil.copytree(ROOT / "imports/private", destination / "imports/private")
    for folder in ("storage",):
        if (ROOT / folder).exists():
            shutil.copytree(ROOT / folder, destination / folder)
    key = ROOT / "config/master.key"
    if key.exists():
        (destination / "config").mkdir()
        shutil.copy2(key, destination / "config/master.key")
finally:
    if paused:
        run(["start", *paused])

files = sorted(path for path in destination.rglob("*") if path.is_file())
with (destination / "SHA256SUMS").open("w", encoding="utf-8", newline="\n") as output:
    for path in files:
        with path.open("rb") as source:
            digest = hashlib.file_digest(source, "sha256").hexdigest()
        output.write(digest + "  " + path.relative_to(destination).as_posix() + "\n")
print(json.dumps({"status": "EXPORTED", "files": len(files), "database_bytes": (destination / "database.dump").stat().st_size,
                  "private_directory": destination.relative_to(ROOT).as_posix(), "browser_pending_commands": "not included; sync before switching devices"}))
