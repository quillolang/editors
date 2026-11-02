vim.bo.commentstring = "// %s"
vim.bo.comments = "s1:/*,mb:*,ex:*/,://"
vim.bo.shiftwidth = 4
vim.bo.tabstop = 4
vim.bo.expandtab = true
-- Highlighting from tree-sitter-quillo, when its parser is installed (see the README).
if pcall(vim.treesitter.start) then
  vim.bo.indentexpr = "v:lua.require'quillo'.indent()"
end
