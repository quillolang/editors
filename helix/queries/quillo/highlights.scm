; Made from tree-sitter/queries by tree-sitter/scripts/queries.js, in Helix's capture names: change those, then run it.

[
  ","
  ";"
  ":"
  "."
] @punctuation.delimiter

[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
] @punctuation.bracket

(binary_expression
  operator: [
    "<"
    ">"
  ] @operator)

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

[
  "return"
  "reply"
] @keyword.control.return

; `server fn f() for ["shop"]`: the callers, after the loops' `for` so it wins.
(function_definition
  "for" @keyword.storage.modifier)

[
  "for"
  "in"
  "while"
] @keyword.control.repeat

[
  "if"
  "else"
  "match"
] @keyword.control.conditional

(as_pattern
  "as" @keyword)

(import_name
  "as" @keyword.control.import)

(use_statement
  [
    "use"
    "from"
    "with"
    "preload"
    "preconnect"
  ] @keyword.control.import)

(import_statement
  [
    "import"
    "client"
    "preload"
    "preconnect"
    "module"
    "use"
  ] @keyword.control.import)

(effects
  "with" @keyword)

(accept_calls_statement
  (identifier) @function.builtin)

(build_declaration
  path: (string) @string.special.url)

(build_declaration
  "build" @keyword)

(mount_declaration
  "mount" @keyword)

(service_declaration
  "service" @keyword)

(route_group
  "routes" @keyword)

(style_statement
  [
    "style"
    "global"
  ] @keyword)

(site_declaration
  "site" @keyword)

(state_declaration
  [
    "state"
    "~"
  ] @keyword)

(type_definition
  "type" @keyword.storage.type)

(visibility) @keyword.storage.modifier

(server) @keyword.storage.modifier

[
  "fn"
  "view"
  "component"
] @keyword.function

; Keywords. The words that are names outside their own statement are caught only there.
[
  "let"
  "fn"
  "view"
  "component"
  "route"
] @keyword

(start_tag
  [
    "<"
    ">"
  ] @punctuation.bracket)

[
  "<"
  ">"
  "</"
  "/>"
] @punctuation.bracket

(id_selector
  (selector_name) @attribute)

(class_selector
  (selector_name) @attribute)

((attribute_name) @keyword
  (#match? @keyword "^@"))

(attribute_value) @string

(attribute_name) @attribute

((tag_name) @type
  (#match? @type "^[A-Z]"))

; Markup
(tag_name) @tag

(shebang) @keyword.directive

(doctype) @keyword.directive

(html_comment) @comment

(comment) @comment

(null) @constant.builtin

[
  (true)
  (false)
] @constant.builtin.boolean

(template_substitution
  [
    "${"
    "}"
  ] @punctuation.special)

(escape_sequence) @constant.character.escape

(tagged_template
  (string_content) @string)

(template_string) @string

(string) @string

; Literals
(number) @constant.numeric

(site_declaration
  name: (identifier) @namespace)

(service_declaration
  name: (identifier) @namespace)

(wildcard) @special

(import_name
  alias: (identifier) @function)

(import_name
  name: (identifier) @function)

(use_statement
  source: (string) @string.special.path)

(import_statement
  source: (string) @string.special.path)

; Files
(unquoted_path) @string.special.path

(path_rest
  name: (identifier) @variable.parameter)

(path_parameter
  type: (type_identifier) @type.builtin)

(path_parameter
  name: (identifier) @variable.parameter)

(path_literal) @string.special.url

(route_path) @string.special.url

; Routes
(http_method) @constant.builtin

(effect) @attribute

((match_arm
  pattern: (identifier) @type)
  (#match? @type "^[A-Z]"))

((match_arm
  pattern: (identifier) @type.builtin)
  (#any-of? @type.builtin "int" "float" "dec" "num" "str" "date" "bool" "list" "map" "html" "fn" "any"))

((field_pattern
  pattern: (identifier) @type)
  (#match? @type "^[A-Z]"))

; In a pattern, a type's name matches a value of that type: `{ name: str }`, `n: int`.
((field_pattern
  pattern: (identifier) @type.builtin)
  (#any-of? @type.builtin "int" "float" "dec" "num" "str" "date" "bool" "list" "map" "html" "fn" "any"))

(type_definition
  name: (type_identifier) @type)

((type_identifier) @type.builtin
  (#any-of? @type.builtin "int" "float" "dec" "num" "str" "date" "bool" "list" "map" "html" "fn" "any" "response" "null"))

; Types
(type_identifier) @type

(tagged_template
  tag: (identifier) @function.macro)

((member_expression
  object: (identifier) @namespace)
  (#any-of? @namespace
    "json" "db" "http" "udp" "channel" "media" "crypto" "image" "math" "stats" "vec" "date" "money" "re" "bit" "later"))

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
  "waiting" "accept_calls" "classes" "files" "markdown_page"))

(call_expression
  function: (member_expression
    property: (property_identifier) @function.method))

(call_expression
  function: (identifier) @function)

(component_definition
  name: (identifier) @type)

; Functions
(function_definition
  name: (identifier) @function)

(state_declaration
  name: (identifier) @variable)

(shorthand
  (property_identifier) @variable)

(property_identifier) @variable.other.member

(lambda
  parameter: (identifier) @variable.parameter)

(parameter
  name: (identifier) @variable.parameter)

((identifier) @constant
  (#match? @constant "^[A-Z][A-Z0-9_]+$"))

(soft_identifier) @variable

; Names
(identifier) @variable
