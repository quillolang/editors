// Tokenizes Quillo with VS Code's TextMate engine and checks key scopes.
// Run: npm test
const fs = require("fs");
const path = require("path");
const vsctm = require("vscode-textmate");
const oniguruma = require("vscode-oniguruma");

const wasm = fs.readFileSync(require.resolve("vscode-oniguruma/release/onig.wasm")).buffer;
const onigLib = oniguruma.loadWASM(wasm).then(() => ({
  createOnigScanner: (s) => new oniguruma.OnigScanner(s),
  createOnigString: (s) => new oniguruma.OnigString(s),
}));
// SQL in strings is tokenized with VS Code's own SQL grammar, where it can be
// found; without it, only the embedded scope around it is checked.
const sqlGrammar = [
  process.env.VSCODE_SQL_GRAMMAR,
  "/Applications/Visual Studio Code.app/Contents/Resources/app/extensions/sql/syntaxes/sql.tmLanguage.json",
  "/usr/share/code/resources/app/extensions/sql/syntaxes/sql.tmLanguage.json",
].find((p) => p && fs.existsSync(p));
const grammars = {
  "source.quillo": path.join(__dirname, "../syntaxes/quillo.tmLanguage.json"),
  "source.sql": sqlGrammar,
};
const registry = new vsctm.Registry({
  onigLib,
  loadGrammar: async (scope) => grammars[scope] && vsctm.parseRawGrammar(fs.readFileSync(grammars[scope], "utf8"), grammars[scope]),
});

// [line, token text, scope that token must have]
const cases = [
  ['route GET /users/:id(int) = find_user(id)', "route", "keyword.other.route.quillo"],
  ['route GET /users/:id(int) = find_user(id)', "GET", "constant.language.http-method.quillo"],
  ['route GET /users/:id(int) = find_user(id)', "id", "variable.parameter.path.quillo"],
  ['route GET /users/:id(int) = find_user(id)', "int", "support.type.quillo"],
  ['route GET /users/:id(int) = find_user(id)', "find_user", "entity.name.function.call.quillo"],
  ['fn add(a: int, b: int = 10) -> int = a + b', "add", "entity.name.function.quillo"],
  ['fn add(a: int, b: int = 10) -> int = a + b', "10", "constant.numeric.integer.quillo"],
  ['fn parse(s: str) -> int ! str with db, http = 1', "with", "keyword.other.with.quillo"],
  ['fn parse(s: str) -> int ! str with db, http = 1', "db, http", "support.constant.effect.quillo"],
  ['server fn save(text: str) = text', "server", "storage.modifier.server.quillo"],
  ['private fn page_of(n: int) = n', "private", "storage.modifier.visibility.quillo"],
  ['private fn page_of(n: int) = n', "page_of", "entity.name.function.quillo"],
  ['public view Post(p: map) = <b/>', "public", "storage.modifier.visibility.quillo"],
  ['private let PAGE = 20', "private", "storage.modifier.visibility.quillo"],
  ['let o = { private: true }', "private", "variable.other.quillo"],
  ['server fn save(text: str) = text', "save", "entity.name.function.quillo"],
  ['component Counter(start: int = 0) {', "Counter", "entity.name.type.component.quillo"],
  ['    ~count = start', "count", "variable.other.state.quillo"],
  ['    state count = start', "state", "storage.type.quillo"],
  ['    state count = start', "count", "variable.other.state.quillo"],
  ['type User = { name: str }', "type", "storage.type.quillo"],
  ['let tiny = 1e-9 + 2.5E3', "1e-9", "constant.numeric.float.quillo"],
  ['let tiny = 1e-9 + 2.5E3', "2.5E3", "constant.numeric.float.quillo"],
  ['let price = 12.50m * 3 + 5m', "12.50m", "constant.numeric.decimal.quillo"],
  ['let price = 12.50m * 3 + 5m', "5m", "constant.numeric.decimal.quillo"],
  ['let price = 12.50m * 3 + 5m', "3", "constant.numeric.integer.quillo"],
  ['fn fee(a: dec) -> dec = a', "dec", "support.type.quillo"],
  ['let m = money.of(12.50m, "USD")', "money", "support.module.quillo"],
  ['let style = css`a > b { color: ${accent}; }`', "css", "support.function.tag.quillo"],
  ['let style = css`a > b { color: ${accent}; }`', "a > b { color: ", "meta.embedded.block.css"],
  ['let style = css`a > b { color: ${accent}; }`', "accent", "meta.template.expression.quillo"],
  ['let style = css`a > b { color: ${accent}; }`', "${", "punctuation.definition.template-expression.begin.quillo"],
  ['let rows = db.query(sql`select * from t where id = ?`, id)', "from", "meta.embedded.block.sql"],
  ['let greeting = `Hello, ${name}!`', "greeting", "variable.other.declaration.quillo"],
  ['let greeting = `Hello, ${name}!`', "Hello, ", "string.template.quillo"],
  ['let greeting = `Hello, ${name}!`', "name", "meta.template.expression.quillo"],
  ['let plain = "no {interp} here"', "no {interp} here", "string.quoted.double.quillo"],
  ["let s = 'single'", "single", "string.quoted.single.quillo"],
  ['let e = "a \\" b"', '\\"', "constant.character.escape.quillo"],
  ['let e = "caf\\u00e9"', "\\u00e9", "constant.character.escape.quillo"],
  ['let e = `\\u{1F600} ${n}`', "\\u{1F600}", "constant.character.escape.quillo"],
  ['let q = url_encode({ q, page })', "url_encode", "support.function.builtin.quillo"],
  ['<li.todo #todo-{t.id} class={x}>text</li>', "li", "entity.name.tag.quillo"],
  ['<li.todo #todo-{t.id} class={x}>text</li>', ".todo", "entity.other.attribute-name.class.quillo"],
  ['<li.todo #todo-{t.id} class={x}>text</li>', "class", "entity.other.attribute-name.quillo"],
  ['<li.todo #todo-{t.id} class={x}>text</li>', "text", "meta.jsx.children.quillo"],
  ['<p>if you want, return {count} for null</p>', "if you want, return ", "meta.jsx.children.quillo"],
  ['<p>Fish &amp; chips</p>', "&amp;", "constant.character.entity.quillo"],
  ['<p>a <b>{n}</b> c</p>', "b", "entity.name.tag.quillo"],
  ['<button @click={() => { count += 1 }}>+</button>', "click", "entity.other.attribute-name.event.quillo"],
  ['<button @click={() => { count += 1 }}>+</button>', "+=", "keyword.operator.assignment.quillo"],
  ['<button @click={() => { count += 1 }}>+</button>', "=>", "storage.type.function.arrow.quillo"],
  ['<input bind:value={draft}/>', "bind", "keyword.other.bind.quillo"],
  ['<Card title="x"/>', "Card", "entity.name.type.component.quillo"],
  ['<Card {...node.props} {title}/>', "...", "keyword.operator.spread.quillo"],
  ['orders | filter(o => o.total > 100 && o.ok) ?? []', "|", "keyword.operator.pipe.quillo"],
  ['orders | filter(o => o.total > 100 && o.ok) ?? []', "??", "keyword.operator.coalesce.quillo"],
  ['orders | filter(o => o.total > 100 && o.ok) ?? []', "&&", "keyword.operator.logical.quillo"],
  ['orders | filter(o => o.total > 100 && o.ok) ?? []', "o", "variable.parameter.quillo"],
  ['orders | filter(o => o.total > 100 && o.ok) ?? []', "filter", "support.function.builtin.quillo"],
  ['let name = user.name || "anonymous"', "||", "keyword.operator.logical.quillo"],
  ['let rows = db.query("select 1")', "db", "support.module.quillo"],
  ['let rows = db.query("select 1")', "query", "support.function.quillo"],
  ['let size = n > 0 ? "pos" : null // done', "?", "keyword.operator.ternary.quillo"],
  ['let size = n > 0 ? "pos" : null // done', "null", "constant.language.quillo"],
  ['let size = n > 0 ? "pos" : null // done', "// done", "comment.line.double-slash.quillo"],
  ['if !ok { return 1 }', "if", "keyword.control.quillo"],
  ['while i < n { i += 1 }', "while", "keyword.control.quillo"],
  ['if !ok { return 1 }', "!", "keyword.operator.logical.quillo"],
  ['match e { { type: "click", x: int } => x }', "int", "support.type.pattern.quillo"],
  ['let v = request.json', "request", "variable.language.request.quillo"],
  // UDP, channels and media.
  ['udp.listen(9000, (p) => udp.reply(p, "ok"))', "udp", "support.module.quillo"],
  ['udp.listen(9000, (p) => udp.reply(p, "ok"))', "listen", "support.function.quillo"],
  ['udp.listen(9000, (p) => udp.reply(p, "ok"))', "reply", "support.function.quillo"],
  ['channel.broadcast("game", msg, { except: peer })', "channel", "support.module.quillo"],
  ['channel.broadcast("game", msg, { except: peer })', "broadcast", "support.function.quillo"],
  ['let game = channel.open("game", (m) => { last = m })', "open", "support.function.quillo"],
  ['media.rtp("cam", { video: 5004, audio: 5006 })', "media", "support.module.quillo"],
  ['media.rtp("cam", { video: 5004, audio: 5006 })', "rtp", "support.function.quillo"],
  ['let r = math.sqrt(2)', "math", "support.module.quillo"],
  ['let due = date.add_business_days(d, 2, cal)', "date", "support.module.quillo"],
  ['let due = date.add_business_days(d, 2, cal)', "add_business_days", "support.function.quillo"],
  ['let m = re.find_all(s, "@(\\\\w+)")', "re", "support.module.quillo"],
  ['fn ping(h: str) with net = udp.send(h, 9, "x")', "net", "support.constant.effect.quillo"],
  ['<quillo-media stream="cam" controls/>', "quillo-media", "entity.name.tag.quillo"],
  ['<quillo-media stream="cam" controls/>', "stream", "entity.other.attribute-name.quillo"],
  ['    every(1000, tick)', "every", "support.function.builtin.quillo"],
  ['    listen("/progress", (p) => { done = p.done })', "listen", "support.function.builtin.quillo"],
  ['route GET /feed = events((send) => send(1))', "events", "support.function.builtin.quillo"],
  ['route POST /pay = idempotent(() => pay())', "idempotent", "support.function.builtin.quillo"],
  // Types: what is inside `list<...>` is a type, not an HTML tag.
  ['fn titles(posts: list<{ id: int, title: str }>) = posts | map((p) => p.title)', "list", "support.type.quillo"],
  ['fn titles(posts: list<{ id: int, title: str }>) = posts | map((p) => p.title)', "id", "variable.other.property.quillo"],
  ['fn titles(posts: list<{ id: int, title: str }>) = posts | map((p) => p.title)', "str", "support.type.quillo"],
  ['fn titles(posts: list<{ id: int, title: str }>) = posts | map((p) => p.title)', "map", "support.function.builtin.quillo"],
  ['fn names(xs: list<str>) -> list<str> = xs', "str", "support.type.quillo"],
  ['fn names(xs: list<str>) -> list<str> = xs', "str", "meta.type.parameters.quillo"],
  ['fn kids(n: Node) -> list<Node> = n.kids', "Node", "entity.name.type.quillo"],
  ['fn f(m: map<str, list<int>>) = m', "int", "support.type.quillo"],
  ['fn f(m: map<str, list<int?>>) = m', "?", "keyword.operator.type.optional.quillo"],
  ['type Tree = { value: int, kids: list<Node> = [] }', "Tree", "entity.name.type.quillo"],
  ['type Tree = { value: int, kids: list<Node> = [] }', "Node", "entity.name.type.quillo"],
  ['type Ids = list<int | str>', "|", "keyword.operator.type.union.quillo"],
  ['type Ids = list<int | str>', "int", "support.type.quillo"],
  ['fn greet(u: User) -> Greeting = hi(u)', "User", "entity.name.type.quillo"],
  ['fn greet(u: User) -> Greeting = hi(u)', "Greeting", "entity.name.type.quillo"],
  ['type User = { name: str, role: "admin" | "member" = "member", tags: list<str> = [] }', "role", "variable.other.property.quillo"],
  ['type User = { name: str, role: "admin" | "member" = "member", tags: list<str> = [] }', "tags", "variable.other.property.quillo"],
  ['let n = int(s) + len(xs | map((x) => x))', "int", "support.function.builtin.quillo"],
  // ...while a tag in an expression stays one.
  ['let rows = list.map((x) => <li>{x}</li>)', "li", "entity.name.tag.quillo"],
  ['let n = <span.badge>{len(list)}</span>', "span", "entity.name.tag.quillo"],  // use: a path with or without quotes, names taken from a .qwer file, `as` and `*`.
  ['use lib/auth', "use", "keyword.other.use.quillo"],
  ['use lib/auth', "lib/auth", "string.unquoted.path.quillo"],
  ['use ../shared/auth.qwe', "../shared/auth.qwe", "string.unquoted.path.quillo"],
  ['use lib\\auth', "lib\\auth", "string.unquoted.path.quillo"],
  ['use "lib/auth.qwe"', "lib/auth.qwe", "string.quoted.double.quillo"],
  ['use cache_get as redis_get, cache_set from redis.qwer', "cache_get", "entity.name.function.quillo"],
  ['use cache_get as redis_get, cache_set from redis.qwer', "as", "keyword.other.as.quillo"],
  ['use cache_get as redis_get, cache_set from redis.qwer', "redis_get", "entity.name.function.quillo"],
  ['use cache_get as redis_get, cache_set from redis.qwer', "cache_set", "entity.name.function.quillo"],
  ['use cache_get as redis_get, cache_set from redis.qwer', "from", "keyword.other.from.quillo"],
  ['use cache_get as redis_get, cache_set from redis.qwer', "redis.qwer", "string.unquoted.path.quillo"],
  ['use * from lib/auth', "*", "constant.language.wildcard.quillo"],
  ['use * from lib/auth', "lib/auth", "string.unquoted.path.quillo"],
  ['use lib/auth // the login', "the login", "comment.line.double-slash.quillo"],
  // SQL: the first argument of db.exec, db.one and db.query, and sql`...`; the
  // rest of the call is Quillo again.
  ['if db.one("select count(*) as n from users").n > 0 { return null }', "users", "meta.embedded.block.sql"],
  ['if db.one("select count(*) as n from users").n > 0 { return null }', "db", "support.module.quillo"],
  ['if db.one("select count(*) as n from users").n > 0 { return null }', "0", "constant.numeric.integer.quillo"],
  ['db.exec("update projects set created = ? where id = ?", begin, pid)', "projects", "meta.embedded.block.sql"],
  ['db.exec("update projects set created = ? where id = ?", begin, pid)', "pid", "variable.other.quillo"],
  ['db.exec("insert into notes (body) values (\\"hi\\")", x)', "\\\"", "constant.character.escape.quillo"],
  ['let rows = db.query(`select * from t where id = ${id}`)', "${", "punctuation.definition.template-expression.begin.quillo"],
  ['let rows = db.query(`select * from t where id = ${id}`)', "from", "meta.embedded.block.sql"],
  ['let rows = db.query(sql`select 1`)', "sql", "support.function.tag.quillo"],
  ['let rows = db.query(sql`select 1`)', "select", "meta.embedded.block.sql"],
];

// Lines tokenized in turn: [lines, line index, token text, scope]. A type
// with `<` must not leave the lines after it inside a tag.
const blocks = [
  [["fn titles(posts: list<{ id: int, title: str }>) = posts", "view Home() = <div class=\"a\">{titles([])}</div>", "let after = 1"], 1, "div", "entity.name.tag.quillo"],
  [["fn titles(posts: list<{ id: int, title: str }>) = posts", "view Home() = <div class=\"a\">{titles([])}</div>", "let after = 1"], 2, "let", "storage.type.let.quillo"],
  [["type Node = {", "    value: int,", "    kids: list<Node> = [],", "}", "let x = <p>hi</p>"], 2, "kids", "variable.other.property.quillo"],
  [["type Node = {", "    value: int,", "    kids: list<Node> = [],", "}", "let x = <p>hi</p>"], 4, "p", "entity.name.tag.quillo"],
  [["fn f(m: map<str, list<int>>) -> list<str> = []", "let y = 2"], 1, "2", "constant.numeric.integer.quillo"],
  [["let t = <h1>Virtual list</h1>", "let y = 2"], 1, "2", "constant.numeric.integer.quillo"],
  // The SQL string may start on the line after db.query(.
  [["for t in db.query(", "    \"select * from tasks where id = ?\", pid) {", "}", "let after = 1"], 1, "tasks", "meta.embedded.block.sql"],
  [["for t in db.query(", "    \"select * from tasks where id = ?\", pid) {", "}", "let after = 1"], 3, "let", "storage.type.let.quillo"],
];

(async () => {
  const grammar = await registry.loadGrammar("source.quillo");
  let failed = 0;
  for (const [line, text, scope] of cases) {
    const { tokens } = grammar.tokenizeLine(line, vsctm.INITIAL);
    const tok = tokens.find((t) => line.slice(t.startIndex, t.endIndex) === text)
      || tokens.find((t) => line.slice(t.startIndex, t.endIndex).includes(text));
    const scopes = tok ? tok.scopes : [];
    if (!scopes.includes(scope)) {
      failed++;
      console.log(`FAIL ${JSON.stringify(text)} in ${JSON.stringify(line)}\n  want ${scope}\n  got  ${scopes.join(" ")}`);
    }
  }
  for (const [lines, n, text, scope] of blocks) {
    let state = vsctm.INITIAL;
    let toks = [];
    lines.forEach((line, i) => {
      const r = grammar.tokenizeLine(line, state);
      state = r.ruleStack;
      if (i === n) toks = r.tokens.map((t) => ({ text: line.slice(t.startIndex, t.endIndex), scopes: t.scopes }));
    });
    const tok = toks.find((t) => t.text === text) || toks.find((t) => t.text.includes(text));
    if (!tok || !tok.scopes.includes(scope) || state.depth > 1) {
      failed++;
      console.log(`FAIL ${JSON.stringify(text)} on line ${n + 1} of ${JSON.stringify(lines)}\n  want ${scope}${state.depth > 1 ? " (and the state is still nested at the end)" : ""}\n  got  ${tok ? tok.scopes.join(" ") : "(no token)"}`);
    }
  }
  // With VS Code's SQL grammar: keywords and strings inside the SQL.
  const sqlCases = [
    ['db.exec("insert into members (role) values (\'editor\')")', "insert", "keyword.other.DML.sql"],
    ['db.exec("insert into members (role) values (\'editor\')")', "editor", "string.quoted.single.sql"],
    ['let n = db.one("select count(*) as n from users where id = ?", id).n', "select", "keyword.other.DML.sql"],
    ['let n = db.one("select count(*) as n from users where id = ?", id).n', "id", "variable.other.quillo"],
  ];
  if (!sqlGrammar) console.log("skipped the SQL cases: no VS Code SQL grammar found (VSCODE_SQL_GRAMMAR)");
  for (const [line, text, scope] of sqlGrammar ? sqlCases : []) {
    const { tokens } = grammar.tokenizeLine(line, vsctm.INITIAL);
    const all = tokens.filter((t) => line.slice(t.startIndex, t.endIndex) === text);
    const tok = scope.endsWith(".quillo") ? all[all.length - 1] : all[0] || tokens.find((t) => line.slice(t.startIndex, t.endIndex).includes(text));
    if (!tok || !tok.scopes.includes(scope)) {
      failed++;
      console.log(`FAIL ${JSON.stringify(text)} in ${JSON.stringify(line)}\n  want ${scope}\n  got  ${tok ? tok.scopes.join(" ") : "(no token)"}`);
    }
  }
  // Every example file tokenizes without leaving a tag or string open: those of
  // a checkout of quillolang/examples (QUILLO_EXAMPLES, else ../quillo-examples beside
  // this repository).
  const examples = process.env.QUILLO_EXAMPLES || path.join(__dirname, "../../../quillo-examples");
  if (!fs.existsSync(examples)) console.log(`skipped the examples: no checkout of quillolang/examples at ${examples}`);
  for (const f of fs.existsSync(examples) ? fs.readdirSync(examples).filter((f) => f.endsWith(".qwe")) : []) {
    let state = vsctm.INITIAL;
    for (const line of fs.readFileSync(path.join(examples, f), "utf8").split("\n")) {
      state = grammar.tokenizeLine(line, state).ruleStack;
    }
    if (state.depth > 1) {
      failed++;
      console.log(`FAIL ${f}: tokenizer state still nested at end of file (depth ${state.depth})`);
    }
  }
  // A .qwer file: Rust, with its dependencies header as TOML (with VS Code's
  // own Rust grammar, where it can be found).
  const rustGrammar = [
    process.env.VSCODE_RUST_GRAMMAR,
    "/Applications/Visual Studio Code.app/Contents/Resources/app/extensions/rust/syntaxes/rust.tmLanguage.json",
    "/usr/share/code/resources/app/extensions/rust/syntaxes/rust.tmLanguage.json",
  ].find((p) => p && fs.existsSync(p));
  let rustCases = 0;
  if (rustGrammar) {
    const files = {
      "source.rust": rustGrammar,
      "source.qwer": path.join(__dirname, "../syntaxes/qwer.tmLanguage.json"),
    };
    const rustRegistry = new vsctm.Registry({
      onigLib,
      loadGrammar: async (scope) => files[scope] && vsctm.parseRawGrammar(fs.readFileSync(files[scope], "utf8"), files[scope]),
    });
    const rust = await rustRegistry.loadGrammar("source.qwer");
    const src = fs.readFileSync(path.join(__dirname, "fixtures/deps.qwer"), "utf8").split("\n");
    const want = [
      [2, "dependencies", "entity.name.section.toml"],
      [3, "image", "support.type.property-name.toml"],
      [3, "0.25", "string.quoted.double.toml"],
      [4, "default-features", "support.type.property-name.toml"],
      [4, "false", "constant.language.boolean.toml"],
      [7, "pub", "storage.modifier.visibility.rust"],
      [7, "brightness", "entity.name.function.rust"],
      // Below the header, Rust is Rust: no TOML in a later doc comment.
      [6, "= not toml", "comment.line.documentation.rust"],
    ];
    let state = vsctm.INITIAL;
    const lines = src.map((l) => {
      const r = rust.tokenizeLine(l, state);
      state = r.ruleStack;
      return r.tokens.map((t) => ({ text: l.slice(t.startIndex, t.endIndex), scopes: t.scopes }));
    });
    for (const [n, text, scope] of want) {
      rustCases++;
      const tok = lines[n].find((t) => t.text === text) || lines[n].find((t) => t.text.includes(text));
      if (!tok || !tok.scopes.includes(scope)) {
        failed++;
        console.log(`FAIL .qwer line ${n + 1} ${JSON.stringify(text)}\n  want ${scope}\n  got  ${tok ? tok.scopes.join(" ") : "(no token)"}`);
      }
    }
  } else {
    console.log("(no Rust grammar found: the .qwer cases were skipped)");
  }
  console.log(failed ? `${failed} failed` : `all ${cases.length + blocks.length + rustCases} grammar cases passed`);
  process.exit(failed ? 1 : 0);
})();
