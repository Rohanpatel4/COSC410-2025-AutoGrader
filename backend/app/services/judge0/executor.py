"""
Judge0 Executor

Main orchestrator for grading submissions using Judge0.
Coordinates test splitting, execution, and grading.

This is the primary entry point for the Judge0 service.
"""

import asyncio
from typing import Dict, Any
import os

from .client import submit_to_judge0, PYTHON_LANG_ID
from .test_splitter import split_test_code, extract_assert_text, strip_import_lines
from .grader import grade_unit, assemble_grading_result


async def grade_submission(
    submission_code: str,
    test_code: str,
    judge0_url: str = None,
    max_workers: int = 4,
) -> Dict[str, Any]:
    """
    Grade a student submission against test code using Judge0.
    
    This function:
    1. Splits the test code into individual assertion units
    2. Combines each unit with the submission code
    3. Submits each combined code to Judge0 for execution
    4. Grades all results and aggregates them
    
    Args:
        submission_code: Student's code to test
        test_code: Test code containing assertions
        judge0_url: Judge0 API base URL (default: from env or localhost:2358)
        max_workers: Maximum parallel Judge0 submissions (default: 4)
        
    Returns:
        Dict containing:
        - grading: {total_tests, passed_tests, failed_tests, score_pct, all_passed}
        - units: List of individual unit results with details
        - by_kind: Breakdown of failure types
        - status: Overall status
    """
    # Get Judge0 URL from env or use default
    if judge0_url is None:
        judge0_url = os.getenv("JUDGE0_URL", "http://localhost:2358")
    
    # Split test code into individual units
    test_units = split_test_code(test_code)
    
    # Prepare combined code for each test unit
    combined_codes = []
    for test_unit in test_units:
        # Strip imports from test unit to avoid duplicates
        test_unit_clean = strip_import_lines(test_unit)
        # Combine submission with test unit
        combined = (
            submission_code
            + "\n\n# ---- TEST HARNESS ----\n\n"
            + test_unit_clean
            + "\n"
        )
        combined_codes.append((combined, test_unit))
    
    # Execute all units (parallel with semaphore to limit concurrency)
    semaphore = asyncio.Semaphore(max_workers)
    
    async def run_one_unit(combined_code: str, test_unit: str) -> Dict[str, Any]:
        """Execute one test unit through Judge0"""
        async with semaphore:
            try:
                j0_result = await submit_to_judge0(
                    source_code=combined_code,
                    language_id=PYTHON_LANG_ID,
                    judge0_url=judge0_url,
                )
                
                # Grade this unit
                unit_grade = grade_unit(j0_result)
                unit_grade["assert"] = extract_assert_text(test_unit)
                
                return unit_grade
                
            except Exception as e:
                # If Judge0 submission fails, mark as error
                return {
                    "status_id": -1,
                    "status": f"Submission error: {str(e)}",
                    "kind": "SUBMISSION_ERROR",
                    "passed": 0,
                    "failed": 1,
                    "stdout": "",
                    "stderr": str(e),
                    "time": None,
                    "memory": None,
                    "assert": extract_assert_text(test_unit),
                }
    
    # Run all units in parallel (with controlled concurrency)
    tasks = [
        run_one_unit(combined, test_unit)
        for combined, test_unit in combined_codes
    ]
    unit_results = await asyncio.gather(*tasks)
    
    # Assemble final grading result
    grading = assemble_grading_result(unit_results)
    
    return {
        "status": "ok" if grading["all_passed"] else "failed",
        "grading": {
            "total_tests": grading["total_tests"],
            "passed_tests": grading["passed_tests"],
            "failed_tests": grading["failed_tests"],
            "score_pct": grading["score_pct"],
            "all_passed": grading["all_passed"],
        },
        "by_kind": grading["by_kind"],
        "units": grading["units"],
    }


async def simple_judge0_run(
    submission_code: str,
    test_code: str,
    judge0_url: str = None,
) -> Dict[str, Any]:
    """
    Simple Judge0 execution without test splitting.
    Runs all tests together in one Judge0 submission.
    
    This is a fallback/simpler approach for when test splitting is not needed.
    
    Args:
        submission_code: Student's code to test
        test_code: Test code (may contain multiple asserts)
        judge0_url: Judge0 API base URL
        
    Returns:
        Dict containing Judge0 result and basic grading info
    """
    if judge0_url is None:
        judge0_url = os.getenv("JUDGE0_URL", "http://localhost:2358")
    
    # Combine submission and test code
    combined = submission_code + "\n\n# ---- TESTS ----\n\n" + test_code + "\n"
    
    # Submit to Judge0
    j0_result = await submit_to_judge0(
        source_code=combined,
        language_id=PYTHON_LANG_ID,
        judge0_url=judge0_url,
    )
    
    # Simple grading: passed if status is 3 (Accepted)
    status = j0_result.get("status", {})
    passed = status.get("id") == 3
    
    return {
        "status": "ok" if passed else "failed",
        "grading": {
            "all_passed": passed,
            "total_tests": 1,
            "passed_tests": 1 if passed else 0,
            "failed_tests": 0 if passed else 1,
            "score_pct": 100.0 if passed else 0.0,
        },
        "result": j0_result,
    }

