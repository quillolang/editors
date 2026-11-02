-- .qwe files are Quillo; .qwer files are Rust that quillo exports from, with a filetype
-- of their own so `quillo lsp` reaches them; a script whose first line runs quillo is
-- Quillo too.
vim.filetype.add(require("quillo.filetype").rules)
