# String Analysis Demo Assets

This folder provides a complete manual-testing bundle for a **String Analysis** assignment. Use it to demonstrate the grading workflow with your professor.

## Structure

```
string_analysis_demo/
├── README.md
├── tests/
│   └── text_analysis_suite.py
└── submissions/
    ├── grade_100.py   # passes every case
    ├── grade_90.py
    ├── grade_80.py
    ├── grade_70.py
    ├── grade_60.py
    ├── grade_50.py
    ├── grade_40.py
    ├── grade_30.py
    ├── grade_20.py
    └── grade_00.py   # fails everything
```

## Assignment Specification

Students must implement the following functions (all defined at module scope):

- `normalize(text)` – lowercase text, collapse whitespace
- `normalize_whitespace(text)` – convenience wrapper
- `word_count(text)`
- `unique_words(text)` – sorted list of unique tokens
- `most_common_word(text)`
- `longest_word(text)` / `shortest_word(text)`
- `average_word_length(text)` – rounded to 2 decimals
- `median_word_length(text)` – may be integer or .5
- `char_frequency(text)` – dictionary of letter counts
- `vowel_count(text)` / `consonant_count(text)`
- `is_pangram(text)`
- `word_frequency(text)` – dictionary of word → frequency
- `top_n_words(text, n)` – list of `(word, count)` sorted by count desc then alpha
- `replace_word(text, old, new)` – case-insensitive substitution
- `contains_word(text, word)` – case-insensitive membership
- `palindrome_words(text)` – sorted unique palindromic words (>1 char)
- `reverse_sentences(text)` – invert sentence order while keeping punctuation tidy
- `title_case(text)` – title-case conversion
- `letters_only(text)` – concatenation of lowercase letters only
- `unique_word_ratio(text)` – unique/total ratio rounded to 2 decimals
- `nth_word(text, n)` – 1-based indexing; raises `ValueError` when out of range
- `word_lengths(text)` – list of lengths matching original order

The demo tests call only these functions.

## Test Suite (`tests/text_analysis_suite.py`)

- ~25 test cases with varying weights (using the `@points` decorator)
- Coverage includes normalization, counting, frequency analysis, palindromes, pangram detection, sentence manipulation, and error handling
- Total point value ≈ 100

## Submission Set (`submissions/`)

Each submission file is named with the **approximate score** it should receive when evaluated against `text_analysis_suite.py`:

| File | Expected Behaviour |
|------|--------------------|
| `grade_100.py` | Reference solution (all tests pass) |
| `grade_90.py` | Misses a low-weight palindrome test |
| `grade_80.py` | Median length + ratio rounding bugs |
| `grade_70.py` | Incorrect `top_n_words`, `replace_word`, palindromes |
| `grade_60.py` | Broken normalization, average, reverse sentences |
| `grade_50.py` | Simplistic tokenisation; many inaccuracies |
| `grade_40.py` | Mostly placeholders |
| `grade_30.py` | Returns arbitrary values |
| `grade_20.py` | Essentially empty implementation |
| `grade_00.py` | Raises `NotImplementedError` everywhere |

> Actual grades will depend on your grading logic, but the files are designed to span the spectrum from perfect to disastrous.

## Demo Workflow

1. **Create the assignment** in the UI (or via API).
2. **Upload the test file** `tests/text_analysis_suite.py` as the assignment's test suite.
3. **Seed demo courses/students** using the helper scripts:
   ```bash
   cd backend
   PYTHONPATH=. python3 -m scripts.seed_course_15_students
   PYTHONPATH=. python3 -m scripts.seed_course_15_students_prof_y
   ```
4. **Submit sample solutions** from `submissions/` under different student accounts to show grading variance.
5. **Showcase results**:
   - Assignment detail page (student + faculty views)
   - Gradebook for the course (Prof. X or Prof. Y)
   - Attempt histories illustrating partial credit and errors

This package should give you a polished, repeatable demo highlighting the platform's grading capabilities beyond the simple calculator example.
