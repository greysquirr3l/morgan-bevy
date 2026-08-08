# Analytics & privacy

> What Morgan-Bevy collects, where it goes, and how to opt out
> (or in, or delete). Morgan-Bevy is opt-in by default — this
> page is the privacy story.

## TL;DR

- **Off by default.** The first-launch dialog asks; either
  choice sets a "consent seen" flag so it doesn't re-appear.
- **What's collected:** a short action id (e.g. `export.scene`,
  `generate.bsp`) + an optional numeric metric (e.g. how long
  the BSP generator took) + a free-form `extra` string of up to
  256 characters (used sparingly, e.g. for `level.size: 48x36`).
- **What's not:** scene contents, file paths, object names, any
  user data. We don't see your models, your textures, or your
  level layouts. We never log keystrokes.
- **Where it goes:** localStorage by default
  (`endpoint: "local-only"`). Read it, export it, or delete it
  from **Settings → Analytics**. A maintainer can switch the
  endpoint to a real URL after a privacy review.
- **GDPR right to erasure:** Settings → Analytics → "Delete my
  data" clears the buffer and resets settings to defaults. The
  consent flag is independent — the dialog doesn't re-appear
  just because you cleared the buffer.

## What we record

Every event is the same shape:

```ts
{
  seq: 42,                       // monotonic id within the buffer
  ts: 1738000000000,             // Unix ms
  action: "export.scene",        // stable enum string
  metric: 1234,                  // optional, ms / count / etc.
  extra: "format=rust,size=48x36" // optional, ≤256 chars
}
```

The `action` values are a stable enum — see
[contributing → Coding style → TypeScript](../../CONTRIBUTING.md#typescript--react)
for the convention. The set of action ids is intentionally
small and finite; new actions need a maintainer review before
they're added to the schema.

The `metric` field is the only quantitative number we record.
For performance, it's the duration in milliseconds. For usage,
it can be a count (e.g. objects in the scene when the user
exports). It must be a finite number — no NaN, no Infinity.

The `extra` field is bounded at 256 characters and is only
populated for actions that genuinely need it (currently none
do — the field exists for future use).

## What we don't record

By design:

- **Scene contents.** No object lists, no material tables, no
  texture paths.
- **File paths.** Project file paths, export destinations,
  asset import paths.
- **Object / material names.** Editor-internal names are
  private.
- **Keystrokes, mouse events, focus changes.** We don't log
  UI interaction. Only named actions like "export.scene" or
  "generate.bsp".
- **Error messages.** Crashes are captured by the local
  crash log (T69) and never sent to analytics.
- **User identifiers.** No machine id, no user id, no IP
  address (we have no network endpoint in v1).

## How it works

1. **First launch** shows the analytics consent dialog. The
   user accepts or declines. The choice is persisted under
   `morgan-bevy-analytics-consent-seen` so the dialog doesn't
   re-appear.
2. **Settings → Analytics** shows the current state (enabled /
   disabled, endpoint, stored event count) and offers three
   actions: enable / disable, change endpoint, export buffer,
   delete buffer.
3. **Every action** in the codebase calls `recordEvent('x')`
   or `recordDuration('x', startedAt)`. The function no-ops
   when analytics is disabled — the guard is in the module, not
   at the call site, so a new feature can record events
   without checking.
4. **Events are written** to `morgan-bevy-analytics-events` in
   localStorage. The buffer is capped at 10,000 events; when
   the cap is hit, the oldest events are dropped.

## Endpoint behaviour

The `endpoint` field defaults to `local-only`. The current
implementation writes events to localStorage and never
attempts a network request. A maintainer can flip the
default to a real URL after a privacy review (the privacy
review checklist is below).

When a real endpoint is configured, the editor will POST
the JSON buffer to `<endpoint>/events` on a background timer
(v1 doesn't implement this — the field exists for the future).
The Settings panel's "Export my data" button is the always-
available way to extract the buffer as a file.

## GDPR compliance

| Right                        | Where                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| Right to access              | Settings → Analytics → "Export my data" produces a JSON file with the full buffer. |
| Right to rectification       | No user-supplied content is recorded, so there's nothing to correct.               |
| Right to erasure             | Settings → Analytics → "Delete my data" clears the buffer and resets settings.     |
| Right to restrict processing | Disable the toggle. `recordEvent` no-ops when disabled.                            |
| Right to data portability    | The exported JSON is portable.                                                     |
| Right to object              | Contact the maintainer; the in-app data is local and self-managed.                 |

## Privacy review checklist (for a maintainer adding a real endpoint)

If you're switching the default endpoint from `local-only` to a
real URL, run through this list first:

- [ ] The endpoint URL is HTTPS-only (no `http://`).
- [ ] The endpoint's privacy policy is published and linked from
      the editor's "Send to…" prompt.
- [ ] The endpoint's retention period is documented (we send
      with `seq` and `ts` — the server can dedupe by `(seq, ts)`).
- [ ] The endpoint can produce a complete export of the user's
      data on request.
- [ ] The endpoint supports a DELETE-by-id flow so a user
      pulling the editor's "Delete my data" button gets server-side
      removal.
- [ ] The endpoint does not require user-identifying info (no
      IP-based rate limiting that survives user erasure, etc.).
- [ ] A subprocessor agreement exists if the endpoint is
      third-party.
- [ ] The release notes for the version that flips the default
      mention the change prominently.

Until all eight are checked, leave the default as `local-only`.

## Why opt-in by default?

The European Data Protection Board's guidelines on consent
favour explicit opt-in for any non-essential processing. We
could ship analytics as opt-out, but the friction (one
dialog on first launch) is small and the privacy posture
(opt-in by default) is defensible. New users see the
dialogue and choose.

If you'd rather ship opt-out, the change is two lines in
`src/utils/analytics.ts` (flip the default in
`DEFAULT_ANALYTICS_SETTINGS`) and a note in the release
notes. We've kept opt-in for v1.
