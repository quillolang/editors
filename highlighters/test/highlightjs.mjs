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
check("the language is found by its alias", hljs.getLanguage("qwe") !== undefined);
check("the builtins are the VS Code grammar's", JSON.stringify(listIn("highlightjs/quillo.js", "BUILTINS")) === JSON.stringify(BUILTINS));
check("the modules are the VS Code grammar's", JSON.stringify(listIn("highlightjs/quillo.js", "MODULES")) === JSON.stringify(MODULES));
// Highlighting is all of the text, escaped, with nothing lost.
const text = html.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
check("every character is kept", text === sample);
done();
