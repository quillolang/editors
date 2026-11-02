# Quillo for Emacs

[`quillo-mode.el`](quillo-mode.el) gives Emacs Quillo's `.qwe` files:

- **`quillo-ts-mode`**, on [tree-sitter-quillo](../tree-sitter) (Emacs 29 and later):
  highlighting by features (`treesit-font-lock-level`), indentation, `beginning-of-defun` and
  `end-of-defun` over functions, components, types and routes, and imenu.
- **`quillo-mode`**, on regular expressions and the brackets' depth, where the grammar cannot
  run. A `.qwe` file opens in whichever can; so does a script whose first line runs quillo.
  A `.qwer` file is Rust, and opens in `rust-ts-mode` or `rust-mode`.
- **eglot** runs `quillo lsp` for both modes: diagnostics, completion, hover, go to definition,
  references, rename, signature help.
- **dape** gets a `quillo` configuration for `quillo dap`: `M-x dape RET quillo`, with the
  program the current buffer's file, run with `--watch`.

## Install

```elisp
(add-to-list 'load-path "~/src/quillolang-editors/emacs")
(require 'quillo-mode)
```

or, with `use-package`:

```elisp
(use-package quillo-mode
  :load-path "~/src/quillolang-editors/emacs"
  :mode ("\\.qwe\\'" . quillo-best-mode))
```

Then, once: `M-x quillo-install-grammar`, which builds tree-sitter-quillo from `tree-sitter/src`
of this repository (it needs a C compiler) and puts it where Emacs looks. `M-x eglot` in a
`.qwe` buffer starts the language server. `quillo` must be on the `PATH`, or
`quillo-program` set to it.

## Tests

```sh
python3 test/check.py
```

reads `quillo-mode.el` as Lisp (balanced brackets, strings and character literals closed),
compiles each font-lock feature's query against tree-sitter-quillo (with the keyword list and
the `:match` predicates as Emacs builds them; it needs `npm ci` in `../tree-sitter`), checks the
node types and fields the indent rules, defuns and imenu name, that every face is one Emacs 29
has, and that the builtin and module lists are the VS Code grammar's.

Not yet run in Emacs itself.
