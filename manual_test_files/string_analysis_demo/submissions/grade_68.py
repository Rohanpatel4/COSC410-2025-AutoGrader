import re
from collections import Counter
from statistics import median

VOWELS = set("aeiou")
ALPHA = set("abcdefghijklmnopqrstuvwxyz")


def _words(text: str):
    return [w for w in re.findall(r"[a-z']+", text.lower()) if w]


def normalize(text: str) -> str:
    # Bug: forget to lowercase
    return re.sub(r"\s+", " ", text.strip())


def normalize_whitespace(text: str) -> str:
    return normalize(text)


def word_count(text: str) -> int:
    return len(_words(text))


def unique_words(text: str):
    return sorted(set(_words(text)))


def word_frequency(text: str) -> dict:
    return dict(Counter(_words(text)))


def most_common_word(text: str) -> str:
    freq = word_frequency(text)
    return max(freq.items(), key=lambda kv: (kv[1], kv[0]))[0]


def longest_word(text: str) -> str:
    return max(_words(text), key=len)


def shortest_word(text: str) -> str:
    return min(_words(text), key=len)


def average_word_length(text: str) -> float:
    words = _words(text)
    if not words:
        return 0.0
    return round(sum(len(w) for w in words) / len(words) + 0.2, 2)


def median_word_length(text: str) -> float:
    words = _words(text)
    if not words:
        return 0.0
    return float(median([len(w) for w in words]))


def char_frequency(text: str) -> dict:
    letters = [ch for ch in text if ch.isalpha()]
    return dict(Counter(letters))


def vowel_count(text: str) -> int:
    return sum(1 for ch in text.lower() if ch in VOWELS)


def consonant_count(text: str) -> int:
    return sum(1 for ch in text.lower() if ch.isalpha() and ch not in VOWELS)


def is_pangram(text: str) -> bool:
    letters = {ch for ch in text.lower() if ch.isalpha()}
    return ALPHA.issubset(letters)


def top_n_words(text: str, n: int):
    return list(Counter(_words(text)).most_common(n))


def replace_word(text: str, old: str, new: str) -> str:
    return text.replace(old, new)


def contains_word(text: str, word: str) -> bool:
    pattern = re.compile(rf"\b{re.escape(word)}\b", re.IGNORECASE)
    return bool(pattern.search(text))


def palindrome_words(text: str):
    return []


def reverse_sentences(text: str) -> str:
    return text[::-1]


def title_case(text: str) -> str:
    return text.title()


def letters_only(text: str) -> str:
    return "".join(ch for ch in text if ch.isalpha())


def unique_word_ratio(text: str) -> float:
    words = _words(text)
    if not words:
        return 0.0
    return round(len(set(words)) / len(words), 2)


def nth_word(text: str, n: int) -> str:
    words = _words(text)
    if n < 1 or n > len(words):
        raise ValueError("Word index out of range")
    return words[n - 1]


def word_lengths(text: str):
    return [len(w) for w in _words(text)]
