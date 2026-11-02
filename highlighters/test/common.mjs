import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const here = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const sample = fs.readFileSync(path.join(here, "test/sample.qwe"), "utf8");
const tm = JSON.parse(fs.readFileSync(path.join(here, "../vscode/syntaxes/quillo.tmLanguage.json"), "utf8"));
export const BUILTINS = tm.repository.call.patterns[0].match.match(/\\b\((.*?)\)\\b/)[1].split("|");
export const MODULES = tm.repository["module-call"].match.match(/\\b\((.*?)\)/)[1].split("|");

export function checker(name) {
  let failed = 0;
  let count = 0;
  const check = (what, ok, got) => {
    count++;
    if (!ok) {
      failed++;
      console.log(`FAIL ${what}${got === undefined ? "" : `\n  got ${typeof got === "string" ? got : JSON.stringify(got)}`}`);
    }
  };
  const done = () => {
    console.log(failed ? `${failed} of ${count} ${name} checks failed` : `all ${count} ${name} checks passed`);
    process.exit(failed ? 1 : 0);
  };
  return { check, done };
}

/** The list a definition file holds, as written: const NAME = [ ... ]. */
export function listIn(file, name) {
  const text = fs.readFileSync(path.join(here, file), "utf8");
  const m = text.match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`));
  return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : null;
}
