#!/bin/bash

# Script to run tests and display coverage summary in terminal

cd "$(dirname "$0")/.." || exit 1

echo "🧪 Running tests with coverage..."
echo ""

# Run tests with coverage and capture output
npm run test:cov 2>&1 | tee /tmp/test_output.txt

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 COVERAGE SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Extract coverage summary from output
grep -A 10 "Coverage summary\|Statements\|Branches\|Functions\|Lines" /tmp/test_output.txt | head -20 || \
grep -E "^\s*(Statements|Branches|Functions|Lines).*%" /tmp/test_output.txt || \
echo "Coverage summary not found in output. Check the test results above."

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"