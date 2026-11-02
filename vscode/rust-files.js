// Which .rs files quillo lsp is given: those a program uses (FEEDBACK37.md, Q-453). A .rs
// file is Rust a program can `use`, as a .qwer file is, but most .rs files are a crate's,
// and quillo would run cargo check on each and warn of every pub fn it cannot export. So a
// .rs file goes to the server only when a program reaches it through its `use` and
// `import` lines. The program is looked for as quillo's own program_entry looks: the .qwe
// files in the file's folder and in up to three folders above it, not above a Cargo.toml
// or a .git, each followed through the .qwe files it takes. A folder or file that cannot be
// read is passed over.
const fs = require("fs");
const path = require("path");

const IMPORT = /^\s*(import|client|preload|preconnect)\s+(?:module\s+)?("[^"]*"|\S+)\s+use\b/;
const USE = /^\s*use\s+(.*)$/;
const MAX_FILES = 500;

const unquote = (p) => (p.startsWith('"') && p.endsWith('"') ? p.slice(1, -1) : p);

/** The files a .qwe file's `use` and `import` lines name, as written: .qwe (a path with no
 *  extension is one) and .rs. Browser scripts and .qwer files are left out. */
function usePaths(text) {
  const out = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s\/\/.*$/, "");
    let p = null;
    const imp = line.match(IMPORT);
    if (imp) {
      if (imp[1] !== "import") continue;
      p = unquote(imp[2]);
    } else {
      const u = line.match(USE);
      if (!u) continue;
      const rest = u[1].trim();
      const from = rest.match(/\bfrom\s+("[^"]*"|\S+)\s*$/);
      p = unquote(from ? from[1] : rest.split(/\s+/)[0]);
      if (!from && !p.includes("/") && !p.includes(".") && !rest.startsWith('"')) p = null;
    }
    if (!p || /^[a-z]+:\/\//.test(p) || p.startsWith("/")) continue;
    if (p.endsWith(".rs") || p.endsWith(".qwe")) out.push(p);
    else if (!/\.\w+$/.test(p)) out.push(p + ".qwe");
  }
  return out;
}

const real = (p) => {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
};

/** The .qwe files right in `dir`, sorted. */
function qweIn(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".qwe"))
      .map((e) => path.join(dir, e.name))
      .sort();
  } catch {
    return [];
  }
}

/** Whether `main`, a program whose folder is `base`, reaches `target` (a real path). */
function reaches(main, base, target) {
  const todo = [main];
  const seen = new Set();
  while (todo.length) {
    const f = todo.pop();
    if (seen.has(f) || seen.size >= MAX_FILES) continue;
    seen.add(f);
    let text;
    try {
      text = fs.readFileSync(f, "utf8");
    } catch {
      continue;
    }
    for (const p of usePaths(text)) {
      // `./` and `../` count from the file that writes them; the rest from the program's folder.
      const from = p.startsWith("./") || p.startsWith("../") ? path.dirname(f) : base;
      const full = real(path.join(from, p));
      if (!full) continue;
      if (p.endsWith(".rs")) {
        if (full === target) return true;
      } else todo.push(full);
    }
  }
  return false;
}

/** Whether a program uses the .rs file `file`. */
function usedByProgram(file) {
  if (!file.endsWith(".rs")) return false;
  const target = real(file);
  if (!target) return false;
  let dir = path.dirname(target);
  for (let i = 0; i < 4; i++) {
    if (qweIn(dir).some((main) => reaches(main, dir, target))) return true;
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

module.exports = { usedByProgram, usePaths, cached };
