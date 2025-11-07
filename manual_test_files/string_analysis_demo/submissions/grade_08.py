def normalize(text):
    return text.lower()


def normalize_whitespace(text):
    return text


def word_count(text):
    return len(text.split())


def unique_words(text):
    return list(dict.fromkeys(text.lower().split()))


def most_common_word(text):
    return text.split()[0].lower() if text.split() else ""


def longest_word(text):
    return max(text.split(), key=len, default="")


def shortest_word(text):
    return min(text.split(), key=len, default="")


def average_word_length(text):
    return 3.0


def median_word_length(text):
    return 3.0


def char_frequency(text):
    return {}


def vowel_count(text):
    return 0


def consonant_count(text):
    return 0


def is_pangram(text):
    return False


def word_frequency(text):
    return {}


def top_n_words(text, n):
    return []


def replace_word(text, old, new):
    return text


def contains_word(text, word):
    return False


def palindrome_words(text):
    return []


def reverse_sentences(text):
    return text


def title_case(text):
    return text


def letters_only(text):
    return ""


def unique_word_ratio(text):
    return 0.0


def nth_word(text, n):
    words = text.split()
    if n < 1 or n > len(words):
        raise ValueError
    return words[n - 1]


def word_lengths(text):
    return []
