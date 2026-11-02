-- Quillo for Neovim: the filetypes (ftdetect/), tree-sitter-quillo's parser and queries,
-- `quillo lsp` and `quillo dap`. require("quillo").setup() puts them together.
local M = {}

M.repository = "https://github.com/quillolang/editors"

--- The quillo binary: the option, a build in the folder Neovim runs in, then quillo on the PATH.
function M.binary(opts)
  opts = opts or {}
  if opts.cmd and opts.cmd ~= "" then
    return opts.cmd
  end
  local uv = vim.uv or vim.loop
  for _, p in ipairs({ "target/release/quillo", "target/debug/quillo" }) do
    if uv.fs_stat(p) then
      return uv.fs_realpath(p) or p
    end
  end
  return "quillo"
end

--- The language server's configuration, for vim.lsp.config (and nvim-lspconfig's shape too).
function M.lsp_config(opts)
  return {
    cmd = { M.binary(opts), "lsp" },
    filetypes = { "quillo", "qwer" },
    root_markers = { "main.qwe", "app.toml", ".git" },
  }
end

--- tree-sitter-quillo for nvim-treesitter: its `master` branch (get_parser_configs) and its
--- `main` branch (a table of parsers, read again at User TSUpdate). Returns which it found.
function M.register_parser()
  local ok, parsers = pcall(require, "nvim-treesitter.parsers")
  if not ok then
    return nil
  end
  local info = {
    url = M.repository,
    location = "tree-sitter",
    files = { "src/parser.c", "src/scanner.c" },
    branch = "main",
  }
  if type(parsers.get_parser_configs) == "function" then
    parsers.get_parser_configs().quillo = { install_info = info, filetype = "quillo" }
    return "master"
  end
  local function put()
    require("nvim-treesitter.parsers").quillo = { install_info = info, tier = 3 }
  end
  put()
  vim.api.nvim_create_autocmd("User", { pattern = "TSUpdate", callback = put })
  return "main"
end

--- nvim-dap: the `quillo` adapter (quillo dap) and a configuration that runs this file.
function M.register_dap(opts)
  local ok, dap = pcall(require, "dap")
  if not ok then
    return false
  end
  dap.adapters.quillo = { type = "executable", command = M.binary(opts), args = { "dap" } }
  dap.configurations.quillo = dap.configurations.quillo
    or {
      {
        type = "quillo",
        request = "launch",
        name = "Run this file (quillo dap)",
        program = "${file}",
        args = { "--watch" },
        cwd = "${workspaceFolder}",
      },
    }
  return true
end

--- Indentation from the queries, through nvim-treesitter when it is there.
function M.indent()
  local ok, ts = pcall(require, "nvim-treesitter")
  if ok and type(ts.indentexpr) == "function" then
    return ts.indentexpr()
  end
  local ok2, ind = pcall(require, "nvim-treesitter.indent")
  if ok2 then
    return ind.get_indent(vim.v.lnum)
  end
  return -1
end

--- opts.cmd: the quillo binary; opts.lsp = false: do not start quillo lsp; opts.dap = false:
--- do not add the debugger.
function M.setup(opts)
  opts = opts or {}
  vim.filetype.add(require("quillo.filetype").rules)
  vim.treesitter.language.register("rust", "qwer")
  M.register_parser()
  if opts.lsp ~= false then
    if vim.lsp.config and vim.lsp.enable then
      vim.lsp.config("quillo", M.lsp_config(opts))
      vim.lsp.enable("quillo")
    else
      local ok, configs = pcall(require, "lspconfig.configs")
      if ok then
        local c = M.lsp_config(opts)
        configs.quillo = configs.quillo or {
          default_config = { cmd = c.cmd, filetypes = c.filetypes, root_dir = require("lspconfig.util").root_pattern(unpack(c.root_markers)) },
        }
        require("lspconfig").quillo.setup({})
      end
    end
  end
  if opts.dap ~= false then
    M.register_dap(opts)
  end
end

return M
