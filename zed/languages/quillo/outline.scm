; Made from tree-sitter/queries by tree-sitter/scripts/queries.js, in Zed's capture names: change those, then run it.

(function_definition
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
