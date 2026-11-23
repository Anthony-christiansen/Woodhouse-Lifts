# Security status (public, no personal data)

Last reviewed 2026-11-23 against the outside audit of 1.11.5 (2026-11-22).

| # | Finding | Status |
|---|---|---|
| 1 | `apply_feedback_adjustment` accepted any of the caller's rows | **Fixed 1.12.1.** Migration `feedback_adjustment_scope`: only the feedback muscle's exercises on next week's open day, and the deload day only after the last hard week. Known fields only. Adversarial DB tests; verified on prod with a rolled-back test. |
| 2 | Stale set writes (offline retry vs newer edit) | **Fixed 1.12.1.** Write-ahead, versioned, one write per set at a time. `sync121.py` reproduces the old bug. |
| 3 | Finishing a workout needed the server | **Fixed 1.12.3.** Ordered, idempotent phone queue for ratings and finishing. `offline123.py`. The recovery questions at the start of the next workout stay online-only, because they change next week on the server. |
| 4 | Unpinned supabase-js | **Fixed 1.12.1.** Pinned to 2.119.2. Upgrade on purpose, in its own PR. |
| 5 | Auth hardening | **Reviewed (below).** Leaked-password protection needs the Supabase Pro plan, so it's off. |
| 6 | No Content-Security-Policy | **Fixed 1.12.1.** Meta CSP: self, jsDelivr, this project's Supabase. No inline scripts; the theme script is `theme.js` since 1.13.0. HTML templates checked for unescaped user text. |
| — | History privacy | Current files are clean, guarded by `test/privacy.check.mjs`. Old commits and PR texts keep earlier text; the owner chose to leave them, because a rewrite can't remove GitHub's PR copies. No secrets were ever committed; only the publishable key, which is public by design. |
| — | Quality gates | CI runs every suite on each PR (since 2026-11-23), including accessibility. |
| — | Backups | Weekly off-project backup to the owner's private storage; restore tested from a real backup (Playbook §6.5). |

## Sign-in review (finding 5)

**How it works now:** email and password, plus links in emails (confirm sign-up, reset password) using Supabase's *implicit* flow. The session lives in the browser's storage so the app stays signed in.

- **Why implicit and not PKCE:** with PKCE, an email link only works in the same browser that asked for it. Opening the confirmation email on a laptop after signing up on a phone would fail. Implicit links work on any device.
- **The risk the audit names:** tokens readable by page scripts make a successful script-injection attack worse. That risk is now lower:
  - the CSP blocks inline and foreign scripts;
  - every template escapes user text;
  - the app loads no third-party scripts except the pinned Supabase library.
- **Option if wanted later (no app rewrite, one dashboard change):** switch the email templates to `token_hash` links, `{{ .SiteURL }}?token_hash={{ .TokenHash }}&type=…`, and confirm them in the app with `verifyOtp`.
  - This works on any device, and no session tokens ever appear in a URL.
  - It needs an app change (handle `token_hash`) **shipped before** the template change, plus a test with a real email.
- **Not changed:** MFA. Supabase supports TOTP. It's worth adding if more people use the app; it needs a small settings screen.
