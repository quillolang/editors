# Quillo for VS Code

Language support for [Quillo](https://github.com/quillolang/quillo), the small web language.

- **Highlighting** for `private` and `public` before a definition, routes and paths, HTML literals (tags, `.class#id`, `@event`, `bind:value`),
  string interpolation, `state` declarations, `type` records, numbers such as `1e-9`, types,
  effects and pipelines. SQL is highlighted as SQL in the string (or template) passed to
  `db.exec`, `db.one` and `db.query`, and in `` sql`...` ``.
- **Diagnostics as you type**: unknown names, wrong arguments, type mismatches, effects,
  component props, code that cannot run in the browser, unused variables.
- **End tags**: an element that is never closed is underlined at its start tag, with a quick fix
  (Ctrl+. / Cmd+.) that adds the end tag where it belongs; a mistyped end tag (`</dvi>`) has one
  that corrects it. Typing a start tag's `>` adds its end tag after the cursor, and typing `</`
  finishes the end tag of the element open there (setting `quillo.autoCloseTags`).
- **Hover** shows types and signatures; **Go to Definition** works across `use`d files.
- **Classes**: from a class in markup (`<span.chip>`, `class="chip"`), Go to Definition goes
  to its CSS rules (in `css(...)`, a component's `style`, or the CSS files under `public/`)
  and hover shows them. **Find All References** lists its rules and every place the markup
  writes it, from either side, and **Rename Symbol** (F2) renames it in both (a class put
  together, as in `card-${size}`, is left as it is). A class no sheet has a rule for is
  marked: a warning when it is close to one that has (`.chiip`: did you mean `chip`?), else
  a faint hint.
- **Completion** for your functions and variables, builtins (with signatures), the members of
  `db.`, `http.`, `json.`, `udp.`, `channel.`, `media.`, `crypto.`, `image.`, `math.`, `stats.`,
  `vec.` and `date.`, keywords, types, HTTP methods and effects (`net` among them); after `<`
  in markup, your views and components and HTML's elements; after `</`, the end tag to write;
  after `<span.` and in `class="`, the classes your style sheets define.
- **Outline** of functions, views, components, variables and routes.
- **Private names**: hover and the outline say `private fn page_of(...)`; another file's private
  names are not offered in completion (nor its private views after `<`).
- **Snippets**: `route`, `routejson`, `fn`, `fnb`, `pfn` (private fn), `server fn`, `view`, `component`, `match`, `for`, `page`,
  and for real time: `udplisten`, `channelon`, `channelopen`, `mediartp`, `quillo-media`.
- **File icons**: a quill for `.qwe` files, and a quill with a gear for `.qwer` files, in the
  default (Seti) icon theme and any other that has none of its own for them.
- **Rust in `.qwer` files**: highlighted as Rust, with the `//! [dependencies]` header as TOML;
  the Rust compiler's errors and warnings as you open and save (through `cargo check`);
  a warning on each `pub fn` Quillo cannot export, saying why; hover shows how Quillo sees an
  export, and the outline lists them. Their functions are checked, completed and hovered in
  the `.qwe` files that `use` them.
- **`use` lines**: paths with or without quotes, the names taken from a `.qwer` file, `as`
  and `*` are highlighted. Go to Definition on the path opens the file, and on a name goes to
  its Rust function, whose signature hover shows (under the name after `as`). The path
  completes to the program's files, and before `from` the names complete to the file's
  functions.
- **Debugging** (F5 in a `.qwe` file): breakpoints (with conditions, hit counts and logpoints),
  stepping, the stack, variables (locals, globals and the request), the debug console, and
  stopping where a runtime error happens. Through `quillo dap`; see Debugging in the user guide.
  With `"browser": true` in the launch configuration, the page opens in Chrome (`"edge"`: Edge)
  with VS Code's JavaScript debugger too, and the same breakpoints stop in the components'
  browser code (event handlers, updates), through source maps to the `.qwe` files.
- **Commands**: *Quillo: Run this file (watch mode)* (also the ▶ button), *Quillo: Debug this file*,
  *Quillo: Check this file*, *Quillo: Restart the language server*.

The editor features come from `quillo lsp`, the language server built into the `quillo` binary,
and the debugger from `quillo dap`.
The extension looks for the binary in the `quillo.path` setting, then in `target/release` or
`target/debug` of the open workspace, then on your `PATH`.

## Install

1. Install the extension: search for **Quillo** in the Extensions view (from the
   [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=quillolang.quillo-lang),
   or [Open VSX](https://open-vsx.org/extension/quillolang/quillo-lang) in VSCodium, Cursor and
   other editors built on VS Code).
2. Install `quillo`, which the extension runs: download it for your system from the
   [releases](https://github.com/quillolang/quillo/releases/latest) and put it on your `PATH`
   (or point the `quillo.path` setting at it), or build it with Cargo:

   ```sh
   cargo install --git https://github.com/quillolang/quillo quillo
   ```

To build the extension from this repository instead:

```sh
git clone https://github.com/quillolang/editors.git quillo-editors
cd quillo-editors/vscode
npm install
npm run package                   # builds quillo-lang-<version>.vsix
code --install-extension quillo-lang-*.vsix
```

## Other editors

Any editor with LSP support can run `quillo lsp` over stdio for `*.qwe` files. For example, Neovim:

```lua
vim.filetype.add({ extension = { qwe = "quillo" } })
vim.api.nvim_create_autocmd("FileType", {
  pattern = "quillo",
  callback = function() vim.lsp.start({ name = "quillo", cmd = { "quillo", "lsp" } }) end,
})
```

Helix (`languages.toml`):

```toml
[language-server.quillo]
command = "quillo"
args = ["lsp"]

[[language]]
name = "quillo"
scope = "source.quillo"
file-types = ["qwe"]
comment-token = "//"
language-servers = ["quillo"]
```

For debugging, any editor with a Debug Adapter Protocol client can run `quillo dap` (a launch
takes `program`, `args`, `cwd` and `stopOnEntry`). Neovim, with nvim-dap:

```lua
local dap = require("dap")
dap.adapters.quillo = { type = "executable", command = "quillo", args = { "dap" } }
dap.configurations.quillo = {
  { type = "quillo", request = "launch", name = "Debug this file", program = "${file}", args = { "--watch" } },
}
```

## Development

`npm test` checks the grammar against sample lines and the example programs.
