// Quillo: New program, with VS Code's API stubbed: the dialogs answer as a
// person would, and `quillo new` runs for real. Run: npm test
// QUILLO_BIN is a quillo with `new` (else the runs are skipped); QUILLO_OLD_BIN
// one from before it, as ~/.cargo/bin/quillo may be.
const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");

// What the extension asks of VS Code, answered from `answers`.
let answers = {};
const shown = [];
const opened = [];
const vscode = {
  window: {
    showQuickPick: async (items) => items.find((i) => i.label === answers.kind),
    showOpenDialog: async () => answers.parent && [{ fsPath: answers.parent }],
    showInputBox: async (o) => {
      const problem = o.validateInput(answers.name ?? "");
      return problem ? undefined : answers.name;
    },
    showErrorMessage: (m) => shown.push(m),
  },
  workspace: { workspaceFolders: [], getConfiguration: () => ({ get: (k) => (k === "path" ? answers.bin : undefined) }) },
  commands: { executeCommand: async (c, uri, o) => opened.push({ c, folder: uri.fsPath, o }) },
  Uri: { file: (fsPath) => ({ fsPath }) },
};
const load = Module._load;
Module._load = function (req, ...rest) {
  if (req === "vscode") return vscode;
  if (req === "vscode-languageclient/node") return { LanguageClient: class {} };
  return load.call(this, req, ...rest);
};
const ext = require("../extension.js");

let failed = 0;
let count = 0;
const check = (what, ok, got) => {
  count++;
  if (!ok) {
    failed++;
    console.log(`FAIL ${what}${got === undefined ? "" : `\n  got ${JSON.stringify(got)}`}`);
  }
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "quillo-new-"));
fs.mkdirSync(path.join(tmp, "empty"));
fs.mkdirSync(path.join(tmp, "full"));
fs.writeFileSync(path.join(tmp, "full", "main.qwe"), "print(1)\n");
fs.writeFileSync(path.join(tmp, "a-file"), "x");

// The name asked for.
for (const [name, ok] of [
  ["my-app", true],
  ["  spaced  ", true],
  ["empty", true],
  ["", false],
  ["   ", false],
  ["a/b", false],
  ["a\\b", false],
  [".", false],
  ["..", false],
  ["full", false],
  ["a-file", false],
]) {
  const problem = ext.newFolderProblem(tmp, name);
  check(`name ${JSON.stringify(name)} ${ok ? "taken" : "refused"}`, ok ? problem === null : typeof problem === "string", problem);
}
// In an empty folder, `.` would be that folder: still a path, not a name.
fs.mkdirSync(path.join(tmp, "bare", "inner"), { recursive: true });
for (const name of [".", ".."]) {
  check(`${name} in an empty folder refused`, typeof ext.newFolderProblem(path.join(tmp, "bare", "inner"), name) === "string");
}

// What a failure says.
check("a quillo from before `new` is named", /has no `new`/.test(ext.newFailure("q", 2, "Quillo — a small web language\n\nusage:\n  quillo run")));
check("a usage error of `new` is its own", ext.newFailure("q", 2, "usage: quillo new <folder>") === "Quillo: usage: quillo new <folder>");
check("quillo's message is shown", ext.newFailure("q", 1, "quillo: new: x is not empty") === "Quillo: quillo: new: x is not empty");
check("no output names the command", /could not run "q new"/.test(ext.newFailure("q", -1, "")));

(async () => {
  const run = async (a) => {
    answers = a;
    shown.length = 0;
    opened.length = 0;
    await ext.newProgram();
  };

  // Cancelled at each step: nothing made, nothing opened.
  for (const a of [{}, { kind: "Minimal" }, { kind: "Minimal", parent: tmp }, { kind: "Minimal", parent: tmp, name: "full" }]) {
    await run({ ...a, bin: "/nonexistent/quillo" });
    check(`cancelled at ${JSON.stringify(a)}: nothing opened or said`, !opened.length && !shown.length, { opened, shown });
  }

  // A binary that is not there.
  await run({ kind: "Minimal", parent: tmp, name: "nowhere", bin: path.join(tmp, "no-quillo") });
  check("a missing binary is said", shown.length === 1 && /could not run|ENOENT|no-quillo/.test(shown[0]) && !opened.length, shown);

  const bin = process.env.QUILLO_BIN;
  if (bin && fs.existsSync(bin)) {
    await run({ kind: "Minimal", parent: tmp, name: "mini", bin });
    const mini = path.join(tmp, "mini");
    check("--minimal makes main.qwe, lib/ and ui/", ["main.qwe", "lib/greet.qwe", "ui/page.qwe"].every((f) => fs.existsSync(path.join(mini, f))), fs.readdirSync(tmp));
    check("the folder is opened, in this window when none is open", opened.length === 1 && opened[0].folder === mini && opened[0].o.forceNewWindow === false, opened);

    vscode.workspace.workspaceFolders = [{ uri: { fsPath: tmp } }];
    await run({ kind: "The to-do app", parent: tmp, name: "  todo ", bin });
    const todo = path.join(tmp, "todo");
    check("the to-do app has its migration", fs.existsSync(path.join(todo, "migrations/001_todos.sql")), fs.readdirSync(tmp));
    check("a window with a folder opens another", opened.length === 1 && opened[0].folder === todo && opened[0].o.forceNewWindow === true, opened);

    await run({ kind: "Minimal", parent: tmp, name: "empty", bin });
    check("an empty folder is filled", fs.existsSync(path.join(tmp, "empty", "main.qwe")) && opened.length === 1, { shown, opened });

    // Not empty by the time it runs: quillo refuses, and says so.
    fs.mkdirSync(path.join(tmp, "race"));
    const validate = vscode.window.showInputBox;
    vscode.window.showInputBox = async (o) => {
      const r = await validate(o);
      fs.writeFileSync(path.join(tmp, "race", "x"), "");
      return r;
    };
    await run({ kind: "Minimal", parent: tmp, name: "race", bin });
    vscode.window.showInputBox = validate;
    check("quillo's refusal is shown, nothing opened", shown.length === 1 && /not empty/.test(shown[0]) && !opened.length, shown);
  } else {
    console.log("(QUILLO_BIN not set: the runs of quillo new were skipped)");
  }

  const old = process.env.QUILLO_OLD_BIN;
  if (old && fs.existsSync(old)) {
    await run({ kind: "Minimal", parent: tmp, name: "old", bin: old });
    check("a quillo from before `new` is told to update", shown.length === 1 && /has no `new`/.test(shown[0]) && !opened.length, shown);
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(failed ? `${failed} failed` : `all ${count} New program cases passed`);
  process.exit(failed ? 1 : 0);
})();
