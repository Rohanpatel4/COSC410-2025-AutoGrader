"""Basic calculator test suite with point values."""



@points(10)
def test_add_positive():
    """Test addition with positive numbers."""
    assert add(5, 3) == 8
    assert add(10, 20) == 30


@points(10)
def test_add_negative():
    """Test addition with negative numbers."""
    assert add(-5, -3) == -8
    assert add(-10, 5) == -5


@points(10)
def test_subtract_positive():
    """Test subtraction with positive numbers."""
    assert subtract(10, 3) == 7
    assert subtract(20, 5) == 15


@points(10)
def test_subtract_negative():
    """Test subtraction with negative numbers."""
    assert subtract(-5, -3) == -2
    assert subtract(5, -3) == 8


@points(10)
def test_multiply_positive():
    """Test multiplication with positive numbers."""
    assert multiply(5, 3) == 15
    assert multiply(10, 2) == 20


@points(10)
def test_multiply_negative():
    """Test multiplication with negative numbers."""
    assert multiply(-5, 3) == -15
    assert multiply(-5, -3) == 15


@points(10)
def test_divide_positive():
    """Test division with positive numbers."""
    assert divide(10, 2) == 5.0
    assert divide(15, 3) == 5.0


@points(10)
def test_divide_negative():
    """Test division with negative numbers."""
    assert divide(-10, 2) == -5.0
    assert divide(10, -2) == -5.0


@points(10)
def test_power():
    """Test exponentiation."""
    assert power(2, 3) == 8
    assert power(5, 2) == 25


@points(10)
def test_modulo():
    """Test modulo operation."""
    assert modulo(10, 3) == 1
    assert modulo(15, 4) == 3

