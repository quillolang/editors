// Writes Shiki's grammar from the VS Code extension's (../vscode): node build.mjs;
// --check writes nothing and fails if a file differs from what it would write.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const tm = JSON.parse(fs.readFileSync(path.join(here, "../vscode/syntaxes/quillo.tmLanguage.json"), "utf8"));

const grammar = { ...tm, name: "quillo", displayName: "Quillo", aliases: ["qwe"], embeddedLangs: ["css", "sql"] };
delete grammar.$schema;
const outputs = {
  "shiki/quillo.tmLanguage.json": JSON.stringify(grammar, null, 2) + "\n",
};

let stale = 0;
for (const [name, text] of Object.entries(outputs)) {
  const file = path.join(here, name);
  if (process.argv.includes("--check")) {
    if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== text) {
      console.log(`out of date: highlighters/${name} (run node build.mjs)`);
      stale++;
    }
  } else fs.writeFileSync(file, text);
}
process.exit(stale ? 1 : 0);
