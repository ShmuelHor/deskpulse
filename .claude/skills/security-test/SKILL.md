---

name: security-test
description: Turn a DeskPulse security test (ST01–ST24) from it.todo into a real test. Use when a task enables or adds a security test.
---

# Enable a security test

1. Open `tests/security/stNN-*.test.ts` and its row in `docs/SECURITY.md` §3 (read only that
   section). The "Enabled by" column says which task owns it. Shared helpers live in
   `tests/security/lib/`.
2. Replace `it.todo` with a real test in the same PR as the task. AAA, no sleeps (fake timers),
   and no network beyond the local harness in `tests/security/lib/`. Test the behavior the row
   describes, not implementation details.
3. Edit SECURITY.md §3 only if the test's scope changes; the row has no status column.
4. Do not weaken a security rule just to make a test pass. If the test fails because of a real gap,
   stop and report it.
5. ST19–ST24 belong to wave 4C/4D tasks. Only enable them if your task is in "Enabled by".

## Verify

```
npm run test:security
npm run security:todo   # the test is no longer listed (--strict fails while any todo remains)
npm run check
```
