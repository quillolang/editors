// The snippets: each reads as the JetBrains build reads it (its stops `$1`, `${1}`, `${1:text}`,
// `${1|a,b|}`, `$0` and `\$`, a prefix a live template can take), and the tools' snippets,
// filled in, are a program `quillo check` takes. Run: npm test
// QUILLO_BIN is a quillo with `fn mcp`, `confirm` and `about` (else the check is skipped).
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const snippets = JSON.parse(fs.readFileSync(path.join(__dirname, "../snippets/quillo.json"), "utf8"));
let failed = 0;
let count = 0;
const check = (what, ok, got) => {
  count++;
  if (!ok) {
    failed++;
    console.log(`FAIL ${what}${got === undefined ? "" : `\n  got ${JSON.stringify(got)}`}`);
  }
};
const body = (name) => [].concat(snippets[name].body).join("\n");

// What a stop may be: as build.gradle.kts turns them into a live template's.
const stop = /\\[$}\\]|\$\d+|\$\{\d+\}|\$\{\d+:[^$}]*\}|\$\{\d+\|[^|$}]*\|\}/g;
const prefixes = new Set();
for (const name of Object.keys(snippets)) {
  const rest = body(name).replace(stop, "");
  check(`${name}: every stop is one a live template takes`, !rest.includes("$"), rest);
  const prefix = snippets[name].prefix;
  check(`${name}: its prefix ${prefix} is a word, once`, /^[a-z][\w.-]*$/.test(prefix) && !prefixes.has(prefix), prefix);
  prefixes.add(prefix);
}

/** The snippet as typed with each stop's text: its default, its first choice; `$0` is `end`. */
const fill = (name, end = "") =>
  body(name)
    .replace(/\$\{\d+\|([^,|]*)[^|]*\|\}/g, "$1")
    .replace(/\$\{\d+:([^}]*)\}/g, "$1")
    .replace(/\$0\b/g, () => end)
    .replace(/\$\{\d+\}|\$\d+/g, "")
    .replace(/\\\$/g, "$");

// Tools for AI clients (quillo FEEDBACK56.md): a tool, one the pages call too, a service's tools,
// a question before it acts, a choice, and the instructions block.
const tools = { fnmcp: "fn mcp", serverfnmcp: "server fn mcp", servicemcp: "service mcp", confirm: "confirm", about: "about", instructions: "instructions" };
for (const [prefix, name] of Object.entries(tools)) check(`a snippet ${prefix}`, snippets[name] && snippets[name].prefix === prefix, Object.keys(snippets));
if (failed) {
  console.log(`${failed} of ${count} snippet checks failed`);
  process.exit(1);
}
check("fnmcp starts with its /// line", body("fn mcp").startsWith("/// ") && fill("fn mcp").split("\n")[1].startsWith("fn mcp name() -> map with db {"), fill("fn mcp"));
check("serverfnmcp is a server fn mcp", fill("server fn mcp").split("\n")[1].startsWith("server fn mcp "), fill("server fn mcp"));
check("servicemcp serves a file", fill("service mcp") === 'service mcp /billing = "billing.qwe"', fill("service mcp"));
check("confirm returns an error on a no", /^if !confirm\("[^"]+"\) \{ return err\("[^"]+"\) \}/.test(fill("confirm")), fill("confirm"));
check("about has choices and a default", /about\("[^"]+", \{ \w+: "[^"]+", \w+: "[^"]+" \}, "draft"\)/.test(fill("about")), fill("about"));
// ask is the page's dialog, ask(message, options): an argument after its options is an error now.
for (const name of Object.keys(snippets)) check(`${name}: no ask with a third argument`, !/\bask\(\s*"[^"]*"\s*,\s*\{[^}]*\}\s*,/.test(fill(name)), fill(name));
check("instructions are //! lines", fill("instructions").trim().split("\n").every((l) => l.startsWith("//! ")), fill("instructions"));

const bin = process.env.QUILLO_BIN;
if (!bin) console.log("skipped quillo check of the tools' snippets: no QUILLO_BIN");
else {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quillo-snippets-"));
  const program = [
    fill("instructions"),
    'db.open("sqlite::memory:")',
    fill("fn mcp", 'db.one("select 1 as one")'),
    fill("server fn mcp", 'db.one("select 1 as one")').replace("mcp name(", "mcp other("),
    fill("service mcp"),
    "/// Deletes a note.",
    "fn mcp delete_note(id: int) -> map with db {",
    "\t" + fill("about", "\t" + fill("confirm", '\tdb.exec("delete from notes where id = ? and draft = ?", id, who == "draft")')),
    "}",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(dir, "main.qwe"), program);
  fs.writeFileSync(path.join(dir, "billing.qwe"), "/// The total.\nfn mcp total() -> map = { total: 1 }\n");
  let out = "";
  let ok = true;
  try {
    out = execFileSync(bin, ["check", path.join(dir, "main.qwe")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 });
  } catch (e) {
    ok = false;
    out = String(e.stdout || "") + String(e.stderr || e.message);
  }
  check("the tools' snippets make a program quillo check takes, with no warning", ok && /: ok \(.*\)\s*$/.test(out.trim()) && !/warning/.test(out), { out, program });
}

console.log(failed ? `${failed} of ${count} snippet checks failed` : `all ${count} snippet checks passed`);
process.exit(failed ? 1 : 0);
