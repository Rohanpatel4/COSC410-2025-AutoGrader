# Test Cases for Calculator Functions with Point Values
# Upload this file as the test case for the assignment
# Each test must use the @points(value) decorator to assign point values

@points(7)
def test_add_positive():
    assert add(5, 3) == 8

@points(5)
def test_add_negative():
    assert add(-2, -3) == -5

@points(3)
def test_add_zero():
    assert add(0, 0) == 0
    assert add(1, 1) == 2

@points(10)
def test_multiply_positive():
    assert multiply(4, 5) == 20

@points(5)
def test_multiply_by_zero():
    assert multiply(10, 0) == 0

@points(5)
def test_multiply_negative():
    assert multiply(-3, 4) == -12

@points(10)
def test_subtract():
    assert subtract(10, 3) == 7

@points(5)
def test_divide():
    assert divide(20, 4) == 5

# Total points: 50
