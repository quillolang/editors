# Quillo for JetBrains IDEs

Language support for [Quillo](https://github.com/quillolang/quillo), the small web language, in
IntelliJ IDEA, WebStorm, PyCharm, GoLand, RustRover and the other JetBrains IDEs, from 2025.3 on,
and Android Studio from Rabbit 2 (2026.2.2, build 262), which passes the Plugin Verifier.

- **Highlighting** for `.qwe` and `.qwer` files, with the same grammars as the VS Code extension:
  routes and paths, `import` lines (`./` and `../` too), `site shop = "..."`, a script's `#!` line,
  HTML literals, string interpolation, types, effects, SQL in `db.exec`,
  `db.one`, `db.query` and `` sql`...` ``, Rust in `.qwer` files. **File icons** for both.
- **Diagnostics as you type**: unknown names, wrong arguments, type mismatches, effects, component
  props, code that cannot run in the browser, unused variables; in `.qwer` files the Rust
  compiler's errors, through `cargo check`, and each `pub fn` Quillo cannot export; the same for a
  `.rs` file a program uses (a crate's own `.rs` files, which no `.qwe` file names, are not sent).
- **End tags**: an element that is never closed is underlined, with a quick fix (Alt+Enter) that
  adds its end tag. Typing a start tag's `>` adds its end tag after the cursor, typing `</`
  finishes the end tag of the element open there, and Enter between the two tags puts the end
  tag on a line of its own.
- **Quick documentation** shows types and signatures; **Go to Declaration** works across `use`d
  files, and from a class in markup to its CSS rules. **Find Usages** lists a class's rules and
  every place the markup writes it, and **Rename** renames it in both.
- **Completion** for your functions and variables, builtins, the members of `db.`, `http.`,
  `json.` and the rest, keywords and types; after `<` your views and components and HTML's
  elements; after `<span.` and in `class="` the classes your style sheets define. On an `import`
  line the file comes first, then the names that file gives as you type them.
- **Parameter Info** (Ctrl+P, Cmd+P on macOS): the function's parameters, with the current one marked.
- **Structure** view of functions, views, components, variables and routes.
- **Live templates**: `import`, `client`, `preload`, `site`, `tool`, `route`, `routejson`, `fn`, `fnb`,
  `pfn`, `serverfn`, `view`, `component`, `match`, `for`, `page` and the real-time ones, made from
  VS Code's snippets as the plugin is built. Type the name and press Tab; Tab goes from one place
  to fill to the next. They are under **Settings > Editor > Live Templates > Quillo**.
- **Run and debug**: Run or Debug from a `.qwe` file's context menu makes a *Quillo* run
  configuration for it. Run is `quillo run`; Debug is `quillo dap`, with breakpoints and
  conditions, stepping, the stack, variables, and the expressions you evaluate.
- **Tools > Quillo**: *Check This File*, *Restart the Language Server* and *New Quillo Program*,
  which is on the welcome screen too: the to-do app or a minimal one, made by `quillo new` in a
  folder you choose and opened as a project (needs a `quillo` that has `new`). The server
  restarts by itself when the binary is rebuilt.

The editor features come from `quillo lsp`, the language server built into the `quillo` binary, and
the debugger from `quillo dap`. The plugin looks for the binary in **Settings > Languages &
Frameworks > Quillo**, then in `target/release` or `target/debug` of the project, then on your `PATH`.

## What VS Code has and this does not

- **Hit counts and logpoints.** `quillo dap` has them, but LSP4IJ, which this plugin's debugger is
  built on, sends breakpoint conditions only.
- **Debugging the browser side.** `"browser": true` is VS Code's own debugger. Open the page in
  a browser and use its developer tools: see *In the browser* under Debugging in the user guide.
- **The debugger on Windows**, which `quillo dap` does not support yet, in any editor.
- **`#!` on the first line only.** The IDE's lexer reads the grammar's `\A` as each line's start, so a
  `#!` line further down is coloured as a comment too. `quillo check` refuses such a line anyway.

## Install

1. Install [LSP4IJ](https://plugins.jetbrains.com/plugin/23257-lsp4ij), which the plugin needs, from
   **Settings > Plugins > Marketplace**.
2. Build the plugin (below), then **Settings > Plugins > ⚙ > Install Plugin from Disk** and
   choose the `.zip`.
3. Install `quillo`: download it for your system from the
   [releases](https://github.com/quillolang/quillo/releases/latest) and put it on your `PATH`, or
   build it with Cargo:

   ```sh
   cargo install --git https://github.com/quillolang/quillo quillo
   ```

Class hover, references and rename from a CSS file under `public/` need a `quillo` newer than 0.6.0.

## Building

The build needs a JDK 21 or later. The first one downloads an IDE to build against (about 1 GB, and
3.5 GB once extracted), unless you point it at one you have:

```sh
cd jetbrains
./gradlew buildPlugin                                    # build/distributions/quillo-jetbrains-<version>.zip
./gradlew buildPlugin -PlocalIde=/Applications/WebStorm.app
```

## How it is built

The grammars, language configurations and snippets are not copied into this folder: the build takes
them from [`../vscode`](../vscode), and puts the grammars and language configurations in the plugin as a
TextMate bundle, which the IDE reads as it reads a VS Code extension. Change them there. `.qwe` and `.qwer` stay TextMate files, the case
[LSP4IJ](https://github.com/redhat-developer/lsp4ij) supports best, in every IDE, paid or free.

The snippets go another way: the IDE's TextMate support would insert a snippet as it is written,
`${1:name}` and all. So the build turns `../vscode/snippets/quillo.json` into live templates
(`liveTemplates/Quillo.xml`, offered in `.qwe` files) and gives the bundle a `package.json` with no
`snippets`. `testEverySnippetExpands` expands each one and compares it with its VS Code body.

The IDE's regular expressions are stricter than VS Code's (no `\s{0,8}` in a look-behind), and it
drops a rule it cannot read without saying so: `testEveryRuleOfTheGrammarsCompiles` is there for that.

## Tests

```sh
QUILLO_BIN=/path/to/quillo ./gradlew test                # the real server, debugger and run, in the IDE
./gradlew test                                           # without QUILLO_BIN, only what needs no quillo
./gradlew verifyPlugin                                   # the Plugin Verifier, on both ends of the range
```

`QUILLO_OLD_BIN` names a `quillo` from before `experimental.cssClasses` (0.6.0) for the test that
what it says about CSS files is ignored.
