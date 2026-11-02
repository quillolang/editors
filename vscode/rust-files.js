// Which .rs files quillo lsp is given: those a program uses (FEEDBACK37.md, Q-453). A .rs
// file is Rust a program can `use`, as a .qwer file is, but most .rs files are a crate's,
// and quillo would run cargo check on each and warn of every pub fn it cannot export. So a
// .rs file goes to the server only when a .qwe file names it on a `use` or `import` line,
// looked for as quillo's own program_entry looks: in the file's folder and up to three
// above it, not above a Cargo.toml or a .git, the .qwe files there and in their folders.
const fs = require("fs");
const path = require("path");

const IMPORT = /^\s*(?:use|import|client|preload|preconnect)\b(.*)$/;
const RUST_PATH = /"([^"]+\.rs)"|([^\s",;"]+\.rs)(?![\w.])/g;
const MAX_FILES = 400;

/** The .qwe files in `dir` and below it, `depth` folders down, skipping hidden folders and node_modules. */
function qweFiles(dir, depth, out = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (out.length >= MAX_FILES) break;
    if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "target") continue;
    const full = path.join(dir, e.name);
    if (e.isFile() && e.name.endsWith(".qwe")) out.push(full);
    else if (e.isDirectory() && depth > 0) qweFiles(full, depth - 1, out);
  }
  return out;
}

const real = (p) => {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
};

/** The .rs paths a .qwe file's `use` and `import` lines name, as written. */
function rustPaths(text) {
  const out = [];
  for (const line of text.split("\n")) {
    const m = line.match(IMPORT);
    if (!m) continue;
    const rest = m[1].replace(/\/\/.*$/, "");
    for (const p of rest.matchAll(RUST_PATH)) out.push(p[1] || p[2]);
  }
  return out;
}

/** Whether `qwe`, in a program whose folder is `base`, names `target` (a real path). */
function names(qwe, base, target) {
  let text;
  try {
    text = fs.readFileSync(qwe, "utf8");
  } catch {
    return false;
  }
  for (const p of rustPaths(text)) {
    // `./` and `../` count from the file that writes them; the rest from the program's folder.
    const from = p.startsWith("./") || p.startsWith("../") ? [path.dirname(qwe)] : [base, path.dirname(qwe)];
    if (from.some((d) => real(path.join(d, p)) === target)) return true;
  }
  return false;
}

/** Whether a program uses the .rs file `file`. */
function usedByProgram(file) {
  if (!file.endsWith(".rs")) return false;
  const target = real(file);
  let dir = path.dirname(target);
  for (let i = 0; i < 4; i++) {
    if (qweFiles(dir, 3).some((q) => names(q, dir, target))) return true;
    if (fs.existsSync(path.join(dir, "Cargo.toml")) || fs.existsSync(path.join(dir, ".git"))) break;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return false;
}

/** usedByProgram, kept for a few seconds: it is asked on every change to an open file. */
function cached(ms = 5000, now = () => Date.now()) {
  const seen = new Map();
  return (file) => {
    const hit = seen.get(file);
    if (hit && now() - hit.at < ms) return hit.used;
    const used = usedByProgram(file);
    seen.set(file, { used, at: now() });
    return used;
  };
}

module.exports = { usedByProgram, rustPaths, cached };
