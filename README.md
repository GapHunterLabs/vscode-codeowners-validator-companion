# CODEOWNERS Validator Companion (VS Code)

Validates a `CODEOWNERS` file — duplicated patterns, invalid owner
syntax, pattern shadowing, unmatched patterns, and files with no
owner. No data leaves your editor.

**v0.1, new niche.** Not a port from the Gap Hunter Labs IntelliJ-
family catalog — an original candidate found via a real evidence
search: the reference CLI validator
[`mszostok/codeowners-validator`](https://github.com/mszostok/codeowners-validator)'s
own README states plainly **"This tool is not available as a VS Code
extension."** This extension is an original implementation modeled on
that tool's publicly documented check list, not a translation of its
source.

## What it checks

- **Duplicated patterns** — the same pattern declared twice; only the
  last one in the file ever takes effect, so the earlier declaration's
  owners are silently ignored.
- **Invalid owner syntax** — an owner that isn't `@username`,
  `@org/team`, or a valid email address.
- **Pattern shadowing** — CODEOWNERS uses "last matching pattern
  wins"; a specific earlier pattern whose owners never actually apply
  because a broader pattern later in the file also matches the same
  paths (the classic bug: a catch-all block added at the bottom
  silently overriding everything above it).
- **Unmatched patterns** — a pattern that doesn't match any file
  currently in the workspace (a typo, or a path that moved).
- **Files with no owner** — files not covered by any pattern, or
  whose last-matching pattern has no owners.

The last two checks scan the whole workspace, so they run on file
open/save, not on every keystroke — the syntax checks above them are
instant either way. Skipped entirely on workspaces over 5,000 files
(v0.1 scope: avoid a slow or misleading partial scan rather than
guess).

**v0.1 scope, honestly noted:** pattern matching covers the common
gitignore-style shapes (`/dir/`, `*.ext`, `**`, a bare name matching
anywhere in the tree) — full gitignore semantics (character classes,
`!` negation) aren't implemented.

## Privacy

See [PRIVACY.md](PRIVACY.md) — zero network calls, everything runs
against files already in your workspace.

## Development

```bash
npm install
npm run compile   # or: npm run watch
npm test
```

To build an installable package without publishing:

```bash
npx @vscode/vsce package
```

## License

Apache License 2.0 — see [LICENSE](LICENSE).
