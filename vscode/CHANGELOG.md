# Changelog

## 0.15.0

- A `.rs` file a program uses (`import tw.rs use tailwind`, `use "tw.rs"`) goes to quillo lsp, as
  a `.qwer` file does: what quillo can export, and the Rust compiler's errors. A crate's own `.rs`
  files, which no `.qwe` file names, stay rust-analyzer's alone: the extension looks for the
  program as quillo does, in the file's folder and up to three above, not past a `Cargo.toml`.
- Highlighted: `build "/app.css" = ...`, `accept_calls { ... }`, `<!-- comments -->` in markup,
  `<!DOCTYPE html>`, and attribute values in single quotes or none (`<img src=a.png/>`).
- The new builtins: `files`, `markdown_page`, `classes`, `accept_calls`.

## 0.14.0

- *Quillo: New program*: the to-do app or a minimal one, in a new folder, with `quillo new`, and
  the folder opened (in a new window when one is open). Needs a `quillo` that has `new`; an older
  one is told to update.
- `site shop = "https://..."` highlighted, `site` staying a name elsewhere, and a script's `#!`
  line on the first line only.
- The newer builtins highlighted: `run_after`, `page_updated`, `js_has`, `cursor_index`,
  `local_path`, `site_headers`, `normalize`, `stdin`, `read_line`, `exit`, `args`, `platform`,
  `filled`, `error`, `cookie`, `new_tenant` and more, and the `bit.` and `later.` modules.
- Snippets: `site`, and `tool`, a script that reads its input a line at a time.

## 0.13.0

- The file first: `import lib/a.qwe use b`, `client /assets/l.js use L`, `preload` and
  `preconnect` highlighted, with `module`, and a long address that leaves its `use` to the next
  line. The words stay names elsewhere: `client = 1` and `client / 2` are plain code.
- Names complete as you type them, since the file is already on the line, and the file
  completes first: `.qwe` and `.qwer` after `import`, `.js` and `.mjs` after `client`, what
  `public/` holds from the site's root. Needs a `quillo` that knows `import`.
- Snippets: `import`, `client`, `preload`.

## 0.12.0

- Parameter hints: inside a call, the function's parameters, the current one marked, and a
  line about what it does, as you type `(` and `,` and with Ctrl+Space, which also opens the
  completions. Needs a `quillo` built with `textDocument/signatureHelp`.
- Completion and hover explain builtins in a line.
- `use Chart with preload from "..."` and `with preconnect` highlighted.

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
