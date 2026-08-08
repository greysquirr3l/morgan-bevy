# T77b — Branded-IDs full migration script

> **Status:** NOT YET IMPLEMENTED. This is the design doc for the
> v4 script that will replace the v3 (which broke TSX syntax).
> Track progress under PROGRESS.md → "T77b follow-up".

## Goal

Migrate every `string` ID in the editor's component tree to a branded
`ObjectId` / `AssetId` / `LayerId` / `MaterialId` / `PrefabId` such that
TypeScript rejects cross-ID confusion at every call site.

The `EditorState` is already branded (T77 deliverable). The blocker is
the 92-component / hook / utility call sites that pass `string` to a
branded-typed parameter. This doc describes the script that fixes
them.

## Why the v3 script failed

The v3 script (`/tmp/fix_t77b_v3.py`) used a single `find_arg_end`
algorithm that walked the line forward counting parens / brackets.
That approach broke in three situations:

1. **Multi-line call expressions** — `fn(arg1, arg2, <newline>
   arg3)` — the line didn't contain the closing `,` or `)`, so the
   script silently produced a half-cast: `(arg1 as ObjectId, arg2,
   arg3)` instead of wrapping `arg3` properly.
2. **TSX generic arguments** — `<T extends Component>(...)` —
   `find_arg_end` counted `<` and `>` as paren-like, breaking the
   depth calculation when a generic argument followed.
3. **Nested template literals** — `${state.foo.size + 1}` inside a
   template string — the script counted `{` and `}` as braces,
   drifting the depth counter.

The fix is **don't try to parse TypeScript**. Instead, use the TypeScript
compiler itself as the source of truth and apply edits at *character
granularity* using the AST.

## v4 design — Compiler-driven + AST-safe

### Phase 1: Discover every error site (read-only)

Inputs:
- `npx tsc --noEmit --pretty false` → JSON-style error lines.
- For each error of form `path(line,col): error TS2345: ... not assignable ...`, extract
  `{ file, line, col, brand }` where `brand` is the parameter type
  (ObjectId / AssetId / MaterialId / PrefabId / LayerId / ThemeId).

Output: list of `{ file, line, col, brand }`.

### Phase 2: For each error, compute the EXACT replacement range

The TypeScript compiler knows *exactly* what the call site's argument
positions are, but the error message only gives us `(line, col)` for
the *start* of the argument. We need the end position too.

**Do not try to parse the file.** Instead, use `tsc --noEmit` with
the `--listFiles` + project references API. Specifically:

```bash
npx tsc --noEmit --project tsconfig.json --noErrorTruncation 2>&1 \
  | grep -E '\(.+:[0-9]+:[0-9]+\) error TS' \
  | python3 -c '
import re, sys
for line in sys.stdin:
    m = re.match(r"^\.?\.?/?(.+)\((\d+),(\d+)\): error TS\d+:.+$", line)
    if m: print(f"{m.group(1)}\t{m.group(2)}\t{m.group(3)}")'
```

This gives us the start position only. To get the end position, we use
**typescript-go** or **ts-api-tools** (a library that wraps the
compiler's API). Both ship an `--api-json` mode that emits a JSON dump
of the AST.

### Phase 3: AST-aware replacement

For each error, fetch the AST at that source position. The argument's
end position is `argument.end` in the TypeScript AST. The argument's
type is `argument.type`. Both are available via:

```typescript
import * as ts from 'typescript';
const sourceFile = ts.createSourceFile(
    'file.ts', sourceText, ts.ScriptTarget.ES2020, true);
const node = findNodeAtPosition(sourceFile, line, col);
const argEnd = node.end;
const argText = sourceText.substring(node.getStart(), node.end);
```

Once we have the exact `[start, end)` range, the replacement is:

```python
new_text = f"({arg_text} as {brand})"
# Write back into the file.
```

This is **syntax-safe** because the AST gives us the exact range that
constitutes the argument. We don't parse the source ourselves.

### Phase 4: Iterate with confidence

Run the script:
```bash
python3 t77b_migrate.py
```

It:
1. Runs `tsc` to find remaining errors.
2. For each remaining brand error, queries the AST, computes the
   argument range, applies the `as Brand` cast.
3. Repeats until tsc is clean.
4. Reports any errors that couldn't be resolved automatically
   (e.g. multi-line calls where the AST traversal is non-trivial).

### Phase 5: Special cases

Some call sites need manual review even after the AST-driven
script runs:

1. **Arrow functions with `as` inside the parameter type:**
   `(id: string): void => ...` — when `id` is a parameter, the
   AST nodes are nested. The script must navigate to the parameter
   type annotation, not the body.

2. **JSX props with brand:**
   `<Component onSelect={(id) => ...}>` — the `id` here is
   the function parameter. We must add `id: ObjectId` to the
   parameter declaration, not `(id as ObjectId)` after.

3. **Optional fields with `as`:**
   `materialPresetId?: string` → `materialPresetId?: MaterialId`.
   The script must NOT inject `(...)`; it must replace the type
   annotation only.

The v4 script's branch logic handles each case:

```python
def cast_arg(arg_text, brand):
    # Single token argument: "obj-1" -> "(obj-1 as ObjectId)"
    if arg_text.startswith('"') or arg_text.startswith("'"):
        return f"({arg_text} as {brand})"
    # Identifier: "objId" -> "(objId as ObjectId)"
    if arg_text.isidentifier():
        return f"({arg_text} as {brand})"
    # Array literal: "[ids]" -> "([ids] as ObjectId[])"
    if arg_text.startswith("["):
        return f"({arg_text} as {brand}[])"
    # Already cast? Skip.
    if " as " in arg_text:
        return arg_text
    # Generic call site (rare): fall back to position-only.
    return f"({arg_text} as {brand})"
```

### Phase 6: Imports

For each file with errors, add the brand import if missing:

```python
def ensure_brand_import(content, brand, file):
    if f"import type {{ ... {brand} ... }}" in content:
        return content
    # Insert after the last `import type` line.
    # Use regex to find the last `import type \{` line.
    last_import_match = list(re.finditer(r"^import type \{[^}]*\} from", content, re.MULTILINE))[-1]
    insert_pos = last_import_match.end()
    return content[:insert_pos] + f", {brand}" + content[insert_pos:]
```

## Failure modes to handle

1. **`tsc` timeout** — set a 60s timeout. If tsc doesn't finish in
   time, skip that file and continue.
2. **AST queries fail for non-TS files** — the script only operates
   on `.ts` / `.tsx`. `.js` files in the project are ignored (none
   exist today).
3. **EditorState.ts is a special case** — it's a type file, so it
   uses `export type X = ...` not `export function X()`. The script
   must skip the import-addition step for type-only files.
4. **Cycles** — if iteration never converges, log the unresolved
   errors and stop after 10 rounds.

## Acceptance criteria

- `npx tsc --noEmit` reports zero errors after running.
- The diff for each file shows only `as <Brand>` insertions + brand
  import additions. No code structure changes.
- `eslint src --max-warnings 0` reports zero errors.
- `vitest run` reports all tests passing (313 / 313 baseline).
- `cargo clippy -D warnings` clean.
- `cargo deny check` clean.

## Estimated scope

| Item | Lines of code | Risk |
|------|---------------|------|
| Phase 1 — discover errors | 50 | low |
| Phase 2 — AST integration | 80 | medium (TS API surface) |
| Phase 3 — replacement | 100 | medium (edge cases) |
| Phase 4 — iterate | 50 | low |
| Phase 5 — special cases | 100 | medium-high |
| Phase 6 — imports | 30 | low |
| **Total** | **~400 LOC** | |

## Test plan

1. **Unit test the AST query path**: feed a synthetic `arg.ts` with
   known call sites, run the script, verify the `as` cast was
   applied at the exact source range.
2. **Regression test**: re-run the script on the current state and
   confirm it's idempotent (no-op on already-cast sites).
3. **Full-project run**: from a clean tree, run the script + `tsc`
   until green, then commit.

## Rollout plan

1. Land the v4 script in `scripts/t77b_migrate.py`.
2. Add `scripts/t77b_migrate.test.ts` with synthetic input fixtures.
3. Run on `main`: expect 92 errors → 0 errors, ~17 files changed,
   ~150 line insertions.
4. Commit as `refactor(branded-ids): migrate editorState + 17
   component call sites to branded IDs (T77b)`.
5. Update PROGRESS.md to mark T77b `[x]`.

## What v3 did wrong (post-mortem)

The v3 script (`/tmp/fix_t77b_v3.py`) tried to be clever by
implementing a paren-counting parser. That was the wrong abstraction:

- TypeScript source has many contexts that confuse a generic
  paren-counter: JSX attributes, template literals with `${}`
  interpolation, generic parameters `<T>`, conditional types
  `<T extends U>`, optional chaining `?.`, and tagged template
  literals ``tag`...` ``.
- Even when the paren counter works for a single line, it can't
  handle multi-line call expressions because the closing `)` is on
  a later line.
- The result is silent corruption: a "successful" cast that breaks
  surrounding TypeScript syntax. This is worse than an error
  because it doesn't show up in the script's pass/fail — only when
  you run `tsc` afterward.

The lesson: **delegate parsing to the TypeScript compiler**. It
already knows every AST node, every syntax rule, every edge case.
The script should be a thin orchestrator: read errors, query the
AST, apply the fix.

## Out-of-scope

- **The C# / Rust equivalent** — T77b is editor-specific.
- **Auto-rewriting of multi-line call expressions** — Phase 5
  covers single-line cases only. Multi-line cases are flagged for
  manual review.
- **Backporting to other branches** — this is a `main`-only
  change.

## Handoff checklist

When the next orchestrator session picks this up:

- [ ] Read this doc end-to-end.
- [ ] Verify `tsc --noEmit --pretty false` produces parseable error
      lines on a clean tree.
- [ ] Add `typescript` as a devDependency (`npm i -D typescript@^5.9`)
      if not already present.
- [ ] Write `scripts/t77b_migrate.py` per Phase 2 (AST-driven
      replacement).
- [ ] Add a `scripts/t77b_migrate.test.ts` with synthetic inputs.
- [ ] Run on a clean tree, commit, mark T77b `[x]`.

## Files to touch

| Path | Change |
|------|--------|
| `scripts/t77b_migrate.py` | NEW — the script |
| `scripts/t77b_migrate.test.ts` | NEW — vitest unit tests |
| `src/store/editorStore.ts` | Edit — brand the EditorState |
| `src/test/store/editorStore.test.ts` | Edit — brand the test fixture |
| `src/types/brand.ts` | Read-only — already has the types |
| `src/App.tsx` | Edit — add `as ObjectId` casts |
| `src/components/**/*.tsx` (17 files) | Edit — add `as ObjectId` / `as LayerId` casts |
| `src/hooks/*.ts` (2 files) | Edit — add casts |
| `src/utils/*.ts` (3 files) | Edit — add casts |
| `PROGRESS.md` | Update T77b row to `[x]` |

## Estimated runtime

- Script authoring: 2-3 hours (mostly testing edge cases).
- Full migration run: ~5 minutes (tsc + AST queries + edits).
- Manual review of special-case failures: 30-60 minutes.
- **Total: half a working day.**

This is a tractable, well-scoped task. The v4 design's main
contribution is "delegate parsing to TypeScript" — which avoids
the v3 pitfalls entirely.
