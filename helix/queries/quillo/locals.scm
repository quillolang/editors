; Made from tree-sitter/queries by tree-sitter/scripts/queries.js, in Helix's capture names: change those, then run it.

; Scopes
[
  (source_file)
  (block)
  (function_definition)
  (component_definition)
  (lambda)
  (match_arm)
  (for_expression)
  (route)
] @local.scope

; Definitions
(function_definition
  name: (identifier) @local.definition)

(component_definition
  name: (identifier) @local.definition)

(type_definition
  name: (type_identifier) @local.definition)

(parameter
  name: (identifier) @local.definition.variable.parameter)

(lambda
  parameter: (identifier) @local.definition.variable.parameter)

(path_parameter
  name: (identifier) @local.definition.variable.parameter)

(path_rest
  name: (identifier) @local.definition.variable.parameter)

(let_declaration
  pattern: (identifier) @local.definition)

(state_declaration
  name: (identifier) @local.definition)

(site_declaration
  name: (identifier) @local.definition)

(list_pattern
  (identifier) @local.definition)

(list_pattern
  rest: (identifier) @local.definition)

(field_pattern
  pattern: (identifier) @local.definition)

(as_pattern
  name: (identifier) @local.definition)

(for_expression
  pattern: (identifier) @local.definition)

(match_arm
  pattern: (identifier) @local.definition)

(import_name
  name: (identifier) @local.definition)

(import_name
  alias: (identifier) @local.definition)

; References
(identifier) @local.reference
