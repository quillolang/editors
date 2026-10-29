# Changelog

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
