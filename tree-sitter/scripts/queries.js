// Writes each editor's copy of the queries in ../queries, which use Neovim's capture
// names, in the names and order that editor reads: node scripts/queries.js
// With --check it writes nothing and fails if a copy differs from what it would write.
//
//   ../neovim/queries/quillo/   as they are
//   ../helix/queries/quillo/    Helix's names; the first pattern that matches wins there,
//                               so the highlight patterns go in the other order
//   ../zed/languages/quillo/    Zed's theme keys
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const repo = path.join(root, "..");
const read = (name) => fs.readFileSync(path.join(root, "queries", name), "utf8");

/** The query's patterns, each with the comment lines just above it. */
function patterns(text) {
  const out = [];
  let lead = [];
  let cur = null;
  let depth = 0;
  for (const line of text.split("\n")) {
    if (cur === null) {
      if (line.startsWith(";") || line.trim() === "") {
        if (line.trim() !== "") lead.push(line);
        else if (lead.length && !lead[lead.length - 1].startsWith(";")) lead = [];
        continue;
      }
      cur = [...lead];
      lead = [];
    }
    cur.push(line);
    for (const c of line.replace(/"(?:[^"\\]|\\.)*"/g, "").replace(/;.*$/, "")) {
      if (c === "(" || c === "[") depth++;
      if (c === ")" || c === "]") depth--;
    }
    if (depth === 0) {
      out.push(cur.join("\n"));
      cur = null;
    }
  }
  return out;
}

/** Renames captures by `map` (longest name first); a capture mapped to null drops its pattern. */
function rename(pattern, map) {
  let dropped = false;
  const text = pattern.replace(/@([\w.]+)/g, (all, name) => {
    if (name.startsWith("_") || name.startsWith("injection.") || name.startsWith("local.")) return all;
    if (!(name in map)) return all;
    if (map[name] === null) {
      dropped = true;
      return all;
    }
    return "@" + map[name];
  });
  return dropped ? null : text.replace(/ @spell/g, "");
}

const HEADER = (editor) =>
  `; Made from tree-sitter/queries by tree-sitter/scripts/queries.js, in ${editor}'s capture names: change those, then run it.\n\n`;

const HELIX = {
  "keyword.import": "keyword.control.import",
  "keyword.conditional": "keyword.control.conditional",
  "keyword.repeat": "keyword.control.repeat",
  "keyword.return": "keyword.control.return",
  "keyword.modifier": "keyword.storage.modifier",
  "keyword.type": "keyword.storage.type",
  "variable.member": "variable.other.member",
  "function.call": "function",
  "function.method.call": "function.method",
  "module.builtin": "namespace",
  module: "namespace",
  "type.definition": "type",
  boolean: "constant.builtin.boolean",
  number: "constant.numeric",
  "string.escape": "constant.character.escape",
  "character.special": "special",
  "tag.attribute": "attribute",
  "tag.delimiter": "punctuation.bracket",
  none: null,
};

const ZED = {
  "variable.member": "property",
  "variable.parameter": "variable.parameter",
  "function.call": "function",
  "function.method.call": "function.method",
  "function.macro": "function.special",
  "module.builtin": "type",
  module: "type",
  "type.definition": "type",
  "string.special.url": "link_uri",
  "string.special.path": "string.special",
  "character.special": "punctuation.special",
  "keyword.directive": "preproc",
  "tag.attribute": "attribute",
  "tag.delimiter": "punctuation.bracket",
  none: null,
};

function translate(text, map, reverse) {
  const ps = patterns(text).map((p) => rename(p, map)).filter((p) => p !== null);
  return (reverse ? ps.reverse() : ps).join("\n\n") + "\n";
}

const strip = (text) => text.replace(/^(; [^\n]*\n)+\n/, "");

function helixLocals(text) {
  return text
    .replace(/@local\.definition\.parameter/g, "@local.definition.variable.parameter")
    .replace(/@local\.definition\.\w+/g, (m) => (m === "@local.definition.variable" ? m : m.includes("variable.parameter") ? m : "@local.definition"));
}

function helixIndents(text) {
  return text
    .replace(/@indent\.begin/g, "@indent")
    .replace(/@indent\.end @indent\.branch/g, "@outdent")
    .replace(/@indent\.branch/g, "@outdent")
    .replace(/\n\[\n  \(comment\)\n  \(template_string\)\n\] @indent\.auto\n/, "\n");
}

const ZED_INDENTS = `(_
  "{" "}" @end) @indent

(_
  "[" "]" @end) @indent

(_
  "(" ")" @end) @indent

(element
  (start_tag)
  (end_tag) @end) @indent
`;

const ZED_BRACKETS = `("(" @open ")" @close)
("[" @open "]" @close)
("{" @open "}" @close)
(start_tag "<" @open ">" @close)
(end_tag "</" @open ">" @close)
(("\\"" @open "\\"" @close) (#set! rainbow.exclude))
(("\`" @open "\`" @close) (#set! rainbow.exclude))
`;

const ZED_OUTLINE = `(function_definition
  (server)? @context
  ["fn" "view"] @context
  (mcp)? @context
  name: (identifier) @name) @item

(component_definition
  "component" @context
  (mcp)? @context
  name: (identifier) @name) @item

(type_definition
  "type" @context
  name: (type_identifier) @name) @item

(route
  "route" @context
  method: (http_method) @name
  path: (route_path) @name) @item

(route_group
  "routes" @context
  path: (route_path) @name) @item

(let_declaration
  "let" @context
  pattern: (identifier) @name) @item

(state_declaration
  name: (identifier) @name) @item
`;

const outputs = {
  "neovim/queries/quillo": {
    "highlights.scm": read("highlights.scm"),
    "injections.scm": read("injections.scm"),
    "locals.scm": read("locals.scm"),
    "folds.scm": read("folds.scm"),
    "indents.scm": read("indents.scm"),
  },
  "helix/queries/quillo": {
    "highlights.scm": HEADER("Helix") + translate(strip(read("highlights.scm")), HELIX, true),
    "injections.scm": HEADER("Helix") + strip(read("injections.scm")),
    "locals.scm": HEADER("Helix") + helixLocals(read("locals.scm")),
    "indents.scm": HEADER("Helix") + helixIndents(read("indents.scm")),
  },
  "zed/languages/quillo": {
    "highlights.scm": HEADER("Zed") + translate(strip(read("highlights.scm")), ZED, false),
    "injections.scm": HEADER("Zed") + strip(read("injections.scm")).replace(/\n\(\(comment\) @injection\.content\n  \(#set! injection\.language "comment"\)\)\n/, "\n"),
    "indents.scm": HEADER("Zed") + ZED_INDENTS,
    "brackets.scm": HEADER("Zed") + ZED_BRACKETS,
    "outline.scm": HEADER("Zed") + ZED_OUTLINE,
  },
};

const check = process.argv.includes("--check");
let stale = 0;
for (const [dir, files] of Object.entries(outputs)) {
  const full = path.join(repo, dir);
  // An editor's folder is on its own branch: only the folders there are written.
  if (!fs.existsSync(path.dirname(full.replace(/\/quillo$/, "")))) continue;
  for (const [name, text] of Object.entries(files)) {
    const file = path.join(full, name);
    if (check) {
      if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== text) {
        console.log(`out of date: ${path.relative(repo, file)} (run node tree-sitter/scripts/queries.js)`);
        stale++;
      }
    } else {
      fs.mkdirSync(full, { recursive: true });
      fs.writeFileSync(file, text);
    }
  }
}
if (check && stale) process.exit(1);
module.exports = { patterns, rename, translate, outputs };
