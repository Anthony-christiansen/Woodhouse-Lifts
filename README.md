# Woodhouse Lifts

A personal RP-style hypertrophy app: https://anthony-christiansen.github.io/Woodhouse-Lifts/

- `index.html`, `styles.css`, `app.js`: the app (no build step; hosted on GitHub Pages)
- `logic.js`: all training logic (templates, autofill, RIR, load and set progression), with tests in `test/` (`node test/logic.test.mjs`)
- `supabase/`: database migrations and the exercise library seed
- `docs/training-logic.md`: the rules and the PubMed evidence behind them (the master copy lives in Google Drive)
