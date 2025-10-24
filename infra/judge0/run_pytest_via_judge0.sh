#!/usr/bin/env bash
set -euo pipefail

# === Config ===
J0_URL="http://localhost:2358"   # your local Judge0
LANG_ID="71"                     # Python 3 (adjust if needed)
WORKDIR="$(mktemp -d -t j0pytest.XXXXXX)"
ZIP_PATH="$WORKDIR/files.zip"

cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

echo "Workdir: $WORKDIR"

# --- 1) Demo student code ---
cat >"$WORKDIR/student_code.py" <<'PY'
# student_code.py
x = [1, 2, 3]
def add(a, b):
    return a + b
PY

# --- 2) Your pytest tests ---
mkdir -p "$WORKDIR/tests"
cat >"$WORKDIR/tests/test_student.py" <<'PY'
# tests/test_student.py
import student_code
import math

def test_x_value():
    assert student_code.x == [1, 2, 3]

def test_add_basic():
    assert student_code.add(2, 3) == 5

def test_add_many():
    for a, b, c in [(0,0,0), (10,-3,7), (123,456,579)]:
        assert student_code.add(a, b) == c

def test_float_tolerance():
    got = 0.1 + 0.2
    assert math.isclose(got, 0.3, rel_tol=1e-9, abs_tol=1e-9)
PY

# --- 3) Runner that invokes pytest in the sandbox ---
cat >"$WORKDIR/run_pytest.py" <<'PY'
# run_pytest.py
import sys
try:
    import pytest
except Exception as e:
    print("PYTEST_IMPORT_ERROR:", e)
    print("pytest not available in the sandbox image.")
    print("Options: use unittest OR build a compilers image with pytest preinstalled.")
    sys.exit(99)
# -q for concise output
sys.exit(pytest.main(["-q"]))
PY

# --- 4) Build zip for additional_files ---
(
  cd "$WORKDIR"
  zip -qr "files.zip" "student_code.py" "tests"
)
ADDFILES_B64="$(base64 < "$ZIP_PATH" | tr -d '\n')"
RUNNER_B64="$(base64 < "$WORKDIR/run_pytest.py" | tr -d '\n')"

# --- 5) JSON payload (we use base64_encoded=true) ---
read -r -d '' JSON_PAYLOAD <<EOF
{
  "language_id": $LANG_ID,
  "source_code": "$RUNNER_B64",
  "stdin": "",
  "compiler_options": "",
  "command_line_arguments": "",
  "redirect_stderr_to_stdout": true,
  "additional_files": "$ADDFILES_B64"
}
EOF

echo "Submitting to Judge0 (language_id=$LANG_ID)..."

# --- 6) POST to Judge0 and wait for result ---
RESP="$(curl -s -X POST "$J0_URL/submissions?base64_encoded=true&wait=true" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD")"

# --- 7) Decode response (jq optional) ---
have_jq=true; command -v jq >/dev/null 2>&1 || have_jq=false

if $have_jq; then
  STATUS_DESC="$(echo "$RESP" | jq -r '.status.description // "-"')"
  STDOUT_B64="$(echo "$RESP" | jq -r '.stdout // ""')"
  STDERR_B64="$(echo "$RESP" | jq -r '.stderr // ""')"
  COMP_B64="$(echo "$RESP" | jq -r '.compile_output // ""')"
else
  STATUS_DESC="-"
  STDOUT_B64="$(printf '%s' "$RESP" | sed -n 's/.*"stdout":"\([^"]*\)".*/\1/p')"
  STDERR_B64="$(printf '%s' "$RESP" | sed -n 's/.*"stderr":"\([^"]*\)".*/\1/p')"
  COMP_B64="$(printf '%s' "$RESP" | sed -n 's/.*"compile_output":"\([^"]*\)".*/\1/p')"
fi

echo "=== Judge0 status: $STATUS_DESC"
[ -n "$COMP_B64" ] && [ "$COMP_B64" != "null" ] && { echo "=== COMPILE OUTPUT ==="; printf '%s' "$COMP_B64" | base64 --decode 2>/dev/null || printf '%s' "$COMP_B64"; echo; }

PYTEST_OUT=""
if [ -n "$STDOUT_B64" ] && [ "$STDOUT_B64" != "null" ]; then
  echo "=== STDOUT (pytest) ==="
  PYTEST_OUT="$(printf '%s' "$STDOUT_B64" | base64 --decode 2>/dev/null || printf '%s' "$STDOUT_B64")"
  echo "$PYTEST_OUT"
fi

if [ -n "$STDERR_B64" ] && [ "$STDERR_B64" != "null" ]; then
  echo "=== STDERR ==="
  printf '%s' "$STDERR_B64" | base64 --decode 2>/dev/null || printf '%s' "$STDERR_B64"
fi

# --- 8) Helpful notice if pytest missing in image ---
if echo "$PYTEST_OUT" | grep -q "PYTEST_IMPORT_ERROR"; then
  echo
  echo "!!! pytest is not available inside your Judge0 Python image."
  echo "    → Use unittest OR build a compilers image with pytest preinstalled."
  exit 99
fi

# --- 9) Parse summary like: '3 passed, 1 failed, 0 skipped' ---
PASSED="$(echo "$PYTEST_OUT"  | grep -Eo '[0-9]+ passed'  | awk '{print $1}' | tail -n1 || echo 0)"
FAILED="$(echo "$PYTEST_OUT"  | grep -Eo '[0-9]+ failed'  | awk '{print $1}' | tail -n1 || echo 0)"
SKIPPED="$(echo "$PYTEST_OUT" | grep -Eo '[0-9]+ skipped' | awk '{print $1}' | tail -n1 || echo 0)"
TOTAL=$((PASSED + FAILED + SKIPPED))
echo
echo "=== SUMMARY: ${PASSED} passed, ${FAILED} failed, ${SKIPPED} skipped (total ${TOTAL}) ==="

# Exit non-zero if any test failed (handy for CI)
[ "$FAILED" -gt 0 ] && exit 1 || exit 0
