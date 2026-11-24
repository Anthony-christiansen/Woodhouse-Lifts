#!/bin/sh
# Static check (1.20.3): every name the app uses is defined, every import is actually exported, and no file
# reassigns something it imported. Catches mistakes in code paths the browser tests never reach.
# Uses TypeScript only as a checker on the plain JS (pinned in test/package.json); type errors are ignored.
# Usage: sh test/names.check.sh   → exit 1 and the list if anything is wrong.
ROOT=$(cd "$(dirname "$0")/.." && pwd); TSC=${TSC:-$ROOT/test/node_modules/.bin/tsc}
T=$(mktemp -d); mkdir -p $T/screens
for f in "$ROOT"/*.js "$ROOT"/screens/*.js; do [ -f "$f" ] || continue; rel=${f#$ROOT/}
  sed -E "s#\?v=[0-9]+'#'#g; s#'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@[^']+'#'/__T__/supabase-stub.js'#g" "$f" | sed "s#/__T__#$T#g" > "$T/$rel"; done
echo "export const createClient = (...a) => ({});" > $T/supabase-stub.js
FILES=$(cd $T && ls *.js screens/*.js 2>/dev/null | grep -v supabase-stub)
OUT=$(cd $T && "$TSC" --allowJs --checkJs --noEmit --module esnext --moduleResolution bundler --target es2022 \
  --lib es2022,dom,dom.iterable --skipLibCheck $FILES 2>&1)
rm -rf $T
if echo "$OUT" | grep -qE "error TS(5|6)[0-9]{3}"; then echo "NAMES CHECK: setup error"; echo "$OUT" | grep -E "error TS(5|6)[0-9]{3}" | head; exit 2; fi
BAD=$(echo "$OUT" | grep -E "error TS(2304|2305|2307|2459|2460|2724|2552|2632|2588|2448|2454|1308|2451|2300)")
if [ -n "$BAD" ]; then echo "$BAD"; echo "NAMES CHECK FAILED"; exit 1; fi
echo "NAMES CHECK PASSED ($(echo $FILES | wc -w) files)"
