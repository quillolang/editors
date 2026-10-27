# Quillo editor support

Editor extensions for [Quillo](https://github.com/quillolang/quillo).

| Editor | What it gives |
|---|---|
| [`vscode/`](vscode) | VS Code: highlighting for `.qwe` and `.qwer`, diagnostics as you type, hover, go to definition, completion, outline, snippets, and a debugger |

The extension talks to `quillo lsp` and `quillo dap`, so it needs `quillo` installed
(see [Getting started](https://github.com/quillolang/quillo#getting-started)) or the
`quillo.path` setting. Other editors can run `quillo lsp` and `quillo dap` directly.

## Building the VS Code extension

```sh
cd vscode
npm ci && npm test
npx vsce package --skip-license      # quillo-lang-<version>.vsix
code --install-extension quillo-lang-*.vsix
```

## License

MIT
