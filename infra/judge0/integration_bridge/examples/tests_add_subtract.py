from submission_add_subtract import add, subtract

# Add tests
assert add(2, 3) == 5
assert add(-1, 1) == 0
assert add(2.5, 3.5) == 6.0

# Subtract tests
assert subtract(5, 3) == 2
assert subtract(-1, 1) == -2
assert subtract(5.5, 2.5) == 3.0
