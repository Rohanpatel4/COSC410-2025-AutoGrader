"""
Judge0 Integration Service

This package provides a simplified Judge0 integration that:
1. Splits test files into individual assertion units
2. Submits each unit to Judge0 for execution
3. Grades the results and aggregates them

Works with local Judge0 at http://localhost:2358
Compatible with Windows and Mac.
"""

from .executor import grade_submission

__all__ = ["grade_submission"]

