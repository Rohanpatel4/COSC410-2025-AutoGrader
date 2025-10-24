def multiply(a, b):
    """Return the product of two numbers."""
    # BUG: student accidentally adds instead of multiplies
    return a + b

def divide(a, b):
    """Return the quotient of two numbers."""
    if b == 0:
        raise ZeroDivisionError("Cannot divide by zero")
    return a / b
