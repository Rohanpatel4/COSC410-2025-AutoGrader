#!/usr/bin/env python3

# Simulate the combined code that gets sent to Judge0
import sys

# Student code (from the debug output)
student_code = '''#!/usr/bin/env python3
"""
Example of correct student submission for the math assignment.
Your submitted file should contain functions that can be imported as a module.
"""

def add(a, b):
    """Return the sum of two numbers."""
    return a + b

def subtract(a, b):
    """Return the difference of two numbers."""
    return a - b

def multiply(a, b):
    """Return the product of two numbers."""
    return a * b

def divide(a, b):
    """Return the quotient of two numbers."""
    if b == 0:
        raise ZeroDivisionError("Cannot divide by zero")
    return a / b
'''

# Test code (from assignment 11)
test_code = '''
import pytest

def test_add():
    """Test the add function with various inputs."""
    assert add(2, 3) == 5
    assert add(-1, 1) == 0
    assert add(0, 0) == 0
    assert add(2.5, 3.5) == 6.0
    assert add(-2, -3) == -5

def test_divide_by_zero():
    """Test that divide raises ZeroDivisionError when dividing by zero."""
    with pytest.raises(ZeroDivisionError, match="Cannot divide by zero"):
        divide(5, 0)

if __name__ == '__main__':
    test_add()
    test_divide_by_zero()
    print("All tests passed!")
'''

# Apply the same transformations as Judge0
modified_tests = test_code.replace('import pytest', '# pytest import removed - using assert statements')
modified_tests = modified_tests.replace('pytest.approx', 'approx')
modified_tests = modified_tests.replace('pytest.raises', 'raises_context')

# Create the combined code like Judge0 gets
combined_code = f"""import sys

# Student code
{student_code}

# Mock pytest.approx for floating point comparisons
def approx(value, rel=1e-7, abs=0):
    class Approx:
        def __init__(self, value, rel, abs):
            self.value = value
            self.rel = rel
            self.abs = abs

        def __eq__(self, other):
            if isinstance(other, (int, float)):
                # Simple floating point comparison
                diff = abs(self.value - other)
                return diff <= self.abs or diff <= self.rel * abs(self.value)
            return False

        def __repr__(self):
            return "approx(" + str(self.value) + ")"

    return Approx(value, rel, abs)

# Mock pytest.raises for context manager usage
class raises_context:
    def __init__(self, expected_exception, **kwargs):
        self.expected_exception = expected_exception
        self.match = kwargs.get('match')

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            # No exception was raised, but we expected one
            print("FAILED: Expected " + self.expected_exception.__name__ + " but no exception was raised")
            return False  # Re-raise
        elif issubclass(exc_type, self.expected_exception):
            # Correct exception was raised
            if self.match and str(exc_val) != self.match:
                print("FAILED: Expected exception message '" + str(self.match) + "' but got '" + str(exc_val) + "'")
                return False  # Re-raise
            return True  # Suppress the exception
        else:
            # Wrong exception was raised
            print("FAILED: Expected " + self.expected_exception.__name__ + " but got " + exc_type.__name__)
            return False  # Re-raise

# Test code (modified to work without pytest)
{modified_tests}
"""

print("Combined code to execute:")
print("=" * 50)
print(combined_code)
print("=" * 50)

print("\nExecuting combined code...")
try:
    exec(combined_code)
except Exception as e:
    print(f"Error during execution: {e}")
    import traceback
    traceback.print_exc()
