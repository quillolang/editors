// Which quillo the extension runs, with VS Code's API stubbed (FEEDBACK71.md, Q-967): in a
// folder not trusted, nothing of the folder's runs, neither its target/release/quillo nor a
// quillo.path from its .vscode/settings.json; trusted, its build is used. The stubbed client
// starts the server as vscode-languageclient does (spawn, cwd the folder), so a planted
// binary that ran would leave its file behind. Run: npm test
const fs = require("fs");
const os = require("os");
const path = require("path");
const cp = require("child_process");
const Module = require("module");

let failed = 0;
let count = 0;
const check = (what, ok, got) => {
  count++;
  if (!ok) {
    failed++;
    console.log(`FAIL ${what}${got === undefined ? "" : `\n  got ${JSON.stringify(got)}`}`);
  }
};

// The cloned repository: a build of its own that says it ran, and a file named lsp for
// quillo.path = "sh" to run. quillo on the PATH is a stand-in that says so too.
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "quillo-binary-")));
const repo = path.join(tmp, "repo");
const bin = path.join(tmp, "bin");
const user = path.join(tmp, "user");
const marked = path.join(tmp, "ran");
for (const d of [repo, bin, user, marked]) fs.mkdirSync(d);
const script = (file, mark) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `#!/bin/sh\necho "$0 $*" > "${path.join(marked, mark)}"\n`, { mode: 0o755 });
};
script(path.join(repo, "target/release/quillo"), "RELEASE");
script(path.join(repo, "target/debug/quillo"), "DEBUG");
fs.writeFileSync(path.join(repo, "lsp"), `echo ran > "${path.join(marked, "LSP")}"\n`);
fs.writeFileSync(path.join(repo, "main.qwe"), 'route GET / = "hello"\n');
script(path.join(bin, "quillo"), "PATH");
script(path.join(user, "quillo"), "USER");
const marks = ["RELEASE", "DEBUG", "LSP", "PATH", "USER"];
const ran = () => marks.filter((m) => fs.existsSync(path.join(marked, m)));
const clear = () => marks.forEach((m) => fs.rmSync(path.join(marked, m), { force: true }));
const env = { ...process.env, PATH: `${bin}:/usr/bin:/bin` };

// What the extension asks of VS Code. get() gives the folder's value even when not trusted, as
// a VS Code that did not read restrictedConfigurations would: the extension must not take it.
let world;
const handlers = {};
const commands = {};
const started = [];
const sent = [];
const noop = () => ({ dispose() {} });
const vscode = {
  workspace: {
    get isTrusted() {
      return world.trusted;
    },
    get workspaceFolders() {
      return [{ uri: { fsPath: repo }, name: "repo", index: 0 }];
    },
    getConfiguration: () => ({
      get: (k) => (k === "path" ? world.folderPath || world.userPath : undefined),
      inspect: (k) => (k === "path" ? { key: "quillo.path", defaultValue: "", globalValue: world.userPath, workspaceValue: world.folderPath } : undefined),
    }),
    createFileSystemWatcher: () => ({ dispose() {} }),
    onDidChangeTextDocument: noop,
    onDidChangeConfiguration: noop,
    onDidGrantWorkspaceTrust: (f) => ((handlers.trust = f), { dispose() {} }),
    getWorkspaceFolder: () => undefined,
  },
  commands: { registerCommand: (name, f) => ((commands[name] = f), { dispose() {} }), executeCommand: async () => {} },
  debug: {
    registerDebugAdapterDescriptorFactory: (type, f) => ((handlers.dap = f), { dispose() {} }),
    registerDebugConfigurationProvider: noop,
    registerDebugAdapterTrackerFactory: noop,
  },
  window: {
    showWarningMessage: async () => undefined,
    showInformationMessage: async () => undefined,
    get activeTextEditor() {
      return { document: { languageId: "quillo", fileName: path.join(repo, "main.qwe"), save: async () => true } };
    },
    terminals: [],
    createTerminal: () => ({ name: "Quillo", show() {}, sendText: (t) => sent.push(t) }),
  },
  env: { openExternal: () => {} },
  Uri: { parse: (s) => s, file: (fsPath) => ({ fsPath }) },
  SnippetString: class {},
  DebugAdapterExecutable: class {
    constructor(command, args, options) {
      Object.assign(this, { command, args, options });
    }
  },
};
class LanguageClient {
  constructor(id, name, server) {
    this.server = server;
  }
  async start() {
    const { command, args } = this.server.run;
    started.push(command);
    const r = cp.spawnSync(command, args, { cwd: repo, input: "", env });
    if (r.error) throw r.error;
  }
  async stop() {}
}
const load = Module._load;
Module._load = function (req, ...rest) {
  if (req === "vscode") return vscode;
  if (req === "vscode-languageclient/node") return { LanguageClient };
  return load.call(this, req, ...rest);
};
const ext = require("../extension.js");

// Each place that runs the binary: the server (started by activate), Run, Check, the debugger.
async function places(w) {
  world = w;
  clear();
  started.length = 0;
  sent.length = 0;
  await ext.activate({ subscriptions: [] });
  await commands["quillo.run"]();
  await commands["quillo.check"]();
  const dap = handlers.dap.createDebugAdapterDescriptor({ configuration: {}, workspaceFolder: { uri: { fsPath: repo } } });
  ext.deactivate();
  return { server: started[0], run: sent[0], check: sent[1], dap: dap.command, ran: ran() };
}
const runs = (line, file) => typeof line === "string" && line.startsWith(`"${file}" `);

(async () => {
  // Restricted Mode, nothing set: quillo from the PATH, in every place.
  let p = await places({ trusted: false });
  check("not trusted: the server is quillo on the PATH", p.server === "quillo", p.server);
  check("not trusted: the repository's build does not run", !p.ran.includes("RELEASE") && !p.ran.includes("DEBUG"), p.ran);
  check("not trusted: quillo on the PATH does", p.ran.includes("PATH"), p.ran);
  check("not trusted: Run is quillo on the PATH", runs(p.run, "quillo"), p.run);
  check("not trusted: Check is quillo on the PATH", runs(p.check, "quillo"), p.check);
  check("not trusted: the debugger is quillo on the PATH", p.dap === "quillo", p.dap);

  // Restricted Mode, the folder's .vscode/settings.json says quillo.path = "sh": not read.
  p = await places({ trusted: false, folderPath: "sh" });
  check("not trusted: the folder's quillo.path is not read", p.server === "quillo" && !p.ran.includes("LSP"), p);
  check("not trusted: nor by Run, Check or the debugger", runs(p.run, "quillo") && runs(p.check, "quillo") && p.dap === "quillo", p);

  // Restricted Mode, the user's own quillo.path: used, in every place.
  const mine = path.join(user, "quillo");
  p = await places({ trusted: false, userPath: mine });
  check("not trusted: the user's quillo.path is used", p.server === mine && p.ran.join() === "USER", p);
  check("not trusted: by Run, Check and the debugger too", runs(p.run, mine) && runs(p.check, mine) && p.dap === mine, p);
  p = await places({ trusted: false, userPath: mine, folderPath: "sh" });
  check("not trusted: the user's quillo.path, not the folder's", p.server === mine && !p.ran.includes("LSP"), p);

  // Trusted: the folder's build, the release one first, in every place.
  const release = path.join(repo, "target/release/quillo");
  p = await places({ trusted: true });
  check("trusted: the folder's release build", p.server === release && p.ran.join() === "RELEASE", p);
  check("trusted: Run, Check and the debugger take it too", runs(p.run, release) && runs(p.check, release) && p.dap === release, p);
  check("trusted: quillo.path first", (await places({ trusted: true, folderPath: mine })).server === mine);
  fs.rmSync(release);
  const debug = path.join(repo, "target/debug/quillo");
  check("trusted: the debug build when there is no release one", (await places({ trusted: true })).server === debug);
  script(release, "RELEASE");
  check("the user's quillo.path in a trusted folder", (await places({ trusted: true, userPath: mine })).server === mine);

  // Trust given once open: the server starts again, with the folder's build.
  world = { trusted: false };
  clear();
  started.length = 0;
  await ext.activate({ subscriptions: [] });
  world.trusted = true;
  await handlers.trust();
  ext.deactivate();
  check("trust given: started again with the folder's build", started.join() === `quillo,${release}` && ran().includes("RELEASE"), started);

  // New program asks the same.
  world = { trusted: false };
  check("not trusted: New program is quillo on the PATH", ext.quilloPath && ext.quilloPath() === "quillo");
  world = { trusted: true };
  check("trusted: New program takes the folder's build", ext.quilloPath && ext.quilloPath() === release);

  // VS Code itself keeps a folder's quillo.path out of Restricted Mode.
  const pkg = require("../package.json");
  const caps = pkg.capabilities.untrustedWorkspaces;
  check("quillo.path is a restricted setting", caps.supported === "limited" && (caps.restrictedConfigurations || []).includes("quillo.path"), caps);

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(failed ? `${failed} of ${count} binary checks failed` : `all ${count} binary checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.log(`FAIL ${e.stack}`);
  process.exit(1);
});
