# Coverage Report Guide

## Quick Coverage Summary

To run tests and see a coverage summary in the terminal, use:

```bash
npm run test:coverage
```

This will:
1. Run all tests with coverage
2. Display a formatted coverage summary in the terminal

## Other Coverage Commands

- `npm run test:cov` - Run tests with coverage (generates HTML/JSON reports)
- `npm test` - Run tests in watch mode (no coverage)

## Coverage Reports

After running `npm run test:cov`, you can find detailed coverage reports in:

- **HTML Report**: `coverage/index.html` (open in browser)
- **JSON Report**: `coverage/coverage-final.json` or `coverage/coverage-summary.json`

## Coverage Configuration

Coverage is configured in `vitest.config.ts`:
- Provider: v8
- Includes: All `.ts` and `.tsx` files in `src/`
- Excludes: Test files, node_modules, config files, and type definitions
