# Quillo editor support

Editor support for [Quillo](https://github.com/quillolang/quillo). Everything talks to
`quillo lsp` (the language server) and `quillo dap` (the debugger), both built into the
`quillo` binary, so each editor needs `quillo` installed
(see [Getting started](https://github.com/quillolang/quillo#getting-started)) or its path in
that editor's settings.

| Editor | Folder | Highlighting | Language server | Debugger | Also | Tested |
|---|---|---|---|---|---|---|
| **VS Code** | [`vscode/`](vscode) | TextMate grammar, CSS and SQL in strings | yes | yes, and the browser side | snippets, end tags as you type, Run/Check/New program | in VS Code's TextMate engine; the extension's commands against `quillo` |
| **Cursor, Windsurf, VSCodium, Gitpod** | [`vscode/`](vscode) | the same | yes | yes | the same | as VS Code: they install from [Open VSX](#vs-code-forks) |
| **IntelliJ IDEA, WebStorm, PyCharm and the other JetBrains IDEs** (2025.3 on) | [`jetbrains/`](jetbrains) | VS Code's grammar | yes, through LSP4IJ | yes (no hit counts or logpoints) | live templates, end tags, run configurations, New Quillo Program | in the IDE platform, 54 tests; the Plugin Verifier |
| **Android Studio** (Rabbit 2, 2026.2.2, and on) | [`jetbrains/`](jetbrains) | the same | yes | yes | the same | [the Plugin Verifier](#android-studio) |
| **Zed** | [`zed/`](zed) | tree-sitter | yes | yes | outline, brackets | the extension's Rust tests; built for wasm32-wasip1 |
| **Neovim** | [`neovim/`](neovim) | tree-sitter (nvim-treesitter or a built parser) | yes, `vim.lsp.config` or nvim-lspconfig | yes, nvim-dap | folds, indents | in LuaJIT against a stand-in for Neovim's API |
| **Helix** | [`helix/`](helix) | tree-sitter | yes | yes | textobjects, indents | `languages.toml` and every capture against what Helix reads |
| **Emacs** (29 on) | [`emacs/`](emacs) | tree-sitter, or regular expressions without it | yes, eglot | yes, dape | imenu, defuns, indentation | its queries against the grammar; read as Lisp |
| **Sublime Text 4** | [`sublime/`](sublime) | VS Code's grammar | yes, with the LSP package | no | build system (run, check) | the grammars rule for rule; the settings; the error pattern on `quillo check` |
| **Vim** (no LSP needed) | [`vim/`](vim) | a syntax file | [any Vim LSP client](vim/README.md#a-language-server-too) | no | `:make` runs `quillo check`, indentation | in Vim 9 |
| **Visual Studio** (Windows) | none | [VS Code's grammar](#visual-studio) | not yet | no | | instructions only |
| **Eclipse** | none | [VS Code's grammar, through TM4E](#eclipse) | yes, through LSP4E | yes, LSP4E's debug adapter launcher | | instructions only |

Neovim, Helix, Emacs, Sublime Text, Zed, Eclipse and Visual Studio have not been run on the
machine these were made on: their tests stand in for each editor where it cannot be run.

Built on the same grammars:

| | Folder | For |
|---|---|---|
| **tree-sitter-quillo** | [`tree-sitter/`](tree-sitter) | Zed, Neovim, Helix and Emacs: the grammar, its scanner and queries; 2,800 `.qwe` files parse with no error |
| **Shiki, highlight.js, Prism** | [`highlighters/`](highlighters) | documentation sites |
| **KDE's syntax files** | [`highlighters/kde/`](highlighters/kde) | Kate, and pandoc for the book |
| **GitHub** | [`highlighters/LINGUIST.md`](highlighters/LINGUIST.md) | later: Linguist adds a language once about 200 repositories use it |

The TextMate grammar lives in [`vscode/syntaxes`](vscode/syntaxes) and the tree-sitter queries
in [`tree-sitter/queries`](tree-sitter/queries); each other folder's copy is made from those by
a script, and its tests fail when the copy is out of date.

## VS Code forks

Cursor, Windsurf, VSCodium and Gitpod install extensions from [Open VSX](https://open-vsx.org).
A tag `vscode-v<version>` runs [`release.yml`](.github/workflows/release.yml), which publishes
the extension there (with the `OVSX_PAT` secret) as well as to the Visual Studio Marketplace.
Until a version is on Open VSX, install the `.vsix` from the
[releases](https://github.com/quillolang/editors/releases) with *Extensions: Install from
VSIX...*.

## Android Studio

Android Studio is built on the JetBrains platform, a release or two behind it: Rabbit 2
(2026.2.2) is build 262, past the plugin's 253 (2025.3). On 2026-11-02 the JetBrains plugin,
built against 2025.3, passed the Plugin Verifier against Android Studio Rabbit 2
(AI-262.10968.63): *Compatible*, with LSP4IJ 0.21.0 and the TextMate plugin found for it.
Android Studio releases before 2025.3 (Otter and earlier) cannot install it.

## Visual Studio

Visual Studio (Windows) highlights a language from a TextMate grammar in a folder of its own:

1. Make `%USERPROFILE%\.vs\Extensions\Quillo\Syntaxes\` and copy
   [`vscode/syntaxes/quillo.tmLanguage.json`](vscode/syntaxes/quillo.tmLanguage.json) into it.
2. Restart Visual Studio, and open a `.qwe` file.

A language server in Visual Studio needs an extension (a VSIX using its LanguageServer client
API), which there is not yet. VS Code, on Windows too, has all of it.

## Eclipse

The Eclipse IDE comes with TM4E (TextMate grammars) and LSP4E (language servers and debug
adapters):

1. *Window > Preferences > General > Content Types*: select *Text*, *Add Child...*, name it
   `Quillo`, and add `*.qwe` to its file associations.
2. *Preferences > TextMate > Grammar > Add...*: choose
   [`vscode/syntaxes/quillo.tmLanguage.json`](vscode/syntaxes/quillo.tmLanguage.json), and bind
   it to the *Quillo* content type.
3. *Run > External Tools > External Tools Configurations...*: a new *Program* named
   `quillo lsp`, with *Location* the quillo binary and *Arguments* `lsp`.
4. *Preferences > Language Servers > Add...*: the *Quillo* content type, and the `quillo lsp`
   launch configuration.
5. Open `.qwe` files with the *Generic Text Editor* (*Open With*, or make it the default for
   the content type).

To debug: *Run > Debug Configurations... > Debug Adapter Launcher*, command `quillo` with the
argument `dap`, and as launch parameters `{ "program": "${resource_loc}", "args": ["--watch"] }`.

## Building

```sh
cd vscode && npm ci && npm test && npx vsce package   # quillo-lang-<version>.vsix
cd jetbrains && ./gradlew buildPlugin                 # build/distributions/quillo-jetbrains-<version>.zip
cd zed && cargo build --release --target wasm32-wasip1
cd tree-sitter && npm ci && npm test
```

Each folder's README says how to install and test it. CI runs every folder's tests.

## License

MIT
