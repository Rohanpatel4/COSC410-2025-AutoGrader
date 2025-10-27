"""
Test Splitter

Splits a test file containing multiple assert statements into individual
test units, each with one assertion. This allows granular grading and
parallel execution.

Ported from infra/judge0/integration_bridge/split_tests.py
"""

from typing import List


def collect_import_lines(lines: List[str]) -> List[str]:
    """
    Extract import statements from the beginning of the test file.
    These will be prepended to each test unit.
    """
    imports: List[str] = []
    for line in lines:
        s = line.strip()
        # Skip empty lines
        if not s:
            continue
        # Collect import lines
        if s.startswith("import ") or s.startswith("from "):
            imports.append(line)
        else:
            # Assume imports are grouped at the top; break on first non-import
            break
    return imports


def collect_test_functions(lines: List[str]) -> List[tuple[str, List[str]]]:
    """
    Extract test functions from the test file.
    Returns list of (function_name, function_lines) tuples.
    """
    test_functions = []
    current_function = None
    current_lines = []
    
    for line in lines:
        s = line.strip()
        
        # Check if this is a test function definition
        if s.startswith("def test_"):
            # Save previous function if exists
            if current_function:
                test_functions.append((current_function, current_lines))
            # Start new function
            current_function = s.split("(")[0].replace("def ", "")
            current_lines = [line]
        elif current_function:
            # We're inside a test function
            if s and not s.startswith("#"):
                # Check if we're back at top level (no indentation on non-empty line)
                if line and line[0] not in (' ', '\t'):
                    # End of function, save it
                    test_functions.append((current_function, current_lines))
                    current_function = None
                    current_lines = []
                else:
                    # Still inside function
                    current_lines.append(line)
            elif not s:
                # Empty line, could be inside or after function
                if current_lines:
                    current_lines.append(line)
    
    # Save last function if exists
    if current_function:
        test_functions.append((current_function, current_lines))
    
    return test_functions


def collect_assert_lines(lines: List[str]) -> List[str]:
    """
    Extract top-level assert statements from the test file.
    Each assert becomes a separate test unit.
    """
    asserts: List[str] = []
    for line in lines:
        s = line.strip()
        # Skip empty lines and comments
        if not s or s.startswith("#"):
            continue
        # Collect single-line asserts (only top-level, not indented)
        if s.startswith("assert ") and line and line[0] not in (' ', '\t'):
            asserts.append(line)
    return asserts


def split_test_code(test_code: str) -> List[str]:
    """
    Split test code into multiple test units.
    Handles both pytest-style test functions and simple assert statements.
    
    Args:
        test_code: The complete test file content
        
    Returns:
        List of test unit strings. Each unit contains one test function call
        or one assert statement.
    """
    lines = test_code.splitlines()
    
    import_lines = collect_import_lines(lines)
    test_functions = collect_test_functions(lines)
    assert_lines = collect_assert_lines(lines)
    
    test_units: List[str] = []
    
    # First, create units for pytest-style test functions
    if test_functions:
        for func_name, func_lines in test_functions:
            unit_lines = [
                "# Auto-generated test unit (pytest-style function)",
            ]
            if import_lines:
                unit_lines.extend(import_lines)
            unit_lines.append("")  # blank line
            
            # Add the function definition
            unit_lines.extend(func_lines)
            
            # Add a call to the function
            unit_lines.append("")
            unit_lines.append(f"# Execute the test")
            unit_lines.append(f"{func_name}()")
            unit_lines.append("")
            
            test_units.append("\n".join(unit_lines))
    
    # Then, create units for top-level assert statements
    if assert_lines:
        for assert_line in assert_lines:
            unit_lines = [
                "# Auto-generated test unit (simple assertion)",
            ]
            if import_lines:
                unit_lines.extend(import_lines)
            unit_lines.append("")  # blank line
            unit_lines.append(assert_line)
            unit_lines.append("")  # trailing newline
            
            test_units.append("\n".join(unit_lines))
    
    # Fallback: if no tests found, return original test code
    if not test_units:
        return [test_code]
    
    return test_units


def extract_assert_text(test_unit: str) -> str:
    """
    Extract the test description from a test unit for display purposes.
    
    Args:
        test_unit: A single test unit string
        
    Returns:
        The test description (function name or assert statement)
    """
    lines = test_unit.splitlines()
    
    # Look for pytest-style function definition
    for line in lines:
        s = line.strip()
        if s.startswith("def test_"):
            # Extract function name
            func_name = s.split("(")[0].replace("def ", "")
            return func_name
    
    # Look for simple assert statement
    for line in lines:
        s = line.strip()
        if s.startswith("assert "):
            return s
    
    # Look for function call
    for line in lines:
        s = line.strip()
        if s and not s.startswith("#") and not s.startswith(("import ", "from ", "def ")):
            return s
    
    return "<no-test-found>"


def strip_import_lines(source: str) -> str:
    """
    Remove import statements from source code.
    Used when combining submission with test harness to avoid duplicate imports.
    
    Args:
        source: Source code string
        
    Returns:
        Source code without import statements
    """
    out_lines = []
    for line in source.splitlines():
        s = line.strip()
        if s.startswith("import ") or s.startswith("from "):
            continue
        out_lines.append(line)
    return "\n".join(out_lines)

