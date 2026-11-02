// Quillo for highlight.js 11: hljs.registerLanguage("quillo", require("./quillo.js")) in Node,
// or this file after highlight.js on a page, which registers it. The builtins and modules
// are the VS Code extension's grammar's (test/highlightjs.mjs checks).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else if (root && root.hljs) root.hljs.registerLanguage("quillo", factory());
})(typeof self !== "undefined" ? self : this, function () {
  const BUILTINS = [
    "print", "str", "int", "float", "dec", "len", "type_of", "upper", "lower", "trim", "split",
    "join", "contains", "starts_with", "ends_with", "replace", "slice", "map", "filter", "find",
    "any", "all", "reduce", "sum", "min", "max", "sort", "sort_by", "reverse", "first", "last",
    "push", "range", "enumerate", "keys", "values", "get", "has", "set", "remove", "merge", "err",
    "is_err", "unwrap", "raw", "escape", "url_encode", "env", "now", "sleep", "file", "redirect",
    "respond", "read_file", "write_file", "random", "random_int", "uuid", "abs", "round", "floor",
    "ceil", "sqrt", "pow", "unique", "flatten", "zip", "take", "drop", "count", "group_by",
    "index_of", "repeat", "format_number", "live", "publish", "watch", "unwatched", "delete_file",
    "check_program", "join_on", "markdown", "highlight", "run_script", "sql_name", "sql_param",
    "ask", "notify", "translations", "locale_from", "locale", "with_locale", "t", "schedule",
    "allow_cross_site", "tenant", "tenant_from", "with_tenant", "save_upload", "read_upload", "js",
    "js_new", "parallel", "every", "stream", "events", "listen", "receive", "url", "css", "sql",
    "navigate", "set_cookie", "delete_cookie", "session", "set_session", "end_session", "sessions",
    "renew_session", "end_sessions", "user_sessions", "rate_limit", "rate_limit_reset",
    "security_headers", "csp", "csp_nonce", "idempotent", "args", "cookie", "cursor_index",
    "defer", "error", "exit", "filled", "js_has", "local_path", "new_tenant", "normalize",
    "page_updated", "platform", "read_line", "ready", "run_after", "site_headers", "stdin",
    "style_with", "waiting", "accept_calls", "classes", "files", "markdown_page",
  ];
  const MODULES = ["json", "db", "http", "udp", "channel", "media", "crypto", "image", "math", "stats", "vec", "date", "money", "re", "bit", "later"];
  const TYPES = ["int", "float", "dec", "num", "str", "date", "bool", "list", "map", "html", "fn", "any", "response"];

  return function quillo(hljs) {
    const regex = hljs.regex;
    const IDENT = /[A-Za-z_][A-Za-z0-9_]*/;
    const KEYWORDS = {
      keyword: ["let", "fn", "view", "component", "route", "use", "as", "with", "from", "if", "else", "match", "for", "in", "while", "return", "reply"],
      literal: ["true", "false", "null"],
      built_in: BUILTINS,
      type: TYPES,
      $pattern: /[A-Za-z_][A-Za-z0-9_]*/,
    };
    const SUBST = { className: "subst", begin: /\$\{/, end: /\}/, keywords: KEYWORDS, contains: [] };
    const ESCAPE = { className: "char.escape", begin: /\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|.)/ };
    const TEMPLATE = { className: "string", begin: "`", end: "`", contains: [ESCAPE, SUBST] };
    const STRINGS = [
      { className: "string", begin: '"', end: '"', contains: [ESCAPE] },
      { className: "string", begin: "'", end: "'", contains: [ESCAPE] },
      TEMPLATE,
    ];
    const NUMBER = { className: "number", begin: /\b(0[xX][0-9a-fA-F_]+|\d[\d_]*(\.\d[\d_]*)?([eE][+-]?\d+)?m?)\b/, relevance: 0 };
    // css`...`, sql`...`: the name, then a template.
    const TAGGED = { begin: regex.concat(IDENT, /(?=`)/), className: "title.function", relevance: 0 };
    const MODULE = { begin: regex.concat(/\b/, regex.either(...MODULES), /(?=\.)/), className: "built_in" };
    const ROUTE = {
      begin: [/^\s*/, /\b(?:route|routes|mount|service)\b/, /\s+/, /(?:(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|ANY)\s+)?/, /\/[^\s{=?|]*/],
      beginScope: { 2: "keyword", 4: "keyword", 5: "string" },
      relevance: 10,
    };
    const IMPORT = {
      begin: [/^\s*/, /\b(?:import|client|preload|preconnect)\b/, /\s+(?:module\s+)?/, /(?:"[^"]*"|[^\s"]+)/, /\s+/, /use\b/],
      beginScope: { 2: "keyword", 4: "string", 6: "keyword" },
      relevance: 10,
    };
    // `client`, `type`, `site`, `state`, `style` and the rest only start their own statement.
    const SOFT = {
      begin: [/^\s*/, /(?:private|public|server|state|site|type|style(?:\s+global)?)\b/, /(?=\s+[A-Za-z_])/],
      beginScope: { 2: "keyword" },
    };
    // `build "/app.css" = ...`, and `accept_calls { ... }`, the builtin's statement form.
    const BUILD = { begin: [/^\s*/, /build\b/, /(?=\s+"[^"]*"\s*=[^=])/], beginScope: { 2: "keyword" } };
    const ACCEPT = { begin: [/^\s*/, /accept_calls\b/, /(?=\s*\{)/], beginScope: { 2: "built_in" } };
    // HTML as written: <!-- comments --> and <!DOCTYPE html>.
    const HTML_COMMENT = hljs.COMMENT("<!--", "-->");
    // highlight.js drops a mode's own flags, so the case is spelt out.
    const DOCTYPE = { className: "meta", begin: /<![dD][oO][cC][tT][yY][pP][eE]\s+[hH][tT][mM][lL]\s*>/ };
    const DEFINITION = {
      begin: [/\b(?:fn|view|component)\b/, /\s+/, IDENT],
      beginScope: { 1: "keyword", 3: "title.function" },
    };
    const TAG = {
      className: "tag",
      begin: /<\/?(?=[A-Za-z])/,
      end: /\/?>/,
      contains: [
        { className: "name", begin: /[A-Za-z][\w-]*/, starts: { endsWithParent: true, relevance: 0, contains: [] } },
      ],
    };
    const ATTRS = [
      { className: "attr", begin: /[@:]?[A-Za-z_][\w\-:@.]*(?==)/, relevance: 0 },
      { className: "attr", begin: /@[A-Za-z_][\w\-.]*/ },
      { className: "selector-class", begin: /\.[\w-]+/, relevance: 0 },
      { className: "selector-id", begin: /#[\w-]+/, relevance: 0 },
      { begin: /=\{/, end: /\}/, keywords: KEYWORDS, contains: [] },
      { className: "string", begin: '"', end: '"' },
      { className: "string", begin: "'", end: "'" },
      // HTML's unquoted value, which `/>` ends: <img src=a.png/>.
      { className: "string", match: /(?<==)(?:[^\s"'=<>`{}/]|\/(?!>))+/ },
    ];
    TAG.contains[0].starts.contains = ATTRS;
    const ALL = [
      hljs.SHEBANG({ binary: "quillo" }),
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      HTML_COMMENT,
      DOCTYPE,
      ROUTE,
      IMPORT,
      SOFT,
      BUILD,
      ACCEPT,
      DEFINITION,
      ...STRINGS,
      TAGGED,
      MODULE,
      NUMBER,
      TAG,
    ];
    SUBST.contains = ALL;
    ATTRS[4].contains = ALL;
    return { name: "Quillo", aliases: ["qwe"], keywords: KEYWORDS, contains: ALL };
  };
});
