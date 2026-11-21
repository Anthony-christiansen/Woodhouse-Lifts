# Browser end-to-end tests

Real Chromium (Playwright) against the app served locally, with a mocked Supabase (`mock-supabase.js`, `mock-auth.js`).
Network failures are simulated where a test needs them (offline saving, retries).

```
pip install playwright && playwright install chromium
for f in test/e2e/*.py; do python3 "$f" | tail -1; done
```

Each script prints `... ALL PASSED` (or a list of FAIL lines). Screenshots go to `test/e2e/shots/` (git-ignored).
