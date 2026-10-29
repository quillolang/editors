// Checks the Enter rules in language-configuration.json as VS Code reads them.
// Run: npm test
const path = require("path");
const config = require(path.join(__dirname, "../language-configuration.json"));

// Enter between a start tag and its end tag: the end tag goes to a line of
// its own, at the start tag's indentation, and the cursor is indented.
const rule = config.onEnterRules.find((r) => r.action.indent === "indentOutdent");
const before = new RegExp(rule.beforeText);
const after = new RegExp(rule.afterText);

// [text before the cursor, text after it, whether the rule applies]
const cases = [
  ["    <div>", "</div>", true],
  ["<li>one", "</li>", true],
  ['<a.btn.primary href="/register">', "</a>", true],
  ["<section.card class={highlight && \"hl\"}>", "</section>", true],
  ["<a href={`/p/${project.key}`}>", "</a>", true],
  ["<li.todo #todo-{todo.id}>", "</li>", true],
  ["<Card title=\"One\">", "</Card>", true],
  ["<form.inline method=\"post\" action=\"/logout\">", "  </form>", true],
  ["<p>text<br>", "</p>", false],
  ["<img/>", "</p>", false],
  ["<span.grow/>", "</div>", false],
  ["<div>", "text</div>", false],
  ["let x = a > b", "</div>", false],
];

let failed = 0;
for (const [b, a, want] of cases) {
  const got = before.test(b) && after.test(a);
  if (got !== want) {
    failed++;
    console.error(`FAIL: ${JSON.stringify(b)} | ${JSON.stringify(a)}: expected ${want}, got ${got}`);
  }
}
if (failed) {
  console.error(`${failed} of ${cases.length} Enter cases failed`);
  process.exit(1);
}
console.log(`all ${cases.length} Enter cases passed`);
