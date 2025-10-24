from square import square

def test_square_4():
    assert square(4) == 16

def test_square_5():
    assert square(5) == 25

def test_square_neg():
    assert square(-3) == 9