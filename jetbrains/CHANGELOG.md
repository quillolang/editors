# Changelog

## 0.1.0

- First version, for IDEs from 2025.3 on: highlighting, snippets, comments and brackets from
  the VS Code extension's grammars and language configurations; diagnostics, quick fixes,
  completion, parameter info, go to declaration, find usages, rename and the structure view from
  `quillo lsp`, through LSP4IJ; end tags closed as you type; run configurations, and a debugger
  through `quillo dap`.
- `import lib/a.qwe use b`, `client`, `preload` and `preconnect` lines highlighted and completed
  file first, the file and then its names, with snippets for each. Needs a `quillo` that knows
  `import`.
- Snippets are live templates, made from VS Code's as the plugin is built: the IDE's TextMate
  support inserted them as written, `${1:name}` and all. Tab goes from one place to fill to the
  next, and they are offered in `.qwe` files only.
- *New Quillo Program*, in Tools > Quillo and on the welcome screen: the to-do app or a minimal
  one, made by `quillo new` and opened as a project. Needs a `quillo` that has `new`; an older one
  is told to update.
- `site shop = "https://..."`, a script's `#!` line, the newer builtins (`run_after`,
  `local_path`, `stdin`, `exit` and others) and the `bit.` and `later.` modules highlighted, and
  the `site` and `tool` snippets, all from the VS Code extension 0.14.0.
- A `.rs` file a program uses goes to quillo lsp as a `.qwer` file does; a crate's own, which no
  `.qwe` file names, does not (looked for as quillo finds a file's program: the `.qwe` files in
  its folder and three above, followed through what they use).
- `build`, `accept_calls`, `<!-- comments -->`, `<!DOCTYPE html>`, unquoted attribute values and
  the new builtins highlighted, from the VS Code extension 0.15.0.
- Tools for AI clients: the `mcp` of `fn mcp name()`, `server fn mcp` and `service mcp`
  highlighted, `/* ... */` comments as comments (they were code), the builtins `confirm`,
  `mcp_token`, `mcp_tokens` and `revoke_mcp_token`, and the live templates `fnmcp`,
  `serverfnmcp`, `servicemcp`, `confirm`, `ask` and `instructions`, from the VS Code extension
  0.17.0.
