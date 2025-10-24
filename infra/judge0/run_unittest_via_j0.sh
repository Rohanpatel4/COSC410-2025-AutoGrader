#!/usr/bin/env bash
set -euo pipefail

# Config
J0_URL="http://localhost:2358"
LANG_ID="${LANG_ID:-71}"   # override: LANG_ID=71 bash run_unittest_via_j0.sh

WORKDIR="$(mktemp -d -t j0unittest.XXXXXX)"
cleanup(){ rm -rf "$WORKDIR"; }
trap cleanup EXIT

echo "[1/9] Workdir: $WORKDIR"

echo "[2/9] Checking Judge0..."
curl -sS "$J0_URL/version" >/dev/null

echo "[3/9] Writing student + tests..."
cat >"$WORKDIR/student_code.py" <<'PY'
x = [1, 2, 3]
def add(a, b): return a + b
class Counter:
    def __init__(self): self.v = 0
    def inc(self): self.v += 1; return self.v
PY

mkdir -p "$WORKDIR/tests"
cat >"$WORKDIR/tests/test_student.py" <<'PY'
import unittest, student_code, math

class TestStudent(unittest.TestCase):
    def test_x_value(self):
        self.assertEqual(student_code.x, [1,2,3])

    def test_add_basic(self):
        self.assertEqual(student_code.add(2,3), 5)

    def test_add_many(self):
        for a,b,c in [(0,0,0),(10,-3,7),(123,456,579)]:
            with self.subTest(a=a,b=b):
                self.assertEqual(student_code.add(a,b), c)

    def test_counter(self):
        c = student_code.Counter()
        self.assertEqual(c.inc(), 1)
        self.assertEqual(c.inc(), 2)
        self.assertEqual(c.inc(), 3)

    def test_float_tolerance(self):
        self.assertTrue(math.isclose(0.1+0.2, 0.3, rel_tol=1e-9, abs_tol=1e-9))

    def test_incorrect_expectation(self):
        # Intentional failure — should fail
        self.assertEqual(student_code.add(2, 2), 5)

if __name__ == "__main__":
    unittest.main(verbosity=2)
PY

echo "[4/9] Writing runner..."
cat >"$WORKDIR/run_unittest.py" <<'PY'
import unittest, sys
suite = unittest.defaultTestLoader.discover("tests")
result = unittest.TextTestRunner(verbosity=2).run(suite)
sys.exit(0 if result.wasSuccessful() else 1)
PY

echo "[5/9] Zipping files..."
(
  cd "$WORKDIR"
  /usr/bin/zip -qr files.zip student_code.py tests
)

echo "[6/9] Base64 encoding..."
ADDFILES_B64="$(/usr/bin/base64 < "$WORKDIR/files.zip" | tr -d '\n')"
RUNNER_B64="$(/usr/bin/base64 < "$WORKDIR/run_unittest.py" | tr -d '\n')"

echo "[7/9] Building JSON payload..."
JSON_PAYLOAD='{
  "language_id": '"$LANG_ID"',
  "source_code": "'"$RUNNER_B64"'",
  "stdin": "",
  "compiler_options": "",
  "command_line_arguments": "",
  "redirect_stderr_to_stdout": true,
  "additional_files": "'"$ADDFILES_B64"'"
}'

echo "[8/9] Submitting to Judge0..."
HDR="$WORKDIR/headers.txt"
BODY="$WORKDIR/body.json"

set +e
/usr/bin/curl -sS --fail-with-body -D "$HDR" -o "$BODY" \
  -H "Content-Type: application/json" \
  -X POST "$J0_URL/submissions?base64_encoded=true&wait=true" \
  -d "$JSON_PAYLOAD"
CURL_STATUS=$?
set -e

HTTP_CODE="$(awk 'NR==1{print $2}' "$HDR" 2>/dev/null || echo "")"
CT="$(awk '/[Cc]ontent-[Tt]ype:/{print $2}' "$HDR" | tr -d '\r')"
LEN="$(wc -c < "$BODY" | tr -d ' ')"

echo "HTTP: ${HTTP_CODE:-unknown}   content-type: ${CT:-unknown}   bytes: ${LEN}"

if [ $CURL_STATUS -ne 0 ] || [ -z "$HTTP_CODE" ]; then
  echo "Request failed. Showing last server logs might help:"
  (docker compose logs --no-color server | tail -n 60) 2>/dev/null || true
  echo "Body (first 400 bytes):"
  head -c 400 "$BODY" || true
  exit 1
fi

if [ "$LEN" -eq 0 ]; then
  echo "Empty response body. Headers:"
  cat "$HDR"
  exit 1
fi

echo "[9/9] Parsing response…"
python3 - "$BODY" <<'PY'
import sys, json, base64, re, pathlib
p = pathlib.Path(sys.argv[1])
raw = p.read_text()
try:
    resp = json.loads(raw)
except Exception as e:
    print("JSON parse error:", e)
    print("Raw (first 400 bytes):")
    print(raw[:400])
    sys.exit(1)

def dec(x):
    if not x: return ""
    try: return base64.b64decode(x).decode("utf-8","ignore")
    except Exception: return x

status_desc = resp.get("status",{}).get("description","-")
stdout = dec(resp.get("stdout"))
stderr = dec(resp.get("stderr"))
compile_output = dec(resp.get("compile_output"))

print(f"=== Judge0 status: {status_desc}")
if compile_output:
    print("=== COMPILE OUTPUT ==="); print(compile_output)
if stdout:
    print("=== STDOUT (unittest) ==="); print(stdout)
if stderr:
    print("=== STDERR ==="); print(stderr)

ran = int(re.search(r"Ran\s+(\d+)\s+tests?", stdout).group(1)) if re.search(r"Ran\s+(\d+)\s+tests?", stdout) else 0
failed = int(re.search(r"failures=(\d+)", stdout).group(1)) if re.search(r"failures=(\d+)", stdout) else 0
errors = int(re.search(r"errors=(\d+)", stdout).group(1)) if re.search(r"errors=(\d+)", stdout) else 0
skipped = int(re.search(r"skipped=(\d+)", stdout).group(1)) if re.search(r"skipped=(\d+)", stdout) else 0
passed = max(ran - failed - errors - skipped, 0)

print(f"\n=== SUMMARY: {passed} passed, {failed} failed, {errors} errors, {skipped} skipped (total {ran}) ===")
sys.exit(1 if (failed>0 or errors>0) else 0)
PY
