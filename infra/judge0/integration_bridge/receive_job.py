# integration_bridge/receive_job.py
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import List

# Resolve paths relative to this file, not the current working directory
BASE = Path(__file__).resolve().parent
EXAMPLES = BASE / "examples"

@dataclass
class Job:
    name: str
    submission_path: Path
    tests_path: Path

def _must_exist(p: Path) -> Path:
    """Raise a clear error if a required file is missing."""
    if not p.is_file():
        raise FileNotFoundError(
            f"[receive_job] Expected file not found: {p}\n"
            f"Tip: ensure these files exist under {EXAMPLES}:\n"
            f"  - submission_add_subtract.py\n"
            f"  - tests_add_subtract.py\n"
            f"  - submission_multiply_divide.py\n"
            f"  - tests_multiply_divide.py\n"
        )
    return p

def list_demo_jobs() -> List[Job]:
    """
    Returns two demo jobs (pairs of submission + tests), with strict path checks.
    This is only for the local/demo flow; replace later with real inbound reading.
    """
    add_subm  = _must_exist(EXAMPLES / "submission_add_subtract.py")
    add_tests = _must_exist(EXAMPLES / "tests_add_subtract.py")

    md_subm   = _must_exist(EXAMPLES / "submission_multiply_divide.py")
    md_tests  = _must_exist(EXAMPLES / "tests_multiply_divide.py")

    return [
        Job(
            name="add_subtract",
            submission_path=add_subm,
            tests_path=add_tests,
        ),
        Job(
            name="multiply_divide",
            submission_path=md_subm,
            tests_path=md_tests,
        ),
    ]
