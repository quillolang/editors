# Quillo editor support

Editor extensions for [Quillo](https://github.com/quillolang/quillo).

| Editor | What it gives |
|---|---|
| [`vscode/`](vscode) | VS Code: highlighting for `.qwe` and `.qwer`, diagnostics as you type, hover, go to definition, completion, outline, snippets, and a debugger |
| [`jetbrains/`](jetbrains) | IntelliJ IDEA, WebStorm and the other JetBrains IDEs, from 2025.3 on: the same, with the same grammars, through [LSP4IJ](https://github.com/redhat-developer/lsp4ij) |

Both talk to `quillo lsp` and `quillo dap`, so they need `quillo` installed
(see [Getting started](https://github.com/quillolang/quillo#getting-started)) or its path in
their settings. Other editors can run `quillo lsp` and `quillo dap` directly.

## Building the VS Code extension

```sh
cd vscode
npm ci && npm test
npx vsce package --skip-license      # quillo-lang-<version>.vsix
code --install-extension quillo-lang-*.vsix
```

## Building the JetBrains plugin

```sh
cd jetbrains
./gradlew buildPlugin                # build/distributions/quillo-jetbrains-<version>.zip
```

See [`jetbrains/README.md`](jetbrains/README.md) to install it and for the tests.

## License

MIT
