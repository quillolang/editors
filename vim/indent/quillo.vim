" Quillo indentation: one level in after an open bracket, a trailing `=` or an open tag,
" one out at a closing bracket or an end tag.
if exists("b:did_indent")
  finish
endif
let b:did_indent = 1

setlocal indentexpr=QuilloIndent(v:lnum)
setlocal indentkeys=0{,0},0),0],!^F,o,O,e,0=</
let b:undo_indent = "setlocal indentexpr< indentkeys<"

if exists("*QuilloIndent")
  finish
endif

function! s:Strip(line) abort
  " Without a trailing // comment and what strings hold, so brackets in them do not count.
  let l = substitute(a:line, '"\(\\.\|[^"\\]\)*"', '""', 'g')
  let l = substitute(l, "'\\(\\\\.\\|[^'\\\\]\\)*'", "''", 'g')
  return substitute(l, '\s*//.*$', '', '')
endfunction

function! QuilloIndent(lnum) abort
  let prev = prevnonblank(a:lnum - 1)
  if prev == 0
    return 0
  endif
  let ind = indent(prev)
  let p = s:Strip(getline(prev))
  let opens = len(substitute(p, '[^{[(]', '', 'g'))
  let closes = len(substitute(p, '[^}\])]', '', 'g'))
  if p =~# '^\s*[}\])]'
    let closes -= 1
  endif
  if opens > closes || p =~# '=\s*$'
    let ind += shiftwidth()
  elseif p =~# '<\a[^>]*[^/]>\s*$' && p !~# '</\a' && p !~# '<\(area\|base\|br\|col\|embed\|hr\|img\|input\|link\|meta\|source\|track\|wbr\)\>'
    let ind += shiftwidth()
  endif
  " After what a trailing `=` began ends, back to where that line was: the body that
  " closes on prev (`</div>`, `}`), or a body of one line.
  let opener = prev
  if p =~# '^\s*\([}\])]\|</\a\)'
    let opener = prev - 1
    while opener > 0 && (indent(opener) > indent(prev) || getline(opener) =~# '^\s*$')
      let opener -= 1
    endwhile
  endif
  if opener == prev || p =~# '^\s*\([}\])]\|</\a\)'
    let before = prevnonblank(opener - 1)
    let starts = opener == prev ? opens <= closes && p !~# '=\s*$' && p !~# '<\a[^>]*[^/]>\s*$' : 1
    if starts && before > 0 && s:Strip(getline(before)) =~# '=\s*$' && indent(before) < indent(opener)
      let ind = indent(before)
    endif
  endif
  let cur = getline(a:lnum)
  if cur =~# '^\s*\([}\])]\|</\a\)'
    let ind -= shiftwidth()
  endif
  return ind < 0 ? 0 : ind
endfunction
