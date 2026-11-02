[
  (block)
  (map)
  (list)
  (arguments)
  (parameters)
  (match_expression)
  (route_group)
  (shape_type)
  (record_pattern)
  (list_pattern)
  (element)
] @indent.begin

[
  "}"
  "]"
  ")"
] @indent.end @indent.branch

(end_tag) @indent.branch

[
  (comment)
  (template_string)
] @indent.auto
