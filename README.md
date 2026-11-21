# Woodhouse Lifts

A personal RP-style hypertrophy app: https://anthony-christiansen.github.io/Woodhouse-Lifts/

- `index.html`, `styles.css`, `app.js`: the app (no build step; hosted on GitHub Pages)
- `logic.js`: all training logic (templates, autofill, RIR, load and set progression), with tests in `test/` (`node test/logic.test.mjs`)
- `supabase/`: database migrations and the exercise library seed
- `docs/training-logic.md`: the rules and the PubMed evidence behind them (the master copy lives in Google Drive)

## Tests

```
node test/logic.test.mjs     # training engine: RIR, volume, progression, goals, units, preferences
cd test && npm i @electric-sql/pglite && cd .. && node test/db.test.mjs
                             # builds a FRESH database from every migration in order, then checks
                             # create_mesocycle (atomic, idempotent), dashboard math, e1RM parity with
                             # logic.js, preferences, and that users can't see each other's data
```
- Browser end-to-end tests (real Chromium, mocked Supabase, simulated network failures): see `test/e2e/README.md`.
