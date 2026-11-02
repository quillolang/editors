; Made from tree-sitter/queries by tree-sitter/scripts/queries.js, in Zed's capture names: change those, then run it.

(_
  "{" "}" @end) @indent

(_
  "[" "]" @end) @indent

(_
  "(" ")" @end) @indent

(element
  (start_tag)
  (end_tag) @end) @indent
