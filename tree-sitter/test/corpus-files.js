// Parses every .qwe file of the Quillo repositories next to this one and fails on any
// that has an ERROR or MISSING node. Run: npm test (or node test/corpus-files.js DIR...)
// QUILLO_CORPUS lists the folders (separated by ":"); by default the siblings of
// quillo-editors that exist. A file listed in test/known-bad.txt is one quillo itself
// refuses (it is there to test that): it must have an error.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const dev = path.resolve(__dirname, "../../..");
const dirs = process.argv.slice(2).length
  ? process.argv.slice(2)
  : (process.env.QUILLO_CORPUS || ["quillo-app1/app", "quillo-app1/mobile", "quillo-examples", "quillo-components", "quillo-website", "quillo-starter"].map((d) => path.join(dev, d)).join(":")).split(":");

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === "target" || e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith(".qwe")) out.push(full);
  }
  return out;
}

const files = dirs.filter((d) => fs.existsSync(d)).flatMap((d) => walk(d, []));
if (!files.length) {
  console.log("(no Quillo repositories next to this one: the corpus was skipped)");
  process.exit(0);
}
const knownFile = path.join(__dirname, "known-bad.txt");
const known = new Set(
  fs.existsSync(knownFile)
    ? fs.readFileSync(knownFile, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((l) => path.join(dev, l))
    : []
);
const list = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ts-quillo-")), "paths.txt");
fs.writeFileSync(list, files.join("\n"));
let out = "";
try {
  out = execFileSync("npx", ["tree-sitter", "parse", "--quiet", "--paths", list], { cwd: path.join(__dirname, ".."), encoding: "utf8", maxBuffer: 1 << 28 });
} catch (e) {
  out = (e.stdout || "") + (e.stderr || "");
}
const bad = new Set();
for (const line of out.split("\n")) {
  const m = line.match(/^(.*\.qwe)\s+.*\((ERROR|MISSING)/);
  if (m) bad.add(m[1].trim());
}
const unexpected = [...bad].filter((f) => !known.has(f));
const fixed = [...known].filter((f) => files.includes(f) && !bad.has(f));
for (const f of unexpected) console.log(`ERROR in ${path.relative(dev, f)}`);
for (const f of fixed) console.log(`known bad, but parsed: ${path.relative(dev, f)} (take it out of test/known-bad.txt)`);
console.log(`${files.length - bad.size} of ${files.length} files parsed with no error (${known.size} known bad)`);
process.exit(unexpected.length || fixed.length ? 1 : 0);
