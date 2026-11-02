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
check("the alias qwe", Prism.languages.qwe === Prism.languages.quillo);
check("the builtins are the VS Code grammar's", JSON.stringify(listIn("prism/prism-quillo.js", "BUILTINS")) === JSON.stringify(BUILTINS));
check("the modules are the VS Code grammar's", JSON.stringify(listIn("prism/prism-quillo.js", "MODULES")) === JSON.stringify(MODULES));
check("every character is kept", toks.map(([, t]) => t).join("") === sample);
done();
