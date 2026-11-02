// Which .rs files go to quillo lsp: those a program uses, found on disk as the server
// finds a file's program. And the middleware that keeps the others from it. Run: npm test
const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");
const { usedByProgram, rustPaths, cached } = require("../rust-files.js");

let failed = 0;
let count = 0;
const check = (what, ok, got) => {
  count++;
  if (!ok) {
    failed++;
    console.log(`FAIL ${what}${got === undefined ? "" : `\n  got ${JSON.stringify(got)}`}`);
  }
};

const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "quillo-rs-")));
const put = (rel, text = "") => {
  const full = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
  return full;
};

// The paths a .qwe file's lines name.
check("import and use lines", JSON.stringify(rustPaths('import tw.rs use f\nuse "lib/a.rs"\nuse x, y from ./b.rs\nlet s = "c.rs"\n// use d.rs\nclient /e.js use E')) === JSON.stringify(["tw.rs", "lib/a.rs", "./b.rs"]), rustPaths('import tw.rs use f\nuse "lib/a.rs"\nuse x, y from ./b.rs\nlet s = "c.rs"\n// use d.rs'));
check("a comment after the line is not a path", rustPaths("import a.rs use f // not b.rs").join() === "a.rs");
check("tw.rs.bak is not tw.rs", rustPaths("use tw.rs.bak").length === 0);

// A program and what it uses.
put("app/main.qwe", "import tw.rs use tailwind\nuse lib/forum.qwe\n");
const tw = put("app/tw.rs", "pub fn tailwind() -> String { String::new() }\n");
put("app/lib/forum.qwe", "import lib/md.rs use render\nimport ./near.rs use near\n");
const md = put("app/lib/md.rs");
const near = put("app/lib/near.rs");
const loose = put("app/lib/loose.rs");
check("a .rs file main.qwe imports", usedByProgram(tw));
check("a path from the program's folder, written in a file below it", usedByProgram(md));
check("./ from the file that writes it", usedByProgram(near));
check("a .rs file nothing names", !usedByProgram(loose));
check("not a .rs file", !usedByProgram(path.join(tmp, "app/main.qwe")));
check("a .rs file that is not there", !usedByProgram(path.join(tmp, "app/none.rs")));

// A crate beside it: not above its Cargo.toml.
put("crate/Cargo.toml", "[package]\nname = \"c\"\n");
const crateMain = put("crate/src/main.rs", "fn main() {}\n");
put("crate/src/notes.qwe", "// tw.rs in a comment\n");
check("a crate's own .rs file", !usedByProgram(crateMain));
put("outer/main.qwe", "import inner/crate/src/x.rs use f\n");
put("outer/inner/crate/Cargo.toml", "[package]\n");
const x = put("outer/inner/crate/src/x.rs");
check("a .qwe above the crate's Cargo.toml is not looked at", !usedByProgram(x));
put("g/.git/HEAD", "ref: x\n");
put("g/w/main.qwe", "import v.rs use v\n");
const v = put("g/w/v.rs");
check("a program inside a repository", usedByProgram(v));

// Four folders up and no further, as the server looks.
put("deep/main.qwe", "import a/b/c/d/e.rs use e\n");
const e = put("deep/a/b/c/d/e.rs");
check("five folders below its program, not found", !usedByProgram(e));
put("deep2/main.qwe", "import a/b/c/f.rs use f\n");
const f = put("deep2/a/b/c/f.rs");
check("four folders below, found", usedByProgram(f));

// A link to the file counts as the file.
fs.symlinkSync(tw, path.join(tmp, "app/linked.rs"));
check("a link to a used file", usedByProgram(path.join(tmp, "app/linked.rs")));

// Kept for a moment, then asked again.
let clock = 0;
const ask = cached(5000, () => clock);
const later = put("app/later.rs");
check("not used yet", !ask(later));
fs.appendFileSync(path.join(tmp, "app/main.qwe"), "import later.rs use l\n");
check("still the answer kept", !ask(later));
clock = 6000;
check("asked again after the time", ask(later));

// The middleware: a .rs file no program uses is neither sent nor asked about.
const vscode = { workspace: {}, window: {}, commands: {}, debug: {}, Uri: { file: (p) => ({ fsPath: p }) } };
const load = Module._load;
Module._load = function (req, ...rest) {
  if (req === "vscode") return vscode;
  if (req === "vscode-languageclient/node") return { LanguageClient: class {} };
  return load.call(this, req, ...rest);
};
const ext = require("../extension.js");
const m = ext.middleware();
const doc = (file, languageId) => ({ languageId, uri: { fsPath: file }, fileName: file });
const sent = [];
const next = (d) => sent.push(d.uri ? d.uri.fsPath : d.document.uri.fsPath);
m.didOpen(doc(tw, "rust"), next);
m.didOpen(doc(loose, "rust"), next);
m.didChange({ document: doc(loose, "rust") }, next);
m.didOpen(doc(path.join(tmp, "app/main.qwe"), "quillo"), next);
check("a used .rs file is sent, an unused one is not", JSON.stringify(sent) === JSON.stringify([tw, path.join(tmp, "app/main.qwe")]), sent);
let asked = 0;
const hover = m.provideHover(doc(loose, "rust"), { line: 0 }, {}, () => ++asked);
check("no hover asked for an unused .rs file", hover === undefined && asked === 0);
m.provideHover(doc(tw, "rust"), { line: 0 }, {}, (d, pos, token) => {
  asked++;
  check("the request's arguments reach the server", d.uri.fsPath === tw && pos.line === 0 && token !== undefined);
});
check("hover asked for a used one", asked === 1);
m.provideCompletionItem(doc(md, "rust"), {}, {}, {}, () => asked++);
check("completion in a used one", asked === 2);
check("rustUnwelcome on a .qwe file is false", ext.rustUnwelcome(doc(path.join(tmp, "app/main.qwe"), "quillo")) === false);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `${failed} of ${count} .rs checks failed` : `all ${count} .rs checks passed`);
process.exit(failed ? 1 : 0);
