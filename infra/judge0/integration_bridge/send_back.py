import json
from pathlib import Path

BASE = Path(__file__).parent
OUTBOUND = BASE / "io" / "outbound"
OUTBOUND.mkdir(parents=True, exist_ok=True)

def write_job_result(job_name: str, result: dict) -> Path:
    """Write per-job graded JSON."""
    path = OUTBOUND / f"graded_{job_name}.json"
    with path.open("w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    return path

def write_summary(summary: dict) -> Path:
    """Write overall summary JSON."""
    path = OUTBOUND / "summary.json"
    with path.open("w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    return path
