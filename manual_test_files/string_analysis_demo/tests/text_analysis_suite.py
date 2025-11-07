import math
import re

TEXT = (
    "The quick brown fox jumps over the lazy dog. The quick blue hare waits in silence. "
    "Does it really? Yes, it does! A level radar sees stats within civic limits."
)

SIMPLE = "   Extra   spaces   and MIXED case   words   "

LOREM = "Orbiting nodes relay signals while engineers optimize algorithms and refactor modules."


@points(4)
def test_normalize_basic():
    assert normalize(SIMPLE) == "extra spaces and mixed case words"


@points(4)
def test_normalize_whitespace_collapses_multiple_spaces():
    messy = "Alpha\n\nBeta\tGamma"
    assert normalize_whitespace(messy) == "alpha beta gamma"


@points(4)
def test_most_common_word_prefers_frequency_then_alpha():
    assert most_common_word(TEXT) == "the"


@points(3)
def test_shortest_word_prefers_first_when_equal():
    assert shortest_word(TEXT) == "a"


@points(3)
def test_median_word_length_handles_even_counts():
    assert math.isclose(median_word_length(TEXT), 4.0)


@points(4)
def test_is_pangram_true_with_noise():
    assert is_pangram(TEXT) is True


@points(4)
def test_word_frequency_specific_entries():
    freq = word_frequency(TEXT)
    assert freq["quick"] == 2
    assert freq["does"] == 2
    assert freq["level"] == 1


@points(3)
def test_replace_word_case_insensitive_and_preserves_spacing():
    replaced = replace_word(TEXT, "quick", "swift")
    assert replaced.count("swift") == 2
    assert "quick" not in replaced.lower()


@points(3)
def test_contains_word_ignores_case():
    assert contains_word(TEXT, "Radar") is True
    assert contains_word(TEXT, "python") is False


@points(4)
def test_reverse_sentences_inverts_order_cleanly():
    reversed_text = reverse_sentences(TEXT)
    sentences = [s.strip() for s in reversed_text.split(".") if s.strip()]
    assert sentences[0].startswith("A level radar")
    assert sentences[-1].startswith("The quick brown")


@points(2)
def test_title_case_capitalizes_words():
    assert title_case("hello world from demo") == "Hello World From Demo"


@points(3)
def test_letters_only_strips_non_alpha():
    assert letters_only("abc-XYZ 123!") == "abcxyz"


@points(3)
def test_word_lengths_matches_order():
    lengths = word_lengths("alpha beta gamma")
    assert lengths == [5, 4, 5]


@points(3)
def test_word_frequency_handles_apostrophes():
    text = "It's it's its"
    freq = word_frequency(text)
    assert freq["it's"] == 2
    assert freq["its"] == 1
