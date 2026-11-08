// Quillo for Prism: require("./prism-quillo.js")(Prism) in Node, or this file after Prism on a
// page, which adds Prism.languages.quillo (and .qwe). The builtins and modules are the VS
// Code extension's grammar's (test/prism.mjs checks).
(function (root) {
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
    "style_with", "waiting", "accept_calls", "classes", "files", "markdown_page", "confirm",
    "mcp_token", "mcp_tokens", "revoke_mcp_token",
  ];
  const MODULES = ["json", "db", "http", "udp", "channel", "media", "crypto", "image", "math", "stats", "vec", "date", "money", "re", "bit", "later"];
  const words = (list) => new RegExp("\\b(?:" + list.join("|") + ")\\b");

  function quillo(Prism) {
    const expression = {};
    const lang = {
      shebang: { pattern: /^#!.*/, alias: "comment" },
      comment: [
        { pattern: /<!--[\s\S]*?-->/, greedy: true },
        { pattern: /\/\*[\s\S]*?\*\//, greedy: true },
        { pattern: /\/\/.*/, greedy: true },
      ],
      "template-string": {
        pattern: /(?:\b[A-Za-z_]\w*)?`(?:\\[\s\S]|\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}|(?!\$\{)[^\\`])*`/,
        greedy: true,
        inside: {
          "template-tag": { pattern: /^[A-Za-z_]\w*/, alias: "function" },
          "template-punctuation": { pattern: /^`|`$/, alias: "string" },
          interpolation: {
            pattern: /((?:^|[^\\])(?:\\{2})*)\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}/,
            lookbehind: true,
            inside: {
              "interpolation-punctuation": { pattern: /^\$\{|\}$/, alias: "punctuation" },
              rest: expression,
            },
          },
          string: /[\s\S]+/,
        },
      },
      // Before strings, which would take the path `build` looks ahead to.
      build: { pattern: /^(\s*)build\b(?=\s+"[^"]*"\s*=[^=])/m, lookbehind: true, alias: "keyword" },
      "accept-calls": { pattern: /^(\s*)accept_calls\b(?=\s*\{)/m, lookbehind: true, alias: "builtin" },
      string: { pattern: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/, greedy: true },
      // `service mcp /billing = ...`, `service mcp crm = ...`: the tag of a tool, with a path or a name
      // after it; `service mcp = ...` and `service mcp /* note */ = ...` name a service `mcp` (quillo
      // FEEDBACK56.md, Q-853).
      "service-tool": {
        pattern: /^(\s*)service[ \t]+mcp(?=[ \t]+(?:[A-Za-z_]|\/(?![/*])))(?:[ \t]+\/[^\s{=?|]*)?/m,
        lookbehind: true,
        inside: {
          keyword: /^service\b|\bmcp\b/,
          path: { pattern: /\/\S*/, alias: "url" },
        },
      },
      route: {
        pattern: /^(\s*)(?:route|routes|mount|service)\s+(?:(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|ANY)\s+)?\/[^\s{=?|]*/m,
        lookbehind: true,
        inside: {
          keyword: /^\w+/,
          method: { pattern: /\b(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|ANY)\b/, alias: "keyword" },
          path: { pattern: /\/\S*/, alias: "url" },
        },
      },
      import: {
        pattern: /^(\s*)(?:import|client|preload|preconnect)\s+(?:module\s+)?(?:"[^"]*"|[^\s"]+)\s+use\b/m,
        lookbehind: true,
        inside: {
          path: { pattern: /(^\w+\s+(?:module\s+)?)(?:"[^"]*"|[^\s"]+)/, lookbehind: true, alias: "url" },
          keyword: /^\w+|\b(?:module|use)\b/,
        },
      },
      doctype: { pattern: /<!doctype\s+html\s*>/i, alias: "prolog" },
      soft: {
        pattern: /^(\s*)(?:private|public|server|state|site|type|style(?:\s+global)?)\b(?=\s+[A-Za-z_])/m,
        lookbehind: true,
        alias: "keyword",
      },
      tag: {
        pattern: /<\/?[A-Za-z][\w-]*(?:[.#][\w\-:{}.]*)*(?:\s+(?:[@:]?[A-Za-z_][\w\-:@.]*(?:=(?:"[^"]*"|'[^']*'|\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})*\}|(?:[^\s"'=<>`{}\/]|\/(?!>))+))?|\{[^}]*\}))*\s*\/?>/,
        greedy: true,
        inside: {
          // HTML's unquoted value, which `/>` ends: <img src=a.png/>.
          "attr-value-unquoted": { pattern: /(=)(?:[^\s"'=<>`{}\/]|\/(?!>))+/, lookbehind: true, alias: ["attr-value", "string"] },
          "attr-value": {
            pattern: /=(?:"[^"]*"|'[^']*'|\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})*\}|(?:[^\s"'=<>`{}\/]|\/(?!>))+)/,
            inside: { punctuation: /^=\{?|\}$/, string: /^(?:"[^"]*"|'[^']*'|[^{].*)$/, rest: expression },
          },
          "attr-name": /(?:^|\s)[@:]?[A-Za-z_][\w\-:@.]*/,
          punctuation: /^<\/?|\/?>$/,
          "tag-name": { pattern: /^[A-Za-z][\w-]*/, alias: "tag" },
          selector: /[.#][\w\-:]+/,
        },
      },
      // `fn mcp total()`: `mcp` with a name after it on its line is the tag of a tool; `fn mcp(x)`
      // and the second `mcp` of `fn mcp mcp()` name a function.
      "tool-definition": {
        pattern: /\b(?:fn|view|component)\s+mcp[ \t]+[A-Za-z_]\w*/,
        inside: {
          keyword: /^\w+|\bmcp\b(?=[ \t])/,
          function: /\w+$/,
        },
      },
      "function-definition": { pattern: /(\b(?:fn|view|component)\s+)[A-Za-z_]\w*/, lookbehind: true, alias: "function" },
      keyword: /\b(?:let|fn|view|component|route|use|as|with|from|if|else|match|for|in|while|return|reply)\b/,
      boolean: /\b(?:true|false)\b/,
      null: { pattern: /\bnull\b/, alias: "keyword" },
      builtin: { pattern: new RegExp(words(BUILTINS).source + "(?=\\s*\\()") },
      module: { pattern: new RegExp(words(MODULES).source + "(?=\\.)"), alias: "builtin" },
      "class-name": /\b[A-Z]\w*\b/,
      function: /\b[A-Za-z_]\w*(?=\s*\()/,
      number: /\b(?:0[xX][\da-fA-F_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?m?)\b/,
      operator: /\?\?|=>|->|\.\.\.?|[=!<>+-]=|&&|\|\||[-+*\/%!|?<>=~]/,
      punctuation: /[{}[\]();,.:]/,
    };
    Object.assign(expression, lang);
    Prism.languages.quillo = lang;
    Prism.languages.qwe = lang;
  }

  if (typeof module === "object" && module.exports) module.exports = quillo;
  else if (root && root.Prism) quillo(root.Prism);
})(typeof self !== "undefined" ? self : this);
