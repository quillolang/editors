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
  name: (identifier) @local.definition.function)

(component_definition
  name: (identifier) @local.definition.type)

(type_definition
  name: (type_identifier) @local.definition.type)

(parameter
  name: (identifier) @local.definition.parameter)

(lambda
  parameter: (identifier) @local.definition.parameter)

(path_parameter
  name: (identifier) @local.definition.parameter)

(path_rest
  name: (identifier) @local.definition.parameter)

(let_declaration
  pattern: (identifier) @local.definition.var)

(state_declaration
  name: (identifier) @local.definition.var)

(site_declaration
  name: (identifier) @local.definition.var)

(list_pattern
  (identifier) @local.definition.var)

(list_pattern
  rest: (identifier) @local.definition.var)

(field_pattern
  pattern: (identifier) @local.definition.var)

(as_pattern
  name: (identifier) @local.definition.var)

(for_expression
  pattern: (identifier) @local.definition.var)

(match_arm
  pattern: (identifier) @local.definition.var)

(import_name
  name: (identifier) @local.definition.import)

(import_name
  alias: (identifier) @local.definition.import)

; References
(identifier) @local.reference
