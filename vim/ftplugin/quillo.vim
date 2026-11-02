" Quillo: comments, indentation, gf on import lines, and :make runs quillo check.
if exists("b:did_ftplugin")
  finish
endif
let b:did_ftplugin = 1

setlocal commentstring=//\ %s
setlocal comments=s1:/*,mb:*,ex:*/,://
setlocal shiftwidth=4 tabstop=4 softtabstop=4 expandtab
setlocal suffixesadd=.qwe,.qwer
setlocal include=^\\s*\\(import\\\|use\\)\\s\\+
setlocal makeprg=quillo\ check\ %
let &l:errorformat = '%f:%l: %m,%-Gquillo: %.%#'

let b:undo_ftplugin = "setlocal commentstring< comments< shiftwidth< tabstop< softtabstop< expandtab< suffixesadd< include< makeprg< errorformat<"
