// The Prism definition: what each part of the sample is given.
import { createRequire } from "node:module";
import { sample, checker, BUILTINS, MODULES, listIn } from "./common.mjs";

const require = createRequire(import.meta.url);
const Prism = require("prismjs");
require("../prism/prism-quillo.js")(Prism);
const { check, done } = checker("Prism");

/** [type path, text] for every token, the types of the tokens it is inside first. */
function flat(tokens, outer = []) {
  const out = [];
  for (const t of tokens) {
    if (typeof t === "string") out.push([outer.join(" "), t]);
    else {
      const types = [...outer, t.type, ...(t.alias ? [].concat(t.alias) : [])];
      if (typeof t.content === "string") out.push([types.join(" "), t.content]);
      else out.push(...flat([].concat(t.content), types));
    }
  }
  return out;
}
const toks = flat(Prism.tokenize(sample, Prism.languages.quillo));
const is = (type, text) => toks.some(([ty, tx]) => tx === text && ty.split(" ").includes(type));
const typesOf = (text) => toks.filter(([, tx]) => tx === text).map(([ty]) => ty);

check("the shebang", is("shebang", "#!/usr/bin/env quillo"), typesOf("#!/usr/bin/env quillo"));
check("a comment", is("comment", "// A comment"));
check("import is a keyword", is("keyword", "import"), typesOf("import"));
check("the import's file", is("path", "lib/forum.qwe"), typesOf("lib/forum.qwe"));
check("site starts its statement", is("keyword", "site"), typesOf("site"));
check("a function's name", is("function", "add"), typesOf("add"));
check("route, its method and its path", is("keyword", "route") && is("method", "GET") && is("path", "/users/:id(int)"), [typesOf("route"), typesOf("GET")]);
check("client is a name here", !typesOf("client").some((t) => t.includes("keyword")), typesOf("client"));
check("a builtin", is("builtin", "len"), typesOf("len"));
check("a decimal", is("number", "12.50m"), typesOf("12.50m"));
check("a template's ${...} is code", is("interpolation-punctuation", "${") && toks.some(([ty, tx]) => tx === "name" && ty.includes("interpolation")), typesOf("${"));
check("css`...`'s name", is("template-tag", "css"), typesOf("css"));
check("a module", is("module", "db"), typesOf("db"));
check("literals", is("boolean", "true") && is("null", "null"));
check("a tag's name", is("tag-name", "button"), typesOf("button"));
check("an event", toks.some(([ty, tx]) => ty.includes("attr-name") && tx.trim() === "@click"), toks.filter(([ty]) => ty.includes("attr-name")));
check("code in an attribute", toks.some(([ty, tx]) => ty.includes("attr-value") && tx.trim() === "count") && toks.some(([ty, tx]) => ty.includes("attr-value") && tx === "+="), toks.filter(([ty]) => ty.includes("attr-value")).slice(0, 6));
check("a component's name is a class", is("class-name", "Counter") || is("function", "Counter"), typesOf("Counter"));
check("build starts its statement", is("build", "build"), typesOf("build"));
check("accept_calls { ... }", is("accept-calls", "accept_calls"), typesOf("accept_calls"));
check("a new builtin", is("builtin", "classes"), typesOf("classes"));
check("an HTML comment", is("comment", "<!-- a note -->"), typesOf("<!-- a note -->"));
check("a doctype", is("doctype", "<!DOCTYPE html>"), typesOf("<!DOCTYPE html>"));
check("an unquoted value", toks.some(([ty, tx]) => ty.includes("attr-value") && ty.includes("string") && tx === "box") && toks.some(([ty, tx]) => ty.includes("string") && tx === "a.png"), toks.filter(([ty]) => ty.includes("attr-value")).slice(-8));
check("a single-quoted value", toks.some(([ty, tx]) => ty.includes("string") && tx === "'A cat'"), toks.filter(([ty]) => ty.includes("attr-value")).slice(-8));
check("/> after an unquoted value closes the tag", toks.some(([ty, tx]) => ty.includes("tag") && ty.includes("punctuation") && tx === "/>"));
// `mcp` before a name on its line is the tag of a tool, and a name everywhere else (quillo
// FEEDBACK56.md, Q-853): each line alone, its tokens in turn ("!" a token it has not).
const inTurn = (line, want) => {
  const got = flat(Prism.tokenize(line, Prism.languages.quillo)).filter(([, tx]) => tx.trim());
  const has = (k, w) => {
    const [type, text] = [w.slice(0, w.indexOf(":")), w.slice(w.indexOf(":") + 1)];
    return got[k][1].trim() === text && got[k][0].split(" ").includes(type);
  };
  let at = 0;
  for (const w of want) {
    if (w.startsWith("!")) {
      if (got.some((_, k) => has(k, w.slice(1)))) return got;
      continue;
    }
    const i = got.findIndex((_, k) => k >= at && has(k, w));
    if (i < 0) return got;
    at = i + 1;
  }
  return null;
};
for (const [line, want] of [
  ["fn mcp total_today() = 1", ["keyword:fn", "keyword:mcp", "function:total_today"]],
  ["public server fn mcp add_note(text: str) = text", ["keyword:public", "keyword:server", "keyword:fn", "keyword:mcp", "function:add_note"]],
  ["fn\tmcp\ttabbed() = 1", ["keyword:mcp", "function:tabbed"]],
  ["fn mcp mcp() = 1", ["keyword:fn", "keyword:mcp", "function:mcp"]],
  ["fn mcp(x) = x + 1", ["keyword:fn", "function:mcp", "!keyword:mcp"]],
  ["fn mcp (x) = x", ["function:mcp", "!keyword:mcp"]],
  ["view mcp(x) = x", ["function:mcp", "!keyword:mcp"]],
  ["view mcp Card() = 1", ["keyword:mcp", "function:Card"]],
  ['service mcp /billing = "billing.qwe"', ["keyword:service", "keyword:mcp", "path:/billing"]],
  ['service mcp crm = "https://crm.example.com/mcp"', ["keyword:service", "keyword:mcp"]],
  ['service mcp = "mcp.qwe"', ["!keyword:mcp"]],
  ['service mcp /* note */ = "x.qwe"', ["!keyword:mcp", "comment:/* note */"]],
  ["let mcp = mcp(1)", ["!keyword:mcp"]],
  ["fn mcp", ["!keyword:mcp"]],
]) {
  const bad = inTurn(line, want);
  check(`${JSON.stringify(line)}: ${want.join(", ")}`, bad === null, bad);
}
check("the alias qwe", Prism.languages.qwe === Prism.languages.quillo);
check("the builtins are the VS Code grammar's", JSON.stringify(listIn("prism/prism-quillo.js", "BUILTINS")) === JSON.stringify(BUILTINS));
check("the modules are the VS Code grammar's", JSON.stringify(listIn("prism/prism-quillo.js", "MODULES")) === JSON.stringify(MODULES));
check("every character is kept", toks.map(([, t]) => t).join("") === sample);
done();
