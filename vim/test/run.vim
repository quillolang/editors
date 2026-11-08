" The Vim package, in Vim: vim -Nu NONE -i NONE -es -S test/run.vim (from vim/).
" QUILLO_BIN, if set, runs quillo check for :make's error format.
let s:here = expand('<sfile>:p:h:h')
execute 'set runtimepath^=' . fnameescape(s:here)
filetype plugin indent on
syntax on

function! s:At(lnum, text) abort
  let col = stridx(getline(a:lnum), a:text) + 1
  call assert_true(col > 0, 'line ' . a:lnum . ' has ' . a:text)
  return synIDattr(synID(a:lnum, col, 1), 'name')
endfunction

function! s:Is(lnum, text, group) abort
  call assert_equal(a:group, s:At(a:lnum, a:text), 'line ' . a:lnum . ': ' . a:text)
endfunction

" The group of the second `text` on the line: `fn mcp mcp()`'s name.
function! s:IsSecond(lnum, text, group) abort
  let col = stridx(getline(a:lnum), a:text, stridx(getline(a:lnum), a:text) + 1) + 1
  call assert_true(col > 0, 'line ' . a:lnum . ' has ' . a:text . ' twice')
  call assert_equal(a:group, synIDattr(synID(a:lnum, col, 1), 'name'), 'line ' . a:lnum . ': the second ' . a:text)
endfunction

" Filetypes.
execute 'edit ' . fnameescape(s:here . '/test/sample.qwe')
call assert_equal('quillo', &filetype, '.qwe')
call assert_equal('// %s', &commentstring)
call assert_equal(4, &shiftwidth)
call assert_equal('quillo check %', &makeprg)
let s:tmp = tempname()
call mkdir(s:tmp, 'p')
call writefile(['pub fn f() -> i64 { 1 }'], s:tmp . '/lib.qwer')
execute 'edit ' . s:tmp . '/lib.qwer'
call assert_equal('rust', &filetype, '.qwer is Rust')
for [first, quillo] in [['#!/usr/bin/env quillo', 1], ['#!/usr/local/bin/quillo run', 1], ['#!/bin/sh', 0], ['#!/usr/bin/env quillo2', 0], ['#!/usr/bin/env myquillo', 0]]
  call writefile([first, 'print(1)'], s:tmp . '/tool')
  execute 'edit! ' . s:tmp . '/tool'
  call assert_equal(quillo, &filetype ==# 'quillo', first)
  bwipeout!
endfor

" Syntax.
execute 'edit ' . fnameescape(s:here . '/test/sample.qwe')
call s:Is(1, 'A sample', 'quilloLineComment')
call s:Is(2, 'import', 'quilloImport')
call s:Is(2, 'lib/forum.qwe', 'quilloPath')
call s:Is(2, 'as', 'quilloKeyword')
call s:Is(3, 'lib/todos', 'quilloString')
call s:Is(4, 'private', 'quilloStatement')
call s:Is(4, 'fn', 'quilloKeyword')
call s:Is(4, 'add', 'quilloFunction')
call s:Is(4, 'int,', 'quilloType')
call s:Is(4, '10', 'quilloNumber')
call s:Is(4, 'db', 'quilloEffect')
call s:Is(5, 'route', 'quilloKeyword')
call s:Is(5, 'GET', 'quilloMethod')
call s:Is(5, '/users', 'quilloRoutePath')
call s:Is(5, 'find_user', 'quilloCall')
call assert_notequal('quilloImport', s:At(6, 'client'), 'client is a name here')
call s:Is(7, 'len', 'quilloBuiltin')
call s:Is(7, '12.50m', 'quilloNumber')
call s:Is(8, 'Hello', 'quilloTemplate')
call s:Is(8, '${', 'quilloInterpolationDelimiter')
call s:Is(9, 'css', 'quilloTag')
call s:Is(10, 'site', 'quilloStatement')
call s:Is(11, 'db', 'quilloModule')
call s:Is(11, 'select', 'quilloString')
call s:Is(12, 'if', 'quilloConditional')
call s:Is(12, 'true', 'quilloBoolean')
call s:Is(12, 'null', 'quilloNull')
call s:Is(14, 'comment', 'quilloBlockComment')
call s:Is(15, 'Counter', 'quilloType')
call s:Is(16, 'state', 'quilloStatement')
call s:Is(17, 'button', 'quilloTagName')
call s:Is(17, '@click', 'quilloEvent')
call s:Is(17, 'disabled', 'quilloElement')

call s:Is(19, 'build', 'quilloStatement')
call s:Is(19, 'classes', 'quilloBuiltin')
call s:Is(20, 'accept_calls', 'quilloBuiltin')
call s:Is(21, 'box', 'quilloUnquoted')
call s:Is(21, 'A cat', 'quilloString')
call s:Is(21, 'a note', 'quilloHtmlComment')
call s:Is(21, 'a.png', 'quilloUnquoted')
call assert_notequal('quilloUnquoted', s:At(21, '/>'), '/> ends the value')
call s:Is(22, 'DOCTYPE', 'quilloDoctype')
call assert_notequal('quilloStatement', s:At(23, 'build'), 'build is a name here')
" `mcp` before a name on its line is the tag of a tool, and a name everywhere else (quillo
" FEEDBACK56.md, Q-853).
call s:Is(24, 'public', 'quilloStatement')
call s:Is(24, 'mcp', 'quilloStatement')
call s:Is(24, 'add_note', 'quilloFunction')
call s:Is(25, 'mcp', 'quilloStatement')
call s:IsSecond(25, 'mcp', 'quilloFunction')
call s:Is(26, 'mcp', 'quilloFunction')
call s:Is(27, 'service', 'quilloStatement')
call s:Is(27, 'mcp', 'quilloStatement')
call s:Is(27, '/billing', 'quilloRoutePath')
call s:Is(28, 'mcp', 'quilloStatement')
call assert_notequal('quilloStatement', s:At(28, 'crm'), 'the service is crm')
call assert_notequal('quilloStatement', s:At(29, 'mcp'), 'a service named mcp')
call assert_notequal('quilloStatement', s:At(30, 'mcp'), 'a service named mcp, then a comment')
call s:Is(30, 'note', 'quilloBlockComment')
call s:Is(31, 'mcp', 'quilloStatement')
call s:Is(31, 'Card', 'quilloType')
call s:Is(32, 'mcp', 'quilloFunction')
call assert_notequal('quilloStatement', s:At(33, 'mcp'), 'let mcp is a name')
call assert_notequal('quilloStatement', synIDattr(synID(33, 11, 1), 'name'), 'mcp(1) is a call')
call s:Is(34, 'mcp', 'quilloStatement')
call s:Is(34, 'tabbed', 'quilloFunction')
call assert_notequal('quilloStatement', s:At(35, 'mcp'), 'mcp at the end of its line is no tag')
call s:Is(36, 'server', 'quilloStatement')
call s:Is(36, 'mcp', 'quilloStatement')
call s:Is(36, 'ping', 'quilloFunction')
" FEEDBACK56: the `//!` instructions and `///` are comments; `server` after `public` starts its
" definition; a tool's questions and the door's tokens are builtins; a group's `/*x` is a path.
call s:Is(37, 'Notes are private', 'quilloLineComment')
call s:Is(38, 'Adds a note', 'quilloLineComment')
call s:Is(39, 'public', 'quilloStatement')
call s:Is(39, 'server', 'quilloStatement')
call s:Is(39, 'save', 'quilloFunction')
call s:Is(40, 'revoke_mcp_token', 'quilloBuiltin')
call s:Is(40, 'confirm', 'quilloBuiltin')
call s:Is(40, 'ask', 'quilloBuiltin')
call s:Is(41, 'mcp_token(', 'quilloBuiltin')
call s:Is(41, 'mcp_tokens', 'quilloBuiltin')
call s:Is(42, '/*x', 'quilloRoutePath')
call s:Is(42, 'with', 'quilloKeyword')
call s:Is(43, '/*m', 'quilloRoutePath')
call s:Is(43, 'a.qwe', 'quilloString')
call s:Is(44, 'server', 'quilloStatement')
call s:Is(44, 'hidden', 'quilloFunction')
call assert_notequal('quilloStatement', s:At(45, 'server'), 'let server is a name')

" Indentation: every line of indent.qwe is where its indent puts it.
execute 'edit ' . fnameescape(s:here . '/test/indent.qwe')
let s:want = map(getline(1, '$'), 'len(matchstr(v:val, "^ *"))')
for l in range(2, line('$'))
  call assert_equal(s:want[l - 1], QuilloIndent(l), 'indent of line ' . l . ': ' . getline(l))
endfor

" :make's error format reads what quillo check prints.
let s:qf = getqflist({'lines': ['/home/me/app/main.qwe:2: error: unknown name `nope` (did you mean `now`?)', 'quillo: 1 error'], 'efm': &l:errorformat}).items
call assert_equal(1, len(filter(copy(s:qf), 'v:val.valid')), 'one error')
call assert_equal(2, s:qf[0].lnum)
call assert_equal('/home/me/app/main.qwe', bufname(s:qf[0].bufnr))
call assert_equal('error: unknown name `nope` (did you mean `now`?)', s:qf[0].text)
if $QUILLO_BIN !=# ''
  call writefile(['let a = 1', 'print(nope)'], s:tmp . '/main.qwe')
  execute 'edit ' . s:tmp . '/main.qwe'
  let &l:makeprg = shellescape($QUILLO_BIN) . ' check %'
  silent make
  let s:qf = filter(getqflist(), 'v:val.valid')
  call assert_equal(1, len(s:qf), 'quillo check found one error')
  call assert_equal(2, get(get(s:qf, 0, {}), 'lnum', 0), 'on line 2')
endif

" The builtins are the VS Code grammar's.
let s:tm = json_decode(join(readfile(s:here . '/../vscode/syntaxes/quillo.tmLanguage.json'), "\n"))
let s:want_b = sort(split(matchstr(s:tm.repository.call.patterns[0].match, '\\b(\zs.\{-}\ze)\\b'), '|'))
let s:syn = join(readfile(s:here . '/syntax/quillo.vim'), "\n")
let s:got_b = sort(split(matchstr(s:syn, 'quilloBuiltin "\\<\\(\zs.\{-}\ze\\)'), '\\|'))
call assert_equal(s:want_b, s:got_b, 'the builtins')

if len(v:errors)
  call writefile(v:errors, '/dev/stderr')
  cquit
endif
call writefile(['all Vim checks passed'], '/dev/stderr')
qall!
