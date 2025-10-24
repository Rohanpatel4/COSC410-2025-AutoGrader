"""
split_tests.py — assertion-level splitter (CUSTOM — NOT FROM JUDGE0)

For this demo, we convert a single test file that contains multiple `assert ...`
statements into many tiny "harness" files, each containing:
  - the original import lines (e.g., `from submission_x import add`)
  - exactly ONE assert line

Each harness is written under: io/tmp/<job.name>/h_XX.py
and we return a list[Path] pointing to those harnesses.

Assumptions (fits your current examples):
  - Tests are simple one-line `assert ...` statements.
  - Any `import`/`from` lines at the top are safe to reuse.
  - No multi-line asserts or complex try/except blocks in this demo splitter.

If no asserts are found, we gracefully fall back to returning the original test path.
"""

from __future__ import annotations
from pathlib import Path
from typing import List

BASE = Path(__file__).parent
TMP_ROOT = BASE / "io" / "tmp"


def _read_lines(path: Path) -> list[str]:
    return path.read_text(encoding="utf-8").splitlines()


def _collect_import_lines(lines: list[str]) -> list[str]:
    """Keep simple import lines to recreate the test context in each harness."""
    imports: list[str] = []
    for line in lines:
        s = line.strip()
        # stop collecting imports once we hit the first non-empty, non-import line
        if not s:
            continue
        if s.startswith("import ") or s.startswith("from "):
            imports.append(line)
        else:
            # assume imports are grouped at the top; break on first non-import
            break
    return imports


def _collect_assert_lines(lines: list[str]) -> list[str]:
    """Collect one-line asserts. Ignores comments and blank lines."""
    asserts: list[str] = []
    for line in lines:
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        # simple single-line assert
        if s.startswith("assert "):
            asserts.append(line)
    return asserts


def group_into_units(job) -> List[Path]:
    """
    Split the job.tests_path into one harness per assert.
    Write harness files under io/tmp/<job.name>/ and return their Paths.

    If no asserts are found, return [job.tests_path].
    """
    tests_path: Path = job.tests_path
    lines = _read_lines(tests_path)

    import_lines = _collect_import_lines(lines)
    assert_lines = _collect_assert_lines(lines)

    # Fallback: run the whole test file if we didn't find any asserts
    if not assert_lines:
        return [tests_path]

    # Prepare temp dir for this job's harnesses
    out_dir = TMP_ROOT / job.name
    out_dir.mkdir(parents=True, exist_ok=True)

    harness_paths: list[Path] = []
    for idx, al in enumerate(assert_lines, start=1):
        harness_src = [
            "# Auto-generated harness — CUSTOM (NOT FROM JUDGE0)",
            "# One-assert unit derived from original test file.",
        ]
        if import_lines:
            harness_src.extend(import_lines)
        harness_src.append("")  # spacer
        harness_src.append(al)
        harness_src.append("")  # trailing newline

        h_path = out_dir / f"h_{idx:02d}.py"
        h_path.write_text("\n".join(harness_src), encoding="utf-8")
        harness_paths.append(h_path)

    return harness_paths
