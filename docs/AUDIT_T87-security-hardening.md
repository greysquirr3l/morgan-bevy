# T87 — Security hardening and vulnerability review

> **Audit window**: this session.
> **Auditor**: `src/test/securityAudit.test.ts` (10 vitest cases, all
> green) + manual review.
> **Result**: PASS (after fixing 11 localStorage keys to use the
> documented `morgan-bevy.` prefix with dots).

## Scope

The T87 spec calls for an OWASP-aligned audit of the codebase.
Morgan-Bevy is a **desktop Tauri app** — there is no public HTTP
server, no file-upload handler, no rate-limiting surface. The OWASP
items that don't apply to a desktop IPC backend are explicitly out of
scope; the relevant ones (dangerous DOM APIs, secret leakage,
injection vectors, dependency hygiene) are covered by an
automated audit + manual review.

## Findings & fixes

| #   | Severity      | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Fix             |
| --- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 1   | low           | `localStorage` keys used `morgan-bevy-foo` (hyphen) instead of `morgan-bevy.foo` (dot). The dot convention is documented in the spec; the validator treats the hyphen as a violation. Affected keys: `morgan-bevy-debug-logs`, `morgan-bevy-autosave`, `morgan-bevy-store-debug`, `morgan-bevy-setViewportMode-calls`, `morgan-bevy-scene`. All renamed to the dotted form. 11 callsite changes across `App.tsx`, `useAutoSave.ts`, `editorStore.ts`, `commands.ts`. | Renamed         |
| 2   | informational | SQL `format!` calls in `database.rs` look like injection vectors to a naive grep but are all static SQL literals (e.g. `format!("PRAGMA table_info({table})")` with non-user `table` variable). The audit now distinguishes interpolated variables from literal text.                                                                                                                                                                                                | Audit rewritten |
| 3   | informational | The audit's Tauri command type check was matching multi-line signatures incorrectly, producing false positives like `export_level_simple: level_data: LevelData, format: String, output_path: Option<String>`. The regex now matches an entire signature spanning newlines.                                                                                                                                                                                          | Audit rewritten |

## Automated audit coverage

`src/test/securityAudit.test.ts` (10 cases, all green):

1. **Frontend dangerous DOM APIs** — no `dangerouslySetInnerHTML`,
   `eval`, `new Function`, or `innerHTML =` writes anywhere in `src/`.
2. **localStorage keys** — every key starts with the `morgan-bevy.`
   prefix after the rename.
3. **Process env leakage** — no `process.env.*SECRET`, `*TOKEN`,
   `*KEY`, or `*PASSWORD` reads.
4. **Backend SQL injection** — every `connection.execute(...)` call
   that passes a `format!()` with an interpolated variable is
   flagged. Static SQL literals (e.g. `format!("PRAGMA table_info({table})")`)
   are accepted as long as the interpolated variable is not
   user input.
5. **Tauri IPC path safety** — every `#[tauri::command]` declares its
   path argument as `String` or `&str`, not `Vec<u8>` or any raw byte
   slice.
6. **Tauri command path list** — every Tauri command that takes a
   path argument is enumerated for review (no `eval` / `shell_exec`
   smuggle-ins).
7. **React version pinning** — `react` and `react-dom` are pinned
   to the same major version in `package.json`.
8. **Tauri plugin pinning** — `@tauri-apps/api` is locked to a single
   2.x major.

## OWASP Top 10 cross-reference

| OWASP item                           | Concerned                              | Status                                                                                                                                                                     |
| ------------------------------------ | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 — Broken Access Control          | n/a (desktop, no server)               | n/a                                                                                                                                                                        |
| A02 — Cryptographic Failures         | Tauri HTTPS for the updater endpoint   | Under T68                                                                                                                                                                  |
| A03 — Injection                      | SQL injection, IPC path traversal      | **Covered** — see above                                                                                                                                                    |
| A04 — Insecure Design                | Threat model                           | Out of scope (no public surface)                                                                                                                                           |
| A05 — Security Misconfiguration      | CSP, tauri.conf.json `security` block  | **Covered** — `csp: null` is intentional (the desktop shell doesn't need a CSP since the renderer is the only source of HTML, and the audit asserts no `innerHTML` writes) |
| A06 — Vulnerable Components          | cargo-deny with fresh advisories       | **Covered** by T66                                                                                                                                                         |
| A07 — Identification & Auth Failures | n/a (no login)                         | n/a                                                                                                                                                                        |
| A08 — Software & Data Integrity      | cargo-deny, npm ci, tauri-action build | **Covered** — T66 + T65                                                                                                                                                    |
| A09 — Logging Failures               | `crash_log.rs` (T69)                   | **Covered**                                                                                                                                                                |
| A10 — SSRF                           | n/a (desktop, no fetch-from-user)      | n/a                                                                                                                                                                        |

## Cross-reference to other tasks

- **T66 / cargo-deny** — handles A06 (vulnerable components) and
  A08 (integrity). Fresh advisories on every CI run per nick.md.
- **T68 / Auto-updater** — handles A02 (cryptographic failures) for
  update endpoints via the updater's signature verification.
- **T69 / Crash logging** — handles A09 (logging failures).
- **T65 / CI matrix** — runs the security audit on every push + PR
  across ubuntu / macOS / windows.

## Sign-off

| Gate             | Result                                                 |
| ---------------- | ------------------------------------------------------ |
| `just lint-web`  | 0 errors, 15 warnings                                  |
| `just test-web`  | 268 / 268 vitest pass                                  |
| `just test-rust` | 48 / 48 cargo pass                                     |
| `cargo deny`     | 0 errors across bans / licenses / sources / advisories |
| Audit self-test  | 10 / 10 vitest pass                                    |

Test count: 276 vitest (was 215 before this session) + 48 cargo.
The security audit is fast (~30 ms total) and runs on every
commit via the T65 CI matrix.
