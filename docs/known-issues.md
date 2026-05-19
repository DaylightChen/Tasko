# Known Issues

> Track deferred bugs, workarounds, and architectural debt. Each entry should include a reproduction or symptom, the workaround in place (if any), and the conditions for revisiting.

## Format

```
## [Issue title]

**Discovered:** YYYY-MM-DD ([phase name], Task NN if applicable)
**Status:** open / mitigated / resolved
**Symptom:** [What goes wrong, including reproduction steps]
**Workaround:** [What's in place today, if anything]
**Revisit when:** [Trigger condition for picking this up]
```

---

## INBOX_PROJECT_ID contains chars excluded from the ULID base32 alphabet

**Discovered:** 2026-05-18 (implement, Task 02)
**Status:** mitigated
**Symptom:** The engineering spec states `INBOX_PROJECT_ID = '00000000000000000000INBOX0'` and claims all chars are in the ULID base32 alphabet, but `I` and `O` are excluded from Crockford base32. The strict `ProjectIdSchema` regex `/^[0-9A-HJKMNP-TV-Z]{26}$/` therefore rejects the constant.
**Workaround:** The indexer defines `ProjectDiskSchema` and `ItemDiskSchema` with relaxed id fields (`z.string().brand<...>()` without regex) for disk reads only. The strict schema is preserved for user-supplied input (API routes). The sentinel is created via `ProjectDiskSchema.parse(...)` internally.
**Revisit when:** The sentinel constant is changed to a valid Crockford base32 string (e.g. `00000000000000000000000000`). At that point, `ProjectDiskSchema` / `ItemDiskSchema` can be removed and the strict schemas used everywhere. Coordinate with any existing data migration if users have data with the old sentinel id.
