-- Quillo for Neovim: the filetypes (ftdetect/), tree-sitter-quillo's parser and queries,
-- `quillo lsp` and `quillo dap`. require("quillo").setup() puts them together.
local M = {}

M.repository = "https://github.com/quillolang/editors"

--- target/release/quillo, then target/debug/quillo, in `dir` (nil: the folder Neovim runs in).
local function build_in(dir)
  local uv = vim.uv or vim.loop
  for _, p in ipairs({ "target/release/quillo", "target/debug/quillo" }) do
    local full = dir and (dir .. "/" .. p) or p
    if uv.fs_stat(full) then
      return uv.fs_realpath(full) or full
    end
  end
end

--- The folder of `folders` (one, or a list) that Neovim runs in or below, resolved, or nil.
local function listed_folder(folders)
  local uv = vim.uv or vim.loop
  local here = uv.cwd and uv.cwd()
  here = here and uv.fs_realpath(here)
  if not here then
    return nil
  end
  for _, d in ipairs(type(folders) == "string" and { folders } or folders) do
    local real = uv.fs_realpath(vim.fs.normalize(d))
    local after = real and here:sub(#real + 1, #real + 1)
    if real and here:sub(1, #real) == real and (after == "" or after == "/" or after == "\\") then
      return real
    end
  end
end

--- The quillo binary: opts.cmd, then quillo on the PATH. A build in a folder is used only when
--- opts.local_binary asks: true for the folder Neovim runs in, or a folder (or a list of them)
--- whose build is used when Neovim runs in it or below. Looking in whatever folder Neovim ran in
--- let a cloned repository's target/release/quillo run when one of its files was opened
--- (FEEDBACK71.md, Q-967; branch q967-binary).
function M.binary(opts)
  opts = opts or {}
  if opts.cmd and opts.cmd ~= "" then
    return opts.cmd
  end
  local want = opts.local_binary
  if want == true then
    return build_in(nil) or "quillo"
  elseif type(want) == "string" or type(want) == "table" then
    local dir = listed_folder(want)
    return dir and build_in(dir) or "quillo"
  end
  return "quillo"
end

M.root_markers = { "main.qwe", "app.toml", ".git" }

--- The folder quillo lsp works from for the file `name`, or nil to leave it alone: a .rs
--- file no program uses is a crate's (rust_files.lua).
function M.root_for(name)
  if name:match("%.rs$") and not require("quillo.rust_files").used_by_program(name) then
    return nil
  end
  local found = vim.fs.find(M.root_markers, { path = name, upward = true })[1]
  return found and vim.fs.dirname(found) or vim.fs.dirname(name)
end

--- The language server's configuration, for vim.lsp.config: .qwe, .qwer, and the .rs files a
--- program uses.
function M.lsp_config(opts)
  return {
    cmd = { M.binary(opts), "lsp" },
    filetypes = { "quillo", "qwer", "rust" },
    root_markers = M.root_markers,
    root_dir = function(bufnr, on_dir)
      local root = M.root_for(vim.api.nvim_buf_get_name(bufnr))
      if root then
        on_dir(root)
      end
    end,
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

--- opts.cmd: the quillo binary; opts.local_binary: the build of the folder Neovim runs in
--- (true), or of the folders listed, before quillo on the PATH; opts.lsp = false: do not start
--- quillo lsp; opts.dap = false: do not add the debugger.
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
          default_config = { cmd = c.cmd, filetypes = c.filetypes, root_dir = M.root_for },
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
