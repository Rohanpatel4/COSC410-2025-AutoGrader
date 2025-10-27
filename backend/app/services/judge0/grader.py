"""
Grader

Grades Judge0 execution results and aggregates them into final scores.

Ported from infra/judge0/integration_bridge/grade_results.py
"""

from typing import Dict, Any, List


PASS_STATUS_ID = 3  # "Accepted" in Judge0


def grade_unit(j0_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Grade a single test unit based on Judge0 result.
    
    Args:
        j0_result: Judge0 execution result for one test unit
        
    Returns:
        Dict containing:
        - status_id: Judge0 status ID
        - status: Status description
        - kind: Failure category (PASSED, FAILED_ASSERTION, TIMEOUT, etc.)
        - passed: 1 if passed, 0 if failed
        - failed: 0 if passed, 1 if failed
        - stdout, stderr, time, memory: Execution details
    """
    status = j0_result.get("status", {}) or {}
    status_id = status.get("id")
    status_desc = status.get("description", "")
    stderr = (j0_result.get("stderr") or "")
    stdout = (j0_result.get("stdout") or "")
    
    if status_id == PASS_STATUS_ID:
        kind = "PASSED"
        passed, failed = 1, 0
    else:
        # Categorize failure type
        if "AssertionError" in stderr:
            kind = "FAILED_ASSERTION"  # logical test failure
        elif "Time Limit" in status_desc:
            kind = "TIMEOUT"
        elif "Memory Limit" in status_desc:
            kind = "MEMORY_ERROR"
        elif "Compilation" in status_desc:
            kind = "COMPILE_ERROR"
        else:
            kind = "RUNTIME_ERROR"  # any other non-zero exit
        passed, failed = 0, 1
    
    return {
        "status_id": status_id,
        "status": status_desc,
        "kind": kind,
        "passed": passed,
        "failed": failed,
        "stdout": stdout,
        "stderr": stderr,
        "time": j0_result.get("time"),
        "memory": j0_result.get("memory"),
    }


def assemble_grading_result(unit_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Aggregate multiple unit grading results into a final score.
    
    Args:
        unit_results: List of unit grading dicts from grade_unit()
        
    Returns:
        Dict containing:
        - total_tests: Total number of test units
        - passed_tests: Number of passed units
        - failed_tests: Number of failed units
        - score_pct: Percentage score (0-100)
        - by_kind: Breakdown of failure types
        - units: Full list of unit results
        - all_passed: True if all tests passed
    """
    total = len(unit_results)
    passed = sum(u["passed"] for u in unit_results)
    failed = sum(u["failed"] for u in unit_results)
    score_pct = round(100 * passed / total, 2) if total else 0.0
    
    # Breakdown by failure category
    by_kind = {}
    for u in unit_results:
        by_kind[u["kind"]] = by_kind.get(u["kind"], 0) + 1
    
    return {
        "total_tests": total,
        "passed_tests": passed,
        "failed_tests": failed,
        "score_pct": score_pct,
        "by_kind": by_kind,
        "units": unit_results,
        "all_passed": failed == 0 and total > 0,
    }


def calculate_grade(score_pct: float, max_grade: int = 100) -> int:
    """
    Convert percentage score to grade value.
    
    Args:
        score_pct: Percentage score (0-100)
        max_grade: Maximum grade value (default: 100)
        
    Returns:
        Grade as integer
    """
    return int(round(score_pct * max_grade / 100))

