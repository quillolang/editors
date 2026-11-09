" Vim syntax file
" Language: Quillo (.qwe)
" Maintainer: quillolang (https://github.com/quillolang/editors)
" The builtins and modules are the VS Code extension's grammar's (test/run.vim checks).

if exists("b:current_syntax")
  finish
endif
let s:cpo_save = &cpo
set cpo&vim

syntax case match

" Comments, and a script's first line.
syntax keyword quilloTodo TODO FIXME XXX NOTE contained
syntax match quilloLineComment "//.*$" contains=quilloTodo,@Spell
syntax region quilloBlockComment start="/\*" end="\*/" contains=quilloTodo,@Spell
syntax match quilloShebang "\%^#!.*$"

" Strings: "..." and '...' with escapes; `...` with ${...}; css`...` and sql`...`.
syntax match quilloEscape "\\\(u{\x\+}\|u\x\{4}\|.\)" contained
syntax region quilloString start=+"+ skip=+\\.+ end=+"+ contains=quilloEscape,@Spell
syntax region quilloString start=+'+ skip=+\\.+ end=+'+ contains=quilloEscape,@Spell
syntax region quilloTemplate start=+`+ skip=+\\.+ end=+`+ contains=quilloEscape,quilloInterpolation
syntax region quilloInterpolation matchgroup=quilloInterpolationDelimiter start=+\${+ end=+}+ contained contains=TOP
syntax match quilloTag "\<\h\w*\ze`"

" Numbers: 42, 1_000, 0xFF, 2.5, 1e-9, 12.50m.
syntax match quilloNumber "\<0[xX][0-9a-fA-F_]\+\>"
syntax match quilloNumber "\<\d[0-9_]*\(\.\d[0-9_]*\)\=\([eE][+-]\=\d\+\)\=m\=\>"

" Keywords. The words that start their own statement only there: `client = 1` is a name.
syntax keyword quilloKeyword let fn view component route use as with from
syntax keyword quilloConditional if else match
syntax keyword quilloRepeat for in while
syntax keyword quilloReturn return reply
syntax keyword quilloBoolean true false
syntax keyword quilloNull null
syntax match quilloStatement "^\s*\zs\(private\|public\)\ze\s\+\(fn\|view\|component\|let\|server\|type\)\>"
syntax match quilloStatement "^\s*\zsserver\ze\s\+fn\>"
" `server` after `private` or `public` too: `public server fn x()`.
syntax match quilloStatement "\(^\s*\(private\|public\)\s\+\)\@<=server\ze\s\+fn\>"
syntax match quilloStatement "^\s*\zs\(state\|site\|type\)\ze\s\+\h\w*\s*=[^=]"
syntax match quilloStatement "^\s*\zsstyle\ze\s\+\(global\s\+\)\=\h"
syntax match quilloStatement "^\s*style\s\+\zsglobal\ze\s"
syntax match quilloStatement "^\s*\zs\(routes\|service\|mount\)\ze\s\+[/a-zA-Z_]"
syntax match quilloStatement "^\s*\zsbuild\ze\s\+\"[^"]*\"\s*=[^=]"
syntax match quilloBuiltin "^\s*\zsaccept_calls\ze\s*{"
syntax match quilloImport "^\s*\zs\(import\|client\|preload\|preconnect\)\ze\s\+\(module\s\+\)\=\S\+\s\+use\>"
syntax match quilloImport "\(^\s*\(client\|preload\|preconnect\)\s\+\)\@<=module\ze\s"
syntax match quilloPath "\(^\s*\(import\|client\|preload\|preconnect\)\s\+\(module\s\+\)\=\)\@<=[^ \t"]\+\ze\s\+use\>"
syntax match quilloPath "\(^\s*use\s\+\)\@<=[^ \t",*]*[/.][^ \t",]*"

" Routes: the method and the path.
syntax match quilloMethod "\(^\s*route\s\+\)\@<=\(GET\|POST\|PUT\|PATCH\|DELETE\|HEAD\|OPTIONS\|ANY\)\>"
syntax match quilloRoutePath "\(^\s*route\s\+\u\+\s\+\)\@<=/[^ \t{=?]*"
syntax match quilloRoutePath "\(^\s*\(routes\|mount\|service\)\s\+\)\@<=/[^ \t{=|]*"

" Types and effects.
syntax match quilloType "^\s*\(private\s\+\|public\s\+\)\=type\s\+\zs\u\w*"
syntax match quilloType ":\s*\zs\(int\|float\|dec\|num\|str\|date\|bool\|list\|map\|html\|fn\|any\|response\)\>"
syntax match quilloType "\(->\|!\)\s*\zs\h\w*"
syntax match quilloEffect "\(\<with\s\+\(\(db\|http\|fs\|env\|time\|random\|net\)\s*,\s*\)*\)\@<=\(db\|http\|fs\|env\|time\|random\|net\)\>"

" Calls.
syntax match quilloCall "\<\h\w*\ze\s*("
syntax match quilloBuiltin "\<\(print\|str\|int\|float\|dec\|len\|type_of\|upper\|lower\|trim\|split\|join\|contains\|starts_with\|ends_with\|replace\|slice\|map\|filter\|find\|any\|all\|reduce\|sum\|min\|max\|sort\|sort_by\|reverse\|first\|last\|push\|range\|enumerate\|keys\|values\|get\|has\|set\|remove\|merge\|err\|is_err\|unwrap\|raw\|escape\|url_encode\|env\|now\|sleep\|file\|redirect\|respond\|read_file\|write_file\|random\|random_int\|uuid\|abs\|round\|floor\|ceil\|sqrt\|pow\|unique\|flatten\|zip\|take\|drop\|count\|group_by\|index_of\|repeat\|format_number\|live\|publish\|watch\|unwatched\|delete_file\|check_program\|join_on\|markdown\|highlight\|run_script\|sql_name\|sql_param\|ask\|notify\|translations\|locale_from\|locale\|with_locale\|t\|schedule\|allow_cross_site\|tenant\|tenant_from\|with_tenant\|save_upload\|read_upload\|js\|js_new\|parallel\|every\|stream\|events\|listen\|receive\|url\|css\|sql\|navigate\|set_cookie\|delete_cookie\|session\|set_session\|end_session\|sessions\|renew_session\|end_sessions\|user_sessions\|rate_limit\|rate_limit_reset\|security_headers\|csp\|csp_nonce\|idempotent\|args\|cookie\|cursor_index\|defer\|error\|exit\|filled\|js_has\|local_path\|new_tenant\|normalize\|page_updated\|platform\|read_line\|ready\|run_after\|site_headers\|stdin\|style_with\|waiting\|accept_calls\|classes\|files\|markdown_page\|confirm\|mcp_token\|mcp_tokens\|revoke_mcp_token\|about\)\ze\s*("
syntax match quilloModule "\<\(json\|db\|http\|udp\|channel\|media\|crypto\|image\|math\|stats\|vec\|date\|money\|re\|bit\|later\)\ze\."

" Definitions, after calls so their names are not taken for one.
syntax match quilloFunction "\(\<\(fn\|view\)\s\+\)\@<=\h\w*"
syntax match quilloType "\(\<component\s\+\)\@<=\u\w*"
" `fn mcp total()`, `server fn mcp add_note()`: `mcp` with a name after it on its line is the tag
" of a tool; `fn mcp(x)` and the second `mcp` of `fn mcp mcp()` name a function (quillo
" FEEDBACK56.md, Q-853). Defined after the definitions, so the tag wins where both start.
syntax match quilloFunction "\(\<\(fn\|view\)\s\+mcp\s\+\)\@<=\h\w*"
syntax match quilloType "\(\<component\s\+mcp\s\+\)\@<=\u\w*"
syntax match quilloStatement "\(\<\(fn\|view\|component\)\s\+\)\@<=mcp\ze\s\+\h"
" `service mcp /billing = ...`, `service mcp crm = ...`: the tag, with a path or a name after it;
" `service mcp = ...` and `service mcp /* note */ = ...` name a service `mcp`.
syntax match quilloStatement "\(^\s*service\s\+\)\@<=mcp\ze\s\+\(\h\|/[/*]\@!\)"
syntax match quilloRoutePath "\(^\s*service\s\+mcp\s\+\)\@<=/[/*]\@![^ \t{=|]*"

" Braces nest, so a `}` or `>` inside one closes nothing outside it.
syntax region quilloBraces start="{" end="}" transparent contains=TOP

" Markup: tags, attributes, events.
syntax match quilloTagName "</\=\zs\a[[:alnum:]_-]*" contained
syntax match quilloAttribute "\s\zs[@:]\=\h[[:alnum:]_:@.-]*\ze=" contained
syntax match quilloEvent "\s\zs@\h[[:alnum:]_.-]*" contained
syntax region quilloElement start="<\ze\a" end="/\=>" contains=quilloTagName,quilloAttribute,quilloEvent,quilloString,quilloAttributeValue,quilloUnquoted,quilloBraces
" HTML as written: <!-- comments -->, <!DOCTYPE html>, and values with no quotes (`/>` ends them).
syntax region quilloHtmlComment start="<!--" end="-->" contains=@Spell
syntax match quilloDoctype "<!\c\(doctype\)\s\+html\s*>"
syntax match quilloUnquoted "=\zs\([^ \t"'=<>`{}/]\|/>\@!\)\+" contained
syntax region quilloElement start="</\ze\a" end=">" contains=quilloTagName
syntax region quilloAttributeValue matchgroup=quilloBrace start="={" end="}" contained contains=TOP

highlight default link quilloLineComment Comment
highlight default link quilloBlockComment Comment
highlight default link quilloTodo Todo
highlight default link quilloShebang PreProc
highlight default link quilloString String
highlight default link quilloTemplate String
highlight default link quilloEscape SpecialChar
highlight default link quilloInterpolationDelimiter Delimiter
highlight default link quilloTag Macro
highlight default link quilloNumber Number
highlight default link quilloKeyword Keyword
highlight default link quilloConditional Conditional
highlight default link quilloRepeat Repeat
highlight default link quilloReturn Statement
highlight default link quilloBoolean Boolean
highlight default link quilloNull Constant
highlight default link quilloStatement Keyword
highlight default link quilloImport Include
highlight default link quilloPath String
highlight default link quilloMethod Constant
highlight default link quilloRoutePath String
highlight default link quilloFunction Function
highlight default link quilloType Type
highlight default link quilloEffect Type
highlight default link quilloCall Function
highlight default link quilloBuiltin Function
highlight default link quilloModule Identifier
highlight default link quilloTagName Statement
highlight default link quilloAttribute Type
highlight default link quilloEvent Keyword
highlight default link quilloHtmlComment Comment
highlight default link quilloDoctype PreProc
highlight default link quilloUnquoted String

" Start from far enough back that a comment, template or element begun above is seen.
syntax sync minlines=200

let b:current_syntax = "quillo"
let &cpo = s:cpo_save
unlet s:cpo_save
