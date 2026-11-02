# Quillo for Sublime Text

A Sublime Text 4 package for Quillo's `.qwe` files and `.qwer` files:

- **Highlighting** with the VS Code extension's TextMate grammars, rule for rule (`build.py` turns
  `../vscode/syntaxes/*.json` into the `.tmLanguage` plists Sublime reads: change them there,
  then run it). SQL and CSS inside strings use Sublime's own SQL and CSS; `.qwer` files are Rust.
  A script whose first line runs quillo is Quillo too.
- **Comments** (`Ctrl+/`) and **indentation**, from VS Code's `language-configuration.json`.
- **`quillo lsp`** through the [LSP](https://packagecontrol.io/packages/LSP) package:
  diagnostics, completion, hover, go to definition, references, rename, signature help.
- **A build system**: *Quillo* runs the file with `quillo run --watch`; *Quillo - Check* runs
  `quillo check`; errors are linked to their lines (F4 goes to the next).

## Install

1. Install the **LSP** package (Package Control: *Install Package*, *LSP*).
2. Copy this folder into Sublime's `Packages` folder as `Quillo` (*Preferences > Browse
   Packages...*), or link it there:

   ```sh
   ln -s "$PWD" "$HOME/Library/Application Support/Sublime Text/Packages/Quillo"   # macOS
   ```

3. `quillo` must be on the `PATH` Sublime Text sees, or named in full in
   *Preferences > Package Settings > LSP > Servers > LSP-quillo* (`"command"`).

## Tests

```sh
python3 build.py --check
python3 -m unittest discover -s test
```

check that the grammars are the VS Code extension's rule for rule, that every rule a grammar
includes is there, that the settings parse as Sublime reads them (comments and trailing commas),
that the build system's pattern finds `quillo check`'s errors (run for real with `QUILLO_BIN`
set), and that the plugin registers `quillo` with the LSP package, on Python 3.8 as Sublime
Text 4 runs it.

Not yet run in Sublime Text itself.
