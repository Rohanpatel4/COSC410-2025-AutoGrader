# Student Submission: PASSES SOME TESTS
# This implementation has some correct and some incorrect functions

def add(a, b):
    """Add two numbers - CORRECT"""
    return a + b

def multiply(a, b):
    """Multiply two numbers - WRONG (using addition instead)"""
    return a + b  # Bug: should be a * b

def subtract(a, b):
    """Subtract b from a - CORRECT"""
    return a - b

def divide(a, b):
    """Divide a by b - WRONG (using subtraction instead)"""
    return a - b  # Bug: should be a / b

