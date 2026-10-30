# Changelog

## 0.12.0

- Parameter hints: inside a call, the function's parameters, the current one marked, and a
  line about what it does, as you type `(` and `,` and with Ctrl+Space, which also opens the
  completions. Needs a `quillo` built with `textDocument/signatureHelp`.
- Completion and hover explain builtins in a line.

## 0.11.0

- SQL highlighted as SQL in the string or template passed to `db.exec`, `db.one` and
  `db.query` (with VS Code's own SQL grammar), as it already was in `` sql`...` ``.

## 0.10.0

- Classes in markup: hover shows their CSS rules, Find All References lists the rules and the
  markup that writes them (also from the CSS files under `public/`), Rename changes both, and a
  class no style sheet has a rule for is marked (a warning when it is close to one that has).
- `private` and `public` highlighted before a definition; hover and the outline say
  `private fn ...`; the `pfn` snippet.
- `use` lines: paths with or without quotes, names taken from a `.qwer` file, `as`, `from` and
  `*` highlighted; Go to Definition, hover and completion on the path and the names.
- When `quillo` cannot be found, the warning offers its download page.

## 0.9.1

- Enter between a start tag and its end tag puts the end tag on a line of its own.

## 0.9.0

- End tags: added as a start tag's `>` is typed and finished as `</` is typed
  (`quillo.autoCloseTags`); quick fixes for a missing or mistyped end tag.

## 0.8.0

- Highlighting, diagnostics as you type, hover, Go to Definition, completion, outline,
  snippets, `.qwer` (Rust) files, and the debugger, through `quillo lsp` and `quillo dap`.
