; Made from tree-sitter/queries by tree-sitter/scripts/queries.js, in Helix's capture names: change those, then run it.

; CSS in css`...` (and so in `style css`...``) and in <style>; SQL in sql`...` and in the
; string or template db.exec, db.one and db.query are given first. A template's text
; around its ${...} is one document to the injected language.
((tagged_template
  tag: (identifier) @_tag
  (string_content) @injection.content)
  (#eq? @_tag "css")
  (#set! injection.language "css")
  (#set! injection.combined))

((tagged_template
  tag: (identifier) @_tag
  (string_content) @injection.content)
  (#eq? @_tag "sql")
  (#set! injection.language "sql")
  (#set! injection.combined))

((call_expression
  function: (member_expression
    object: (identifier) @_db
    property: (property_identifier) @_fn)
  arguments: (arguments
    .
    [
      (string
        (string_content) @injection.content)
      (template_string
        (string_content) @injection.content)
    ]))
  (#eq? @_db "db")
  (#any-of? @_fn "exec" "one" "query")
  (#set! injection.language "sql")
  (#set! injection.combined))

; A `{` in <style> is Quillo's, so its CSS is a string: <style>{"p { margin: 0 }"}</style>.
((element
  (start_tag
    name: (tag_name) @_tag)
  [
    (html_text) @injection.content
    (html_expression
      (string
        (string_content) @injection.content))
  ])
  (#eq? @_tag "style")
  (#set! injection.language "css"))

((element
  (start_tag
    name: (tag_name) @_tag)
  (html_text) @injection.content)
  (#eq? @_tag "script")
  (#set! injection.language "javascript"))

((comment) @injection.content
  (#set! injection.language "comment"))
