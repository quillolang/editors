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
// `mcp` before a name on its line is the tag of a tool, and a name everywhere else (quillo
// FEEDBACK56.md, Q-853): the sample's lines, each word's last scope in turn.
const line = (start) => {
  const n = sample.split("\n").findIndex((l) => l.startsWith(start));
  return lines[n].flatMap((t) => t.explanation.map((e) => [e.content.trim(), e.scopes.at(-1).scopeName])).filter(([t]) => t);
};
const tool = "storage.modifier.mcp.quillo";
check("server fn mcp's tag and name", JSON.stringify(line("public server fn mcp").slice(0, 5)) === JSON.stringify([["public", "storage.modifier.visibility.quillo"], ["server", "storage.modifier.server.quillo"], ["fn", "storage.type.function.quillo"], ["mcp", tool], ["add_note", "entity.name.function.quillo"]]), line("public server fn mcp"));
check("fn mcp mcp(): the tag, then the name", JSON.stringify(line("fn mcp mcp()").slice(1, 3)) === JSON.stringify([["mcp", tool], ["mcp", "entity.name.function.quillo"]]), line("fn mcp mcp()"));
check("fn mcp(x) names a function", JSON.stringify(line("fn mcp(x)")[1]) === JSON.stringify(["mcp", "entity.name.function.quillo"]), line("fn mcp(x)"));
check("service mcp /billing's tag", JSON.stringify(line("service mcp /billing")[1]) === JSON.stringify(["mcp", tool]), line("service mcp /billing"));
check("service mcp crm's tag", JSON.stringify(line("service mcp crm")[1]) === JSON.stringify(["mcp", tool]), line("service mcp crm"));
check("service mcp = ... names a service", !line('service mcp = "').some(([, s]) => s === tool), line('service mcp = "'));
check("service mcp /* note */ names a service", !line("service mcp /*").some(([, s]) => s === tool), line("service mcp /*"));
// FEEDBACK56: `/* */` is a comment, over lines too (it was code), but a wildcard in a group's path;
// `//!` and `///` are comments; a tool's questions and the door's tokens are builtins.
check("service mcp /* note */'s comment", line("service mcp /*").some(([t, s]) => t === "note" && s === "comment.block.quillo"), line("service mcp /*"));
check("a block comment over lines", line("let gone").some(([t, s]) => t === "a block" && s === "comment.block.quillo") && line("   comment */").some(([t, s]) => t === "comment" && s === "comment.block.quillo"), [line("let gone"), line("   comment */")]);
check("code after the block comment", line("   comment */").some(([t, s]) => t === "confirm" && s === "support.function.builtin.quillo"), line("   comment */"));
check("revoke_mcp_token is a builtin", scoped("revoke_mcp_token", "support.function.builtin"), scopesOf("revoke_mcp_token"));
check("routes /*x is a path", line("routes /*x").some(([t, s]) => t === "*" && s === "keyword.operator.wildcard.quillo") && !line("routes /*x").some(([, s]) => s.startsWith("comment")), line("routes /*x"));
check("//! is a comment", scoped("//! Notes are private to the user who wrote them.", "comment.line"), scopesOf("//! Notes are private to the user who wrote them."));
check("/// is a comment", scoped("/// Adds a note.", "comment.line"), scopesOf("/// Adds a note."));
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
