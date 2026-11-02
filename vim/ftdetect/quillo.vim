" .qwe files are Quillo, .qwer files Rust, and a script whose first line runs quillo is Quillo.
autocmd BufRead,BufNewFile *.qwe setfiletype quillo
autocmd BufRead,BufNewFile *.qwer setfiletype rust
autocmd BufRead,BufNewFile * if getline(1) =~# '^#!.*\(\/\|\s\|^#!\)quillo\(\s\|$\)' | setfiletype quillo | endif
