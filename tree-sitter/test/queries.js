// The queries: each compiles against the grammar (and so does each editor's copy),
// the injections find the CSS and SQL, the builtins are the TextMate grammar's, and
// the editors' copies are what scripts/queries.js makes. Run: npm test
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { patterns, outputs } = require("../scripts/queries.js");

const root = path.join(__dirname, "..");
const repo = path.join(root, "..");
let failed = 0;
let count = 0;
const check = (what, ok, got) => {
  count++;
  if (!ok) {
    failed++;
    console.log(`FAIL ${what}${got === undefined ? "" : `\n  got ${typeof got === "string" ? got : JSON.stringify(got)}`}`);
  }
};

const sample = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ts-quillo-q-")), "sample.qwe");
fs.writeFileSync(
  sample,
  [
    "let s = css`a > b { color: ${accent}; }`",
    'let n = db.one("select count(*) as n from users where id = ?", id).n',
    "let rows = db.query(`select * from tasks where owner = ${me}`)",
    "let q = sql`delete from t`",
    "let page = <div><style>{\"p { margin: 0 }\"}</style><style>@import url(a.css);</style><script>go()</script></div>",
    'let other = foo.one("not sql")',
    "",
  ].join("\n")
);
const query = (file) => execFileSync("npx", ["tree-sitter", "query", file, sample], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

// Every query compiles, the editors' copies too.
const files = fs.readdirSync(path.join(root, "queries")).map((f) => path.join(root, "queries", f));
for (const dir of Object.keys(outputs)) {
  const full = path.join(repo, dir);
  if (fs.existsSync(full)) files.push(...fs.readdirSync(full).filter((f) => f.endsWith(".scm")).map((f) => path.join(full, f)));
}
for (const f of files) {
  let ok = true;
  let err = "";
  try {
    query(f);
  } catch (e) {
    ok = false;
    err = String(e.stderr || e.message).split("\n").slice(0, 3).join(" ");
  }
  check(`${path.relative(repo, f)} compiles`, ok, err);
}

// The injections.
const inj = query(path.join(root, "queries/injections.scm"));
const contents = [...inj.matchAll(/capture: \d+ - injection\.content, start: \(\d+, \d+\), end: \(\d+, \d+\), text: `([^`]*)`/g)].map((m) => m[1]);
const has = (text) => contents.some((c) => c.includes(text));
check("CSS in css`...`, around its ${...}", has("a > b { color: ") && has("; }"), contents);
check("SQL in db.one's string", has("select count(*) as n from users"), contents);
check("SQL in db.query's template", has("select * from tasks where owner = "), contents);
check("SQL in sql`...`", has("delete from t"), contents);
check("CSS in <style>'s string", has("p { margin: 0 }"), contents);
check("CSS in <style>'s text", has("@import url(a.css);"), contents);
check("JavaScript in <script>", has("go()"), contents);
check("no SQL in another object's .one", !has("not sql"), contents);

// The builtins are the VS Code grammar's.
const tm = path.join(repo, "vscode/syntaxes/quillo.tmLanguage.json");
if (fs.existsSync(tm)) {
  const g = JSON.parse(fs.readFileSync(tm, "utf8"));
  const want = g.repository.call.patterns[0].match.match(/\\b\((.*?)\)\\b/)[1].split("|").sort();
  const hl = fs.readFileSync(path.join(root, "queries/highlights.scm"), "utf8");
  const block = hl.match(/#any-of\? @function\.builtin([^)]*)\)/)[1];
  const got = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
  check("the builtins are the TextMate grammar's", JSON.stringify(got) === JSON.stringify(want), { missing: want.filter((w) => !got.includes(w)), extra: got.filter((w) => !want.includes(w)) });
  const mods = g.repository["module-call"].match.match(/\\b\((.*?)\)/)[1].split("|").sort();
  const mblock = hl.match(/#any-of\? @module\.builtin([^)]*)\)/)[1];
  check("the modules are the TextMate grammar's", JSON.stringify([...mblock.matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort()) === JSON.stringify(mods));
}

// The patterns are read whole: as many as the query has at its top level.
const hl = fs.readFileSync(path.join(root, "queries/highlights.scm"), "utf8");
const ps = patterns(hl);
check("every pattern is read once", ps.every((p) => !p.trim().startsWith(")")) && ps.length > 50, ps.length);
check("a pattern keeps the comment above it", ps.some((p) => p.startsWith("; In a pattern, a type's name")));

// The editors' copies are up to date.
let fresh = true;
try {
  execFileSync("node", [path.join(root, "scripts/queries.js"), "--check"], { encoding: "utf8" });
} catch (e) {
  fresh = false;
}
check("the editors' copies are what scripts/queries.js makes", fresh);

console.log(failed ? `${failed} of ${count} query checks failed` : `all ${count} query checks passed`);
process.exit(failed ? 1 : 0);
