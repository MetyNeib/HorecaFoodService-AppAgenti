"""Run the approved 86-check validator, writing results under qa/, never src/data/."""
from pathlib import Path
import importlib.util
import json
import sys
root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("hfs_original_validator", root / "scripts/validate_demo_original.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
report = module.validate(root / "src/data/hfs_demo_data.json")
(root / "qa").mkdir(exist_ok=True)
(root / "qa/seed_validation_current.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
print(json.dumps({k:report[k] for k in ("status","passed","failed")},ensure_ascii=False))
sys.exit(0 if report["failed"] == 0 else 1)
