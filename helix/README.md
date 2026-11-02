# Quillo for Helix

[`languages.toml`](languages.toml) and [`queries/`](queries) give [Helix](https://helix-editor.com)
Quillo's `.qwe` files (and `.qwer` files, as Rust):

- **Highlighting, indentation, textobjects** (`mif`/`maf` a function or route, `mac` a
  component, `mia` an argument, `mix` an element) and CSS, SQL and JavaScript inside strings,
  from [tree-sitter-quillo](../tree-sitter).
- **`quillo lsp`**: diagnostics, completion, hover, go to definition, references, rename,
  signature help, symbols.
- **`quillo dap`**: `:debug-start run main.qwe`, breakpoints (`:debug-toggle-breakpoint` or
  `<space>Gb`), stepping and variables.

## Install

1. Add [`languages.toml`](languages.toml) to `~/.config/helix/languages.toml` (or to a
   project's `.helix/languages.toml`).
2. Copy the queries: `cp -r queries/quillo queries/qwer ~/.config/helix/runtime/queries/`.
3. Fetch and build the grammar: `hx --grammar fetch && hx --grammar build`.
4. Check: `hx --health quillo`.

A `.rs` file a program uses is Rust to Helix, with rust-analyzer: Helix starts a language server
for every file of a language, and most `.rs` files are a crate's. VS Code, the JetBrains IDEs and
Neovim give quillo's word on such a file too.

`quillo` must be on your `PATH` ([releases](https://github.com/quillolang/quillo/releases/latest)).

The highlight, injection, locals and indent queries are made from `../tree-sitter/queries` by
`tree-sitter/scripts/queries.js`, in Helix's scope names and with the patterns turned around
(Helix takes the first that matches): change them there. `textobjects.scm` is written here.

## Upstream

The shape is Helix's own: to put Quillo into Helix, the `[[language]]` and `[[grammar]]`
entries go into Helix's `languages.toml`, `queries/quillo` into `runtime/queries/`, and a line
into `book/src/generated/lang-support.md` (`cargo xtask docgen` writes it).

## Tests

```sh
npm ci && npm test
```

checks that `languages.toml` parses, that the grammar's commit holds `tree-sitter/src/parser.c`,
that every server, grammar and query file named is there, that each debugger template fills
what it asks for, and that every capture is a scope, textobject or indent capture Helix knows.
`npm test` in `../tree-sitter` compiles the queries against the grammar.

Not yet run in Helix itself (`hx --health quillo` is the check to run there).
