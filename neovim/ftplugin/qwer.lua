-- A .qwer file is Rust: Rust's parser highlights it, and quillo lsp says what it exports.
vim.bo.commentstring = "// %s"
vim.bo.shiftwidth = 4
vim.bo.expandtab = true
if not pcall(vim.treesitter.start, 0, "rust") then
  vim.cmd("runtime! syntax/rust.vim")
end
