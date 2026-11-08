// The highlight.js definition: what each part of the sample is given.
import { createRequire } from "node:module";
import { sample, checker, BUILTINS, MODULES, listIn } from "./common.mjs";

const require = createRequire(import.meta.url);
const hljs = require("highlight.js/lib/core");
hljs.registerLanguage("quillo", require("../highlightjs/quillo.js"));
const { check, done } = checker("highlight.js");

const html = hljs.highlight(sample, { language: "quillo" }).value;
const has = (cls, text) => html.includes(`<span class="hljs-${cls}">${text}</span>`);
const spans = (cls) => [...html.matchAll(new RegExp(`<span class="hljs-${cls.replace(".", "\\.")}">([^<]*)</span>`, "g"))].map((m) => m[1]);

check("the shebang", spans("meta")[0] === "#!/usr/bin/env quillo", spans("meta"));
check("a comment", has("comment", "// A comment"));
check("import is a keyword", has("keyword", "import"));
check("the import's file", has("string", "lib/forum.qwe"));
check("site starts its statement", has("keyword", "site"));
check("private starts its definition", has("keyword", "private"));
check("a function's name", has("title function_", "add"), spans("title function_"));
check("a type", has("type", "int"));
check("route, its method and its path", has("keyword", "route") && has("keyword", "GET ") && has("string", "/users/:id(int)"), spans("keyword"));
check("client is a name here", !has("keyword", "client"));
check("a builtin", has("built_in", "len"));
check("a decimal", has("number", "12.50m"));
check("a template's ${...}", html.includes('<span class="hljs-subst">${name}</span>'), html.match(/Hello[^\n]*/)?.[0]);
check("css`...`'s name", has("title function_", "css"), spans("title function_"));
check("a module", has("built_in", "db"));
check("literals", has("literal", "true") && has("literal", "null"));
check("a tag's name", has("name", "button"));
check("an event", has("attr", "@click"), spans("attr"));
check("a class on a tag", has("selector-class", ".big"));
check("build starts its statement", has("keyword", "build"));
check("accept_calls { ... }", has("built_in", "accept_calls"));
check("a new builtin", has("built_in", "classes"));
check("an HTML comment", has("comment", "&lt;!-- a note --&gt;"), html.match(/a note.{0,40}/)?.[0]);
check("a doctype", has("meta", "&lt;!DOCTYPE html&gt;"));
check("an unquoted value", has("string", "box") && has("string", "a.png"), html.match(/class.{0,80}/)?.[0]);
check("a single-quoted value", has("string", "&#x27;A cat&#x27;"), html.match(/alt.{0,60}/)?.[0]);
// `mcp` before a name on its line is the tag of a tool, and a name everywhere else (quillo
// FEEDBACK56.md, Q-853): each line alone, its spans in turn ("!" a span it has not).
const inTurn = (line, want) => {
  const got = [...hljs.highlight(line, { language: "quillo" }).value.matchAll(/<span class="hljs-([^"]+)">([^<]*)<\/span>/g)].map((m) => `${m[1]}:${m[2]}`);
  let at = 0;
  for (const w of want) {
    if (w.startsWith("!")) {
      if (got.includes(w.slice(1))) return got;
      continue;
    }
    const i = got.indexOf(w, at);
    if (i < 0) return got;
    at = i + 1;
  }
  return null;
};
for (const [line, want] of [
  ["fn mcp total_today() = 1", ["keyword:fn", "keyword:mcp", "title function_:total_today"]],
  ["public server fn mcp add_note(text: str) = text", ["keyword:public", "keyword:fn", "keyword:mcp", "title function_:add_note"]],
  ["server fn mcp add_note(text: str) = text", ["keyword:server", "keyword:fn", "keyword:mcp", "title function_:add_note"]],
  ["fn\tmcp\ttabbed() = 1", ["keyword:mcp", "title function_:tabbed"]],
  ["fn mcp mcp() = 1", ["keyword:fn", "keyword:mcp", "title function_:mcp"]],
  ["fn mcp(x) = x + 1", ["keyword:fn", "title function_:mcp", "!keyword:mcp"]],
  ["fn mcp (x) = x", ["title function_:mcp", "!keyword:mcp"]],
  ["view mcp(x) = x", ["title function_:mcp", "!keyword:mcp"]],
  ['service mcp /billing = "billing.qwe"', ["keyword:service", "keyword:mcp", "string:/billing"]],
  ['service mcp crm = "https://crm.example.com/mcp"', ["keyword:service", "keyword:mcp"]],
  ['service mcp = "mcp.qwe"', ["!keyword:mcp"]],
  ['service mcp /* note */ = "x.qwe"', ["!keyword:mcp", "comment:/* note */"]],
  ["let mcp = mcp(1)", ["!keyword:mcp"]],
  ["fn mcp", ["!keyword:mcp"]],
]) {
  const bad = inTurn(line, want);
  check(`${JSON.stringify(line)}: ${want.join(", ")}`, bad === null, bad);
}
check("the language is found by its alias", hljs.getLanguage("qwe") !== undefined);
check("the builtins are the VS Code grammar's", JSON.stringify(listIn("highlightjs/quillo.js", "BUILTINS")) === JSON.stringify(BUILTINS));
check("the modules are the VS Code grammar's", JSON.stringify(listIn("highlightjs/quillo.js", "MODULES")) === JSON.stringify(MODULES));
// Highlighting is all of the text, escaped, with nothing lost.
const text = html.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
check("every character is kept", text === sample);
done();
