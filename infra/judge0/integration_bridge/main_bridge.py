# integration_bridge/main_bridge.py
from __future__ import annotations

from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import os

from integration_bridge.receive_job import list_demo_jobs
from integration_bridge.split_tests import group_into_units
from integration_bridge.send_to_judge0 import run_in_judge0
from integration_bridge.grade_results import (
    unit_grade_from_j0,
    assemble_job_result,
    summarize_jobs,
)
from integration_bridge.send_back import write_job_result, write_summary

BASE = Path(__file__).resolve().parent

# Tuneable: set to "1" to run strictly serial (easiest to debug).
MAX_WORKERS = int(os.getenv("IB_MAX_WORKERS", "4"))

def _read_text(p: Path) -> str:
    return p.read_text(encoding="utf-8")

def _strip_import_lines(src: str) -> str:
    out_lines = []
    for line in src.splitlines():
        s = line.strip()
        if s.startswith("import ") or s.startswith("from "):
            continue
        out_lines.append(line)
    return "\n".join(out_lines)

def _read_assert_line(harness_path: Path) -> str:
    for line in harness_path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if s and not s.startswith("#") and not s.startswith(("import ", "from ")):
            return s
    return "<no-assert-found>"

def _combine_submission_and_harness(submission_path: Path, harness_path: Path) -> str:
    submission_src = _read_text(submission_path)
    harness_src = _strip_import_lines(_read_text(harness_path))
    return submission_src + "\n\n# ---- HARNESS BELOW ----\n\n" + harness_src + "\n"

def _run_one_unit(submission_path: Path, harness_path: Path) -> dict:
    combined = _combine_submission_and_harness(submission_path, harness_path)
    j0 = run_in_judge0(combined)
    unit_grade = unit_grade_from_j0(j0)
    unit_grade["harness"] = harness_path.name
    unit_grade["assert"]  = _read_assert_line(harness_path)
    return unit_grade

def run_bridge() -> None:
    jobs = list_demo_jobs()
    all_job_results = []

    for job in jobs:
        print(f"[JOB] {job.name}")
        units = group_into_units(job)  # list[Path] of harness files

        unit_results: list[dict] = []

        if MAX_WORKERS <= 1:
            # Serial (simplest, good for debugging)
            for idx, h in enumerate(units, start=1):
                result = _run_one_unit(job.submission_path, h)
                unit_results.append(result)
                print(
                    f"  └─ {result['harness']}: {result['status']} [{result['kind']}] "
                    f"(passed={result['passed']})  {result['assert']}"
                )
        else:
            # Light parallel (faster, still simple)
            with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
                futs = {ex.submit(_run_one_unit, job.submission_path, h): h for h in units}
                for fut in as_completed(futs):
                    result = fut.result()
                    unit_results.append(result)
                    print(
                        f"  └─ {result['harness']}: {result['status']} [{result['kind']}] "
                        f"(passed={result['passed']})  {result['assert']}"
                    )

        # >>> This is the critical bit you were missing: pass the collected list
        job_result = assemble_job_result(job.name, unit_results)
        out_path = write_job_result(job.name, job_result)
        print(f"[WROTE] {out_path}  ->  {job_result['passed']}/{job_result['total_units']} passed ({job_result['score_pct']}%)")

        all_job_results.append(job_result)

    summary = summarize_jobs(all_job_results)
    sum_path = write_summary(summary)
    total_units = summary["passed"] + summary["failed"]
    print(f"[SUMMARY] {sum_path}  ->  {summary['passed']}/{total_units} unit asserts passed ({summary['score_pct']}%)")

if __name__ == "__main__":
    run_bridge()
