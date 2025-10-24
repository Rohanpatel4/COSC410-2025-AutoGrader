from typing import Dict, Any, List

PASS_STATUS_ID = 3  # "Accepted" in Judge0

def unit_grade_from_j0(j0_result: Dict[str, Any]) -> Dict[str, Any]:
    status = j0_result.get("status", {}) or {}
    status_id = status.get("id")
    status_desc = status.get("description", "")
    stderr = (j0_result.get("stderr") or "")
    stdout = (j0_result.get("stdout") or "")

    if status_id == PASS_STATUS_ID:
        kind = "PASSED"
        passed, failed = 1, 0
    else:
        if "AssertionError" in stderr:
            kind = "FAILED_ASSERTION"      # logical test failure
        elif "Time Limit" in status_desc:
            kind = "TIMEOUT"
        elif "Memory Limit" in status_desc:
            kind = "MEMORY_ERROR"
        elif "Compilation" in status_desc:
            kind = "COMPILE_ERROR"
        else:
            kind = "RUNTIME_ERROR"         # any other non-zero exit
        passed, failed = 0, 1

    return {
        "status_id": status_id,
        "status": status_desc,
        "kind": kind,               # <-- new, tells you *why*
        "passed": passed,
        "failed": failed,
        "stdout": stdout,
        "stderr": stderr,
        "time": j0_result.get("time"),
        "memory": j0_result.get("memory"),
    }


def assemble_job_result(job_name: str, unit_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    total = len(unit_results)
    passed = sum(u["passed"] for u in unit_results)
    failed = sum(u["failed"] for u in unit_results)
    score_pct = round(100 * passed / total, 2) if total else 0.0
    # nice breakdown by kind
    by_kind = {}
    for u in unit_results:
        by_kind[u["kind"]] = by_kind.get(u["kind"], 0) + 1
    return {
        "job": job_name,
        "total_units": total,
        "passed": passed,
        "failed": failed,
        "score_pct": score_pct,
        "by_kind": by_kind,         # <-- counts per failure type
        "units": unit_results,
    }

def summarize_jobs(job_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Top-level summary across all jobs."""
    total_jobs = len(job_results)
    total_units = sum(j["total_units"] for j in job_results)
    passed = sum(j["passed"] for j in job_results)
    failed = sum(j["failed"] for j in job_results)
    score_pct = round(100 * passed / (passed + failed), 2) if (passed + failed) else 0.0
    return {
        "total_jobs": total_jobs,
        "total_units": total_units,
        "passed": passed,
        "failed": failed,
        "score_pct": score_pct,
    }
