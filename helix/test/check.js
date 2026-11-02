// languages.toml and the queries, against what Helix reads: the TOML parses, the
// grammar's commit holds the parser, every name used is defined, every capture is one
// Helix knows. Run: npm test (from helix/)
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { parse } = require("smol-toml");

const dir = path.join(__dirname, "..");
let failed = 0;
let count = 0;
const check = (what, ok, got) => {
  count++;
  if (!ok) {
    failed++;
    console.log(`FAIL ${what}${got === undefined ? "" : `\n  got ${JSON.stringify(got)}`}`);
  }
};

const conf = parse(fs.readFileSync(path.join(dir, "languages.toml"), "utf8"));
const langs = conf.language;
const servers = conf["language-server"] || {};
const grammars = conf.grammar || [];

// The grammar.
const g = grammars.find((x) => x.name === "quillo");
check("a quillo grammar", !!g);
check("from this repository's tree-sitter/", g.source.git === "https://github.com/quillolang/editors" && g.source.subpath === "tree-sitter");
check("at a full commit", /^[0-9a-f]{40}$/.test(g.source.rev), g.source.rev);
for (const f of ["src/parser.c", "src/scanner.c"]) {
  let ok = true;
  try {
    execFileSync("git", ["cat-file", "-e", `${g.source.rev}:tree-sitter/${f}`], { cwd: dir });
  } catch {
    ok = false;
  }
  check(`the commit holds tree-sitter/${f}`, ok);
}

// The languages.
const quillo = langs.find((l) => l.name === "quillo");
const qwer = langs.find((l) => l.name === "qwer");
check("quillo is .qwe", JSON.stringify(quillo["file-types"]) === '["qwe"]');
check("qwer is .qwer, with Rust's grammar", JSON.stringify(qwer["file-types"]) === '["qwer"]' && qwer.grammar === "rust");
check("a quillo script by its first line", quillo.shebangs.includes("quillo"));
check("// comments", quillo["comment-tokens"][0] === "//");
for (const l of langs) {
  for (const s of l["language-servers"] || []) check(`${l.name}'s server ${s} is defined`, !!servers[s]);
  const grammar = l.grammar || l.name;
  check(`${l.name}'s grammar ${grammar} is defined or Helix's own`, grammar === "rust" || grammars.some((x) => x.name === grammar));
  check(`${l.name} has highlights`, fs.existsSync(path.join(dir, "queries", l.name, "highlights.scm")));
  check(`${l.name}'s scope is source.${l.name}`, l.scope === `source.${l.name}`);
}
check("quillo lsp", servers["quillo-lsp"].command === "quillo" && servers["quillo-lsp"].args[0] === "lsp");

// The debugger: each template fills its placeholders from what it asks.
const dbg = quillo.debugger;
check("quillo dap over stdio", dbg.command === "quillo" && dbg.args[0] === "dap" && dbg.transport === "stdio");
for (const t of dbg.templates) {
  const asked = (t.completion || []).length;
  const used = [...JSON.stringify(t.args).matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1]));
  check(`template "${t.name}" uses what it asks`, used.length === asked && used.every((n) => n < asked), { asked, used });
  check(`template "${t.name}" launches a program`, t.request === "launch" && typeof t.args.program === "string");
}

// .qwer's queries are Rust's.
for (const f of fs.readdirSync(path.join(dir, "queries/qwer"))) {
  check(`qwer/${f} inherits Rust's`, fs.readFileSync(path.join(dir, "queries/qwer", f), "utf8").trim() === "; inherits: rust");
}

// Every capture is one Helix knows.
const SCOPES = new Set(`attribute type type.builtin type.parameter type.enum type.enum.variant constructor constant constant.builtin
constant.builtin.boolean constant.character constant.character.escape constant.numeric constant.numeric.integer constant.numeric.float
string string.regexp string.special string.special.path string.special.url string.special.symbol comment comment.line
comment.line.documentation comment.block comment.block.documentation comment.unused variable variable.mutable variable.builtin
variable.parameter variable.other variable.other.member variable.other.member.private label punctuation punctuation.delimiter
punctuation.bracket punctuation.special keyword keyword.control keyword.control.conditional keyword.control.repeat
keyword.control.import keyword.control.return keyword.control.exception keyword.operator keyword.directive keyword.function
keyword.storage keyword.storage.type keyword.storage.modifier operator function function.builtin function.method function.macro
function.special tag tag.builtin namespace special embedded`.split(/\s+/));
const TEXTOBJECTS = new Set(["function", "class", "parameter", "comment", "test", "entry", "xml-element"].flatMap((o) => [`${o}.inside`, `${o}.around`]));
const INDENTS = new Set(["indent", "indent.always", "outdent", "outdent.always", "align", "anchor", "extend", "extend.prevent-once"]);
const captures = (file) =>
  [...fs.readFileSync(file, "utf8").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/;[^\n]*/g, "").matchAll(/@([\w.-]+)/g)]
    .map((m) => m[1])
    .filter((c) => !c.startsWith("_"));
const q = (f) => path.join(dir, "queries/quillo", f);
const bad = (file, ok) => [...new Set(captures(file).filter((c) => !ok(c)))];
check("highlights use Helix's scopes", bad(q("highlights.scm"), (c) => SCOPES.has(c)).length === 0, bad(q("highlights.scm"), (c) => SCOPES.has(c)));
check("textobjects use Helix's names", bad(q("textobjects.scm"), (c) => TEXTOBJECTS.has(c)).length === 0, bad(q("textobjects.scm"), (c) => TEXTOBJECTS.has(c)));
check("indents use Helix's captures", bad(q("indents.scm"), (c) => INDENTS.has(c)).length === 0, bad(q("indents.scm"), (c) => INDENTS.has(c)));
check(
  "locals use Helix's captures",
  bad(q("locals.scm"), (c) => c === "local.scope" || c === "local.reference" || c === "local.definition" || c.startsWith("local.definition.")).length === 0
);
check(
  "injections use Helix's captures",
  bad(q("injections.scm"), (c) => c === "injection.content" || c === "injection.language").length === 0,
  bad(q("injections.scm"), (c) => c === "injection.content" || c === "injection.language")
);
// Helix takes the first pattern that matches: the general (identifier) @variable comes last.
const hl = fs.readFileSync(q("highlights.scm"), "utf8");
check("the most general pattern is last", hl.trimEnd().endsWith("(identifier) @variable"), hl.trimEnd().slice(-60));

console.log(failed ? `${failed} of ${count} Helix checks failed` : `all ${count} Helix checks passed`);
process.exit(failed ? 1 : 0);
