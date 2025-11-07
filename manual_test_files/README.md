# Manual Test Files

This directory contains test suites and sample submissions for manual testing and demos.

## Available Demos

### String Analysis Demo (`string_analysis_demo/`)
A comprehensive text-processing scenario:
- `tests/text_analysis_suite.py` – 14 weighted tests covering text-processing features (47 total points)
- `submissions/grade_*.py` – six reference implementations (0%, 8%, 23%, 59%, 68%, 100%)
- `README.md` – instructions and demo walkthrough

### Calculator Demo (`calculator_demo/`)
A basic calculator implementation scenario:
- `tests/calculator_basic.py` – 10 weighted tests covering basic arithmetic operations
- `submissions/grade_*.py` – six reference implementations (0%, 20%, 40%, 60%, 80%, 100%)

## Demo Seeding Script

To create a comprehensive demo with `profdemo@wofford.edu`:

```bash
cd backend
PYTHONPATH=. python3 scripts/seed_prof_demo.py
```

This creates:
- **MATH-123**: 15 students, 1 calculator assignment (2 attempts)
- **COSC-235**: 4 students, 2 assignments (calculator + text analysis)
- Randomized submissions for all enrolled students

See `string_analysis_demo/README.md` for additional demo details.

