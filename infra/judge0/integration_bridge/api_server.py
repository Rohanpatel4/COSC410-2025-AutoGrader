#!/usr/bin/env python3
"""
API Server for Judge0 Integration Bridge
Receives submission + test files from backend, processes via Judge0, returns results.
"""
from __future__ import annotations

import json
from pathlib import Path
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, request, jsonify
import os

from integration_bridge.split_tests import group_into_units
from integration_bridge.send_to_judge0 import run_in_judge0
from integration_bridge.grade_results import (
    unit_grade_from_j0,
    assemble_job_result,
)

app = Flask(__name__)

BASE = Path(__file__).resolve().parent
INBOUND = BASE / "io" / "inbound"
INBOUND.mkdir(parents=True, exist_ok=True)

MAX_WORKERS = int(os.getenv("IB_MAX_WORKERS", "4"))


@dataclass
class Job:
    name: str
    submission_path: Path
    tests_path: Path


def _strip_import_lines(src: str) -> str:
    """Remove import lines from source code."""
    out_lines = []
    for line in src.splitlines():
        s = line.strip()
        if s.startswith("import ") or s.startswith("from "):
            continue
        out_lines.append(line)
    return "\n".join(out_lines)


def _read_assert_line(harness_path: Path) -> str:
    """Extract the first non-comment, non-import line (usually an assert)."""
    for line in harness_path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if s and not s.startswith("#") and not s.startswith(("import ", "from ")):
            return s
    return "<no-assert-found>"


def _combine_submission_and_harness(submission_path: Path, harness_path: Path) -> str:
    """Combine student submission with test harness."""
    submission_src = submission_path.read_text(encoding="utf-8")
    harness_src = _strip_import_lines(harness_path.read_text(encoding="utf-8"))
    return submission_src + "\n\n# ---- HARNESS BELOW ----\n\n" + harness_src + "\n"


def _run_one_unit(submission_path: Path, harness_path: Path) -> dict:
    """Run a single test unit through Judge0."""
    combined = _combine_submission_and_harness(submission_path, harness_path)
    j0 = run_in_judge0(combined)
    unit_grade = unit_grade_from_j0(j0)
    unit_grade["harness"] = harness_path.name
    unit_grade["assert"] = _read_assert_line(harness_path)
    return unit_grade


def process_job(job: Job) -> dict:
    """Process a single job: split tests, run through Judge0, grade."""
    print(f"[BRIDGE] Processing job: {job.name}")
    
    units = group_into_units(job)  # Split tests into individual harness files
    unit_results: list[dict] = []

    if MAX_WORKERS <= 1:
        # Serial execution (easier to debug)
        for h in units:
            result = _run_one_unit(job.submission_path, h)
            unit_results.append(result)
            print(
                f"  └─ {result['harness']}: {result['status']} [{result['kind']}] "
                f"(passed={result['passed']})  {result['assert']}"
            )
    else:
        # Parallel execution
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
            futs = {ex.submit(_run_one_unit, job.submission_path, h): h for h in units}
            for fut in as_completed(futs):
                result = fut.result()
                unit_results.append(result)
                print(
                    f"  └─ {result['harness']}: {result['status']} [{result['kind']}] "
                    f"(passed={result['passed']})  {result['assert']}"
                )

    job_result = assemble_job_result(job.name, unit_results)
    print(f"[BRIDGE] Completed: {job_result['passed']}/{job_result['total_units']} passed ({job_result['score_pct']}%)")
    
    return job_result


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({"status": "healthy", "service": "judge0-integration-bridge"}), 200


@app.route('/grade', methods=['POST'])
def grade_submission():
    """
    Grade a submission against test cases.
    
    Expected JSON payload:
    {
        "submission_code": "def add(a, b): return a + b",
        "test_code": "from submission import add\nassert add(1, 2) == 3",
        "job_name": "assignment_1_student_123"  // optional, defaults to "job"
    }
    
    Returns:
    {
        "job": "assignment_1_student_123",
        "total_units": 5,
        "passed": 4,
        "failed": 1,
        "score_pct": 80.0,
        "by_kind": {"PASSED": 4, "FAILED_ASSERTION": 1},
        "units": [...]
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No JSON payload provided"}), 400
        
        submission_code = data.get("submission_code")
        test_code = data.get("test_code")
        job_name = data.get("job_name", "job")
        
        if not submission_code:
            return jsonify({"error": "submission_code is required"}), 400
        if not test_code:
            return jsonify({"error": "test_code is required"}), 400
        
        # Write files to inbound directory
        job_dir = INBOUND / job_name
        job_dir.mkdir(parents=True, exist_ok=True)
        
        submission_path = job_dir / "submission.py"
        tests_path = job_dir / "tests.py"
        
        submission_path.write_text(submission_code, encoding="utf-8")
        tests_path.write_text(test_code, encoding="utf-8")
        
        # Create job and process
        job = Job(
            name=job_name,
            submission_path=submission_path,
            tests_path=tests_path
        )
        
        result = process_job(job)
        
        return jsonify(result), 200
        
    except Exception as e:
        print(f"[BRIDGE ERROR] {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": str(e),
            "type": type(e).__name__
        }), 500


@app.route('/batch', methods=['POST'])
def batch_grade():
    """
    Grade multiple submissions in batch.
    
    Expected JSON payload:
    {
        "jobs": [
            {
                "submission_code": "...",
                "test_code": "...",
                "job_name": "student_1"
            },
            {
                "submission_code": "...",
                "test_code": "...",
                "job_name": "student_2"
            }
        ]
    }
    
    Returns:
    {
        "results": [...],
        "summary": {
            "total_jobs": 2,
            "total_units": 10,
            "passed": 8,
            "failed": 2,
            "score_pct": 80.0
        }
    }
    """
    try:
        data = request.get_json()
        jobs_data = data.get("jobs", [])
        
        if not jobs_data:
            return jsonify({"error": "No jobs provided"}), 400
        
        results = []
        for job_data in jobs_data:
            submission_code = job_data.get("submission_code")
            test_code = job_data.get("test_code")
            job_name = job_data.get("job_name", f"job_{len(results) + 1}")
            
            if not submission_code or not test_code:
                continue
            
            # Write files
            job_dir = INBOUND / job_name
            job_dir.mkdir(parents=True, exist_ok=True)
            
            submission_path = job_dir / "submission.py"
            tests_path = job_dir / "tests.py"
            
            submission_path.write_text(submission_code, encoding="utf-8")
            tests_path.write_text(test_code, encoding="utf-8")
            
            # Create and process job
            job = Job(
                name=job_name,
                submission_path=submission_path,
                tests_path=tests_path
            )
            
            result = process_job(job)
            results.append(result)
        
        # Calculate summary
        total_units = sum(r["total_units"] for r in results)
        passed = sum(r["passed"] for r in results)
        failed = sum(r["failed"] for r in results)
        score_pct = round(100 * passed / (passed + failed), 2) if (passed + failed) else 0.0
        
        summary = {
            "total_jobs": len(results),
            "total_units": total_units,
            "passed": passed,
            "failed": failed,
            "score_pct": score_pct,
        }
        
        return jsonify({
            "results": results,
            "summary": summary
        }), 200
        
    except Exception as e:
        print(f"[BRIDGE ERROR] {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": str(e),
            "type": type(e).__name__
        }), 500


if __name__ == "__main__":
    port = int(os.getenv("BRIDGE_PORT", "5000"))
    print(f"[BRIDGE] Starting Judge0 Integration Bridge on port {port}")
    print(f"[BRIDGE] Judge0 URL: {os.getenv('J0_URL', 'http://localhost:2358')}")
    print(f"[BRIDGE] Max workers: {MAX_WORKERS}")
    app.run(host="0.0.0.0", port=port, debug=True)

