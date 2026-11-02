// Shiki with the grammar: the scopes each part of the sample is given, CSS and SQL by their
// own grammars, the same as VS Code's.
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { createHighlighter } from "shiki";
import { here, sample, checker } from "./common.mjs";

const { check, done } = checker("Shiki");
const grammar = JSON.parse(fs.readFileSync(path.join(here, "shiki/quillo.tmLanguage.json"), "utf8"));
const h = await createHighlighter({ themes: ["github-dark"], langs: ["css", "sql", grammar] });
const lines = h.codeToTokensBase(sample, { lang: "quillo", theme: "github-dark", includeExplanation: true });
const parts = lines.flat().flatMap((t) => t.explanation.map((e) => ({ text: e.content, scopes: e.scopes.map((s) => s.scopeName) })));
const scoped = (text, scope) => parts.some((p) => p.text.trim() === text && p.scopes.some((s) => s.startsWith(scope)));
const scopesOf = (text) => parts.filter((p) => p.text.trim() === text).map((p) => p.scopes.slice(1).join(" "));

check("the language is quillo, alias qwe", h.getLoadedLanguages().includes("quillo") && h.getLoadedLanguages().includes("qwe"), h.getLoadedLanguages());
check("the shebang", scoped("#!/usr/bin/env quillo", "comment.line.shebang"), scopesOf("#!/usr/bin/env quillo"));
check("import", scoped("import", "keyword.other.import"), scopesOf("import"));
check("the import's file", scoped("lib/forum.qwe", "string.unquoted.path"), scopesOf("lib/forum.qwe"));
check("site", scoped("site", "keyword.other.site"), scopesOf("site"));
check("a function's name", scoped("add", "entity.name.function"), scopesOf("add"));
check("the route's method", scoped("GET", "constant.language.http-method"), scopesOf("GET"));
check("client is a name here", !scopesOf("client").some((s) => s.includes("keyword")), scopesOf("client"));
check("a builtin", scoped("len", "support.function.builtin"), scopesOf("len"));
check("a decimal", scoped("12.50m", "constant.numeric.decimal"), scopesOf("12.50m"));
// An included grammar adds its own scopes, not its name: CSS's end in .css, SQL's in .sql.
const own = (p, lang) => p.scopes.some((s) => s.endsWith("." + lang) && !s.startsWith("meta.embedded."));
check("CSS by CSS's grammar", parts.some((p) => own(p, "css") && p.text.trim() === "color"), parts.filter((p) => p.text.includes("color")).map((p) => p.scopes));
check("SQL by SQL's grammar", parts.some((p) => own(p, "sql") && /select/i.test(p.text)), parts.filter((p) => p.text.includes("select")).map((p) => p.scopes));
check("a tag", scoped("button", "entity.name.tag"), scopesOf("button"));
check("every character is kept", lines.map((l) => l.map((t) => t.content).join("")).join("\n") === sample);
// The grammar is the VS Code extension's, with Shiki's name, aliases and embedded languages.
const vs = JSON.parse(fs.readFileSync(path.join(here, "../vscode/syntaxes/quillo.tmLanguage.json"), "utf8"));
const { name, displayName, aliases, embeddedLangs, ...rest } = grammar;
delete vs.$schema;
let same = true;
try {
  assert.deepStrictEqual({ ...rest, name: vs.name }, vs);
} catch {
  same = false;
}
check("the grammar is VS Code's", same);
check("Shiki's fields", name === "quillo" && displayName === "Quillo" && aliases[0] === "qwe" && embeddedLangs.join() === "css,sql");
done();
