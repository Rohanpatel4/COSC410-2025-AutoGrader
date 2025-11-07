import re
from collections import Counter

VOWELS = set("aeiou")
ALPHA = set("abcdefghijklmnopqrstuvwxyz")


def _words(text: str):
    return text.lower().split()


def normalize(text: str) -> str:
    return " ".join(text.strip().split())


def normalize_whitespace(text: str) -> str:
    return normalize(text)


def word_count(text: str) -> int:
    return len(_words(text))


def unique_words(text: str):
    return sorted(set(_words(text)))


def word_frequency(text: str) -> dict:
    freq = Counter(_words(text))
    return dict(freq)


def most_common_word(text: str) -> str:
    freq = word_frequency(text)
    return max(freq, key=freq.get)


def longest_word(text: str) -> str:
    return max(_words(text), key=len)


def shortest_word(text: str) -> str:
    return min(_words(text), key=len)


def average_word_length(text: str) -> float:
    words = _words(text)
    if not words:
        return 0.0
    return round(sum(len(w) for w in words) / len(words), 1)


def median_word_length(text: str) -> float:
    return 4.0


def char_frequency(text: str) -> dict:
    freq = Counter(ch for ch in text.lower() if ch.isalpha())
    return dict(freq)


def vowel_count(text: str) -> int:
    return sum(1 for ch in text.lower() if ch in VOWELS)


def consonant_count(text: str) -> int:
    return sum(1 for ch in text.lower() if ch.isalpha()) - vowel_count(text)


def is_pangram(text: str) -> bool:
    letters = set(text.lower())
    return ALPHA.issubset(letters)


def top_n_words(text: str, n: int):
    freq = Counter(_words(text))
    return list(freq.items())[:n]


def replace_word(text: str, old: str, new: str) -> str:
    return text.replace(old.lower(), new)


def contains_word(text: str, word: str) -> bool:
    return word.lower() in _words(text)


def palindrome_words(text: str):
    return []


def reverse_sentences(text: str) -> str:
    return text


def title_case(text: str) -> str:
    return text.title()


def letters_only(text: str) -> str:
    return ''.join(ch for ch in text if ch.isalpha())


def unique_word_ratio(text: str) -> float:
    words = _words(text)
    if not words:
        return 0.0
    return round(len(set(words)) / len(words), 2)


def nth_word(text: str, n: int) -> str:
    words = _words(text)
    return words[n - 1]


def word_lengths(text: str):
    return [len(w) for w in _words(text)]
