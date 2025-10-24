from submission_multiply_divide import multiply, divide

# Multiply tests (will fail)
assert multiply(2, 3) == 6
assert multiply(-2, 3) == -6
assert multiply(2.5, 2) == 5.0
assert multiply(2, 2) == 4

# Divide tests (should pass)
assert divide(6, 2) == 3
assert divide(-6, 2) == -3
assert divide(5, 2) == 2.5
assert divide(0, 5) == 0
