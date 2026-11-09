; Quillo highlights, in Neovim's capture names. The Helix and Zed copies are made from
; this file by scripts/queries.js: change it here. A later pattern wins over an
; earlier one, so the general ones come first.

; Names
(identifier) @variable

(soft_identifier) @variable

((identifier) @constant
  (#match? @constant "^[A-Z][A-Z0-9_]+$"))

(parameter
  name: (identifier) @variable.parameter)

(lambda
  parameter: (identifier) @variable.parameter)

(property_identifier) @variable.member

(shorthand
  (property_identifier) @variable)

(state_declaration
  name: (identifier) @variable)

; Functions
(function_definition
  name: (identifier) @function)

(component_definition
  name: (identifier) @type)

(call_expression
  function: (identifier) @function.call)

(call_expression
  function: (member_expression
    property: (property_identifier) @function.method.call))

((call_expression
  function: (identifier) @function.builtin)
  (#any-of? @function.builtin
  "print" "str" "int" "float" "dec" "len" "type_of" "upper" "lower" "trim" "split" "join"
  "contains" "starts_with" "ends_with" "replace" "slice" "map" "filter" "find" "any" "all"
  "reduce" "sum" "min" "max" "sort" "sort_by" "reverse" "first" "last" "push" "range"
  "enumerate" "keys" "values" "get" "has" "set" "remove" "merge" "err" "is_err" "unwrap" "raw"
  "escape" "url_encode" "env" "now" "sleep" "file" "redirect" "respond" "read_file" "write_file"
  "random" "random_int" "uuid" "abs" "round" "floor" "ceil" "sqrt" "pow" "unique" "flatten"
  "zip" "take" "drop" "count" "group_by" "index_of" "repeat" "format_number" "live" "publish"
  "watch" "unwatched" "delete_file" "check_program" "join_on" "markdown" "highlight"
  "run_script" "sql_name" "sql_param" "ask" "notify" "translations" "locale_from" "locale"
  "with_locale" "t" "schedule" "allow_cross_site" "tenant" "tenant_from" "with_tenant"
  "save_upload" "read_upload" "js" "js_new" "parallel" "every" "stream" "events" "listen"
  "receive" "url" "css" "sql" "navigate" "set_cookie" "delete_cookie" "session" "set_session"
  "end_session" "sessions" "renew_session" "end_sessions" "user_sessions" "rate_limit"
  "rate_limit_reset" "security_headers" "csp" "csp_nonce" "idempotent" "args" "cookie"
  "cursor_index" "defer" "error" "exit" "filled" "js_has" "local_path" "new_tenant" "normalize"
  "page_updated" "platform" "read_line" "ready" "run_after" "site_headers" "stdin" "style_with"
  "waiting" "accept_calls" "classes" "files" "markdown_page" "confirm" "mcp_token" "mcp_tokens"
  "revoke_mcp_token" "about"))

((member_expression
  object: (identifier) @module.builtin)
  (#any-of? @module.builtin
    "json" "db" "http" "udp" "channel" "media" "crypto" "image" "math" "stats" "vec" "date" "money" "re" "bit" "later"))

(tagged_template
  tag: (identifier) @function.macro)

; Types
(type_identifier) @type

((type_identifier) @type.builtin
  (#any-of? @type.builtin "int" "float" "dec" "num" "str" "date" "bool" "list" "map" "html" "fn" "any" "response" "null"))

(type_definition
  name: (type_identifier) @type.definition)

; In a pattern, a type's name matches a value of that type: `{ name: str }`, `n: int`.
((field_pattern
  pattern: (identifier) @type.builtin)
  (#any-of? @type.builtin "int" "float" "dec" "num" "str" "date" "bool" "list" "map" "html" "fn" "any"))

((field_pattern
  pattern: (identifier) @type)
  (#match? @type "^[A-Z]"))

((match_arm
  pattern: (identifier) @type.builtin)
  (#any-of? @type.builtin "int" "float" "dec" "num" "str" "date" "bool" "list" "map" "html" "fn" "any"))

((match_arm
  pattern: (identifier) @type)
  (#match? @type "^[A-Z]"))

(effect) @attribute

; Routes
(http_method) @constant.builtin

(route_path) @string.special.url

(path_literal) @string.special.url

(path_parameter
  name: (identifier) @variable.parameter)

(path_parameter
  type: (type_identifier) @type.builtin)

(path_rest
  name: (identifier) @variable.parameter)

; Files
(unquoted_path) @string.special.path

(import_statement
  source: (string) @string.special.path)

(use_statement
  source: (string) @string.special.path)

(import_name
  name: (identifier) @function)

(import_name
  alias: (identifier) @function)

(wildcard) @character.special

(service_declaration
  name: (identifier) @module)

(site_declaration
  name: (identifier) @module)

; Literals
(number) @number

(string) @string

(template_string) @string

(tagged_template
  (string_content) @string)

(escape_sequence) @string.escape

(template_substitution
  [
    "${"
    "}"
  ] @punctuation.special)

[
  (true)
  (false)
] @boolean

(null) @constant.builtin

(comment) @comment @spell

(html_comment) @comment

(doctype) @keyword.directive

(shebang) @keyword.directive

; Markup
(tag_name) @tag

((tag_name) @type
  (#match? @type "^[A-Z]"))

(attribute_name) @tag.attribute

(attribute_value) @string

((attribute_name) @keyword
  (#match? @keyword "^@"))

(class_selector
  (selector_name) @tag.attribute)

(id_selector
  (selector_name) @tag.attribute)

[
  "<"
  ">"
  "</"
  "/>"
] @tag.delimiter

(start_tag
  [
    "<"
    ">"
  ] @tag.delimiter)

(html_text) @none

; Keywords. The words that are names outside their own statement are caught only there.
[
  "let"
  "fn"
  "view"
  "component"
  "route"
] @keyword

[
  "fn"
  "view"
  "component"
] @keyword.function

(server) @keyword.modifier

; `fn mcp total()`, `service mcp /billing`: the tag of a tool (quillo FEEDBACK56.md, Q-853).
(mcp) @keyword.modifier

(visibility) @keyword.modifier

(type_definition
  "type" @keyword.type)

(state_declaration
  [
    "state"
    "~"
  ] @keyword)

(site_declaration
  "site" @keyword)

(style_statement
  [
    "style"
    "global"
  ] @keyword)

(route_group
  "routes" @keyword)

(service_declaration
  "service" @keyword)

(mount_declaration
  "mount" @keyword)

(build_declaration
  "build" @keyword)

(build_declaration
  path: (string) @string.special.url)

(accept_calls_statement
  (identifier) @function.builtin)

(effects
  "with" @keyword)

(import_statement
  [
    "import"
    "client"
    "preload"
    "preconnect"
    "module"
    "use"
  ] @keyword.import)

(use_statement
  [
    "use"
    "from"
    "with"
    "preload"
    "preconnect"
  ] @keyword.import)

(import_name
  "as" @keyword.import)

(as_pattern
  "as" @keyword)

[
  "if"
  "else"
  "match"
] @keyword.conditional

[
  "for"
  "in"
  "while"
] @keyword.repeat

; `server fn f() for ["shop"]`: the callers, after the loops' `for` so it wins.
(function_definition
  "for" @keyword.modifier)

[
  "return"
  "reply"
] @keyword.return

; Operators and punctuation
[
  "="
  "+="
  "-="
  "=="
  "!="
  "<="
  ">="
  "+"
  "-"
  "*"
  "/"
  "%"
  "!"
  "&&"
  "||"
  "??"
  "|"
  ".."
  "..."
  "->"
  "=>"
  "?"
] @operator

(binary_expression
  operator: [
    "<"
    ">"
  ] @operator)

[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
] @punctuation.bracket

[
  ","
  ";"
  ":"
  "."
] @punctuation.delimiter
