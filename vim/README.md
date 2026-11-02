# Quillo for Vim

A plain Vim package for Quillo, with no language server needed:

- **Filetypes**: `.qwe` is `quillo`, `.qwer` is `rust`, and a script whose first line runs
  quillo (`#!/usr/bin/env quillo`) is `quillo`.
- **Highlighting**: comments, strings and templates with `${...}`, numbers (`12.50m`), keywords
  (the words that only start their own statement, `client`, `type`, `site`, `state`, are names
  elsewhere), imports and their paths, routes with their method and path, definitions, types,
  effects, builtins and modules, and markup with its tags, attributes and `@events`.
- **Indentation** by brackets, a trailing `=` and open tags.
- **`:make`** runs `quillo check %` and puts its errors in the quickfix list; `gf` follows an
  `import` or `use` path.

## Install

```sh
mkdir -p ~/.vim/pack/quillo/start
ln -s "$PWD" ~/.vim/pack/quillo/start/quillo
```

or with a plugin manager, pointing it at this repository's `vim/` folder (vim-plug:
`Plug 'quillolang/editors', { 'rtp': 'vim' }`).

## A language server too

`quillo lsp` gives diagnostics, completion, hover, go to definition, references and rename to
any Vim LSP client:

Vim 9's [yegappan/lsp](https://github.com/yegappan/lsp):

```vim
call LspAddServer([#{ name: 'quillo', filetype: ['quillo'], path: 'quillo', args: ['lsp'] }])
```

[vim-lsp](https://github.com/prabirshrestha/vim-lsp):

```vim
autocmd User lsp_setup call lsp#register_server({
    \ 'name': 'quillo',
    \ 'cmd': ['quillo', 'lsp'],
    \ 'allowlist': ['quillo'],
    \ })
```

[coc.nvim](https://github.com/neoclide/coc.nvim), in `:CocConfig`:

```json
{
  "languageserver": {
    "quillo": { "command": "quillo", "args": ["lsp"], "filetypes": ["quillo"], "rootPatterns": ["main.qwe", ".git"] }
  }
}
```

[ALE](https://github.com/dense-analysis/ale):

```vim
call ale#linter#Define('quillo', { 'name': 'quillo', 'lsp': 'stdio',
    \ 'executable': 'quillo', 'command': '%e lsp',
    \ 'project_root': {b -> fnamemodify(ale#path#FindNearestFile(b, 'main.qwe'), ':h')} })
```

For tree-sitter highlighting and nvim-dap, Neovim has [its own plugin](../neovim).

## Tests

```sh
vim -Nu NONE -i NONE -es -S test/run.vim
```

runs in Vim: the filetype of `.qwe`, `.qwer` and scripts by their first line; the syntax group
under each kind of word in [`test/sample.qwe`](test/sample.qwe); the indent of every line of
[`test/indent.qwe`](test/indent.qwe); that the error format reads what `quillo check` prints
(run for real with `QUILLO_BIN` set); and that the builtins are the VS Code grammar's.
