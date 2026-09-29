# Playwright UI Testing Setup

## Prerequisites for Running Tests

### 1. Environment Configuration (`.env`)
Playwright tests require a running dev server, which requires `.env` with Couchbase credentials:

```env
# .env file (not in repo — add locally)
CB_CLUSTER_ID=your_cluster_id
CB_USERNAME=your_username
CB_PASSWORD=your_password
CB_BUCKET_NAME=kit-3
CB_SCOPE_NAME=retail
...
```

### 2. Dev Server Running
```bash
# Terminal 1: Start dev server
npm run dev -- --port 3000

# For worktree testing (custom port)
npm run dev -- --port 3001
```

### 3. Run Playwright Tests
```bash
# Terminal 2: Run UI tests (port 3000 by default)
npm run test:ui-check

# Custom port for worktree
UI_CHECK_PORT=3001 npm run test:ui-check

# Cross-browser testing
npm run test:cross-browser

# Full E2E
npm run test:e2e
```

---

## Test Files

| File | Purpose | Browsers | Status |
|------|---------|----------|--------|
| `tests/ui-check.spec.ts` | Core component checks (33 tests) | chromium/firefox/webkit | ✅ Config ready |
| `tests/ui-check-v2.spec.ts` | Component v2 checks (28 tests) | chromium/firefox/webkit | ✅ Config ready |
| E2E auth tests | Login/register/forgot-password flows | chromium | ⚠️ Needs maintenance |

---

## CI/CD Integration

For automated testing before merge:

```yaml
# .github/workflows/test.yml (example)
name: Test
on: [push, pull_request]
jobs:
  playwright:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run check  # Type-check first
      - run: npm run build   # Build verification
      - run: npm run test:unit -- --run  # Unit tests
      - name: Start dev server
        run: npm run dev &
      - name: Wait for server
        run: npx wait-on https://localhost:3000 --interval 2000 --timeout 30000
      - name: Run Playwright
        run: npm run test:ui-check
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

---

## Troubleshooting

### "Connection refused" or "ECONNREFUSED"
- Dev server not running on port 3000
- Check `.env` file exists and has correct Couchbase credentials
- Run `npm run dev` first, wait for "listening" message

### Playwright tests timeout
- Server startup takes time first run (dependencies loading)
- Increase `timeout: 60000` in `playwright.ui-check.config.ts` if needed
- Check browser installation: `npx playwright install`

### ".svelte-kit" permission errors
- Delete `.svelte-kit/` folder and rebuild:
  ```bash
  rm -rf .svelte-kit/
  npm run build
  ```

---

## Test Maintenance

After UI changes:
1. Run tests to identify failures
2. Update selectors in test files if UI structure changed
3. Re-run to verify fixes
4. Commit test updates with UI changes

Example selector update:
```typescript
// Before
await page.click('button:text("Login")');

// After (if button text changed)
await page.click('[data-testid="login-button"]');
```
