# Quillo for Zed

A [Zed](https://zed.dev) extension for Quillo's `.qwe` files:

- **Highlighting, the outline, brackets, indentation** and CSS and SQL inside strings, from
  [tree-sitter-quillo](../tree-sitter) (the queries are made from that folder's by
  `tree-sitter/scripts/queries.js`: change them there).
- **Diagnostics, quick fixes, completion, hover, go to definition, rename and signature help**
  from `quillo lsp`, the language server built into the `quillo` binary.
- **A debugger**, `Quillo`, through `quillo dap`: breakpoints, stepping, the stack, variables.
  Its configuration is VS Code's (`program`, `args`, `cwd`, `stopOnEntry`).

`quillo` must be on your `PATH` ([releases](https://github.com/quillolang/quillo/releases/latest)),
or named in Zed's settings:

```json
{
  "lsp": {
    "quillo": { "binary": { "path": "/path/to/quillo" } }
  }
}
```

To debug, add a `.zed/debug.json` to the project (or use the New Process modal):

```json
[
  {
    "label": "Quillo: main.qwe",
    "adapter": "Quillo",
    "request": "launch",
    "program": "$ZED_WORKTREE_ROOT/main.qwe",
    "args": ["--watch"]
  }
]
```

A `.qwer` file is Rust: `"file_types": { "Rust": ["qwer"] }` in Zed's settings gives it Zed's
Rust support. What quillo says about a `.qwer` or `.rs` file (which `pub fn`s it can export) is
in VS Code, the JetBrains IDEs and Neovim for now: Zed starts a language server for every file of
a language, and most `.rs` files are a crate's, not a program's.

## Install

Until it is in Zed's extension registry: **zed: install dev extension** (from the command
palette) and choose this `zed/` folder. Zed builds the extension (it needs Rust, from
[rustup](https://rustup.rs)) and fetches the grammar at the commit `extension.toml` names.

## Tests

```sh
cargo test                                      # the extension's decisions, and its manifest
cargo build --release --target wasm32-wasip1    # what Zed builds
```

The tests check that the grammar's commit in `extension.toml` holds `tree-sitter/src/parser.c`,
that the language, grammar, server and debugger names agree, and that every file named is there.
`npm test` in `../tree-sitter` compiles these queries against the grammar.

To put a later grammar in: commit it, then set `rev` in `extension.toml` to that commit (the
full hash) and push it, as Zed fetches the grammar from GitHub.

## Publishing

Zed's registry is [zed-industries/extensions](https://github.com/zed-industries/extensions): a
pull request there adds this repository as a submodule with `path = "zed"` in its
`extensions.toml`, and the version in `extension.toml`.
