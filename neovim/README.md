# Quillo for Neovim

- **Filetypes**: `.qwe` is `quillo`, `.qwer` is `qwer` (Rust, highlighted with Rust's parser or
  Vim's Rust syntax), and a script whose first line runs quillo (`#!/usr/bin/env quillo`) is `quillo`.
- **Highlighting, folds, indentation** and CSS, SQL and JavaScript inside strings, from
  [tree-sitter-quillo](../tree-sitter), with its queries in [`queries/quillo`](queries/quillo)
  (made from `../tree-sitter/queries` by `tree-sitter/scripts/queries.js`: change them there).
- **`quillo lsp`** for `.qwe` and `.qwer` files, and for the `.rs` files a program uses
  (`import tw.rs use f`; a crate's own, which no `.qwe` file names, are left to rust-analyzer): diagnostics, quick fixes, completion, hover, go
  to definition, references, rename, signature help, document symbols.
- **`quillo dap`** for [nvim-dap](https://github.com/mfussenegger/nvim-dap): breakpoints,
  stepping, the stack, variables.

## Install

With [lazy.nvim](https://github.com/folke/lazy.nvim):

```lua
{
  "quillolang/editors",
  -- the plugin is the repository's neovim/ folder
  config = function(plugin)
    vim.opt.rtp:append(plugin.dir .. "/neovim")
    require("quillo").setup()
  end,
}
```

Or clone the repository and put `neovim/` on the runtime path:

```lua
vim.opt.rtp:append("~/src/quillolang-editors/neovim")
require("quillo").setup()
```

`setup()` takes `cmd` (the quillo binary; else `target/release/quillo` or `target/debug/quillo`
in the folder Neovim runs in, then `quillo` on the `PATH`), `lsp = false` and `dap = false`.

### The parser

With [nvim-treesitter](https://github.com/nvim-treesitter/nvim-treesitter) (its `master` or
`main` branch), `setup()` registers the parser: then `:TSInstall quillo`.

Without it, build the parser and put it where Neovim looks:

```sh
cd tree-sitter
npx tree-sitter build -o ~/.local/share/nvim/site/parser/quillo.so
```

### The language server

On Neovim 0.11 and later, `setup()` calls `vim.lsp.config("quillo", ...)` and
`vim.lsp.enable("quillo")`; the plugin's `lsp/quillo.lua` is the same configuration, for
`vim.lsp.enable("quillo")` alone. Before 0.11 it uses
[nvim-lspconfig](https://github.com/neovim/nvim-lspconfig) when that is installed.

### The debugger

With nvim-dap installed, `setup()` adds the `quillo` adapter and a configuration, *Run this
file (quillo dap)*, which runs the open file with `--watch`. Your own
`dap.configurations.quillo` stays as it is. The fields are VS Code's: `program`, `args`, `cwd`,
`stopOnEntry`.

## Tests

```sh
luajit test/run.lua
```

runs the plugin's Lua against a stand-in for Neovim's API, on Neovim 0.11 and before, with each
branch of nvim-treesitter and with nvim-dap or without, and the filetype rules on first lines.
`npm test` in `../tree-sitter` compiles the queries against the grammar.

Not yet run in Neovim itself: the tests stand in for its API.
