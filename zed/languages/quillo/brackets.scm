; Made from tree-sitter/queries by tree-sitter/scripts/queries.js, in Zed's capture names: change those, then run it.

("(" @open ")" @close)
("[" @open "]" @close)
("{" @open "}" @close)
(start_tag "<" @open ">" @close)
(end_tag "</" @open ">" @close)
(("\"" @open "\"" @close) (#set! rainbow.exclude))
(("`" @open "`" @close) (#set! rainbow.exclude))
