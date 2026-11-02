-- The plugin's Lua run in LuaJIT (Neovim's Lua) against a stand-in for Neovim's API:
-- what each part registers, on Neovim 0.11 and before, with nvim-treesitter's master and
-- main branches, with nvim-dap and without. Run: luajit test/run.lua (from neovim/)
package.path = "./lua/?.lua;./lua/?/init.lua;" .. package.path

local failed, count = 0, 0
local function check(what, ok, got)
  count = count + 1
  if not ok then
    failed = failed + 1
    print("FAIL " .. what .. (got ~= nil and ("\n  got " .. tostring(got)) or ""))
  end
end

local state
local function fresh(o)
  o = o or {}
  state = { added = {}, registered = {}, lsp = {}, enabled = {}, autocmds = {}, bo = {}, started = {}, cmds = {} }
  for k in pairs(package.loaded) do
    if k:match("^quillo") or k:match("^nvim%-treesitter") or k == "dap" or k:match("^lspconfig") then
      package.loaded[k] = nil
    end
  end
  package.preload["nvim-treesitter.parsers"] = nil
  package.preload["dap"] = nil
  package.preload["lspconfig"] = nil
  package.preload["lspconfig.configs"] = nil
  package.preload["lspconfig.util"] = nil
  local files = o.files or {}
  _G.vim = {
    v = { lnum = 1 },
    bo = state.bo,
    uv = {
      fs_stat = function(p) return files[p] and {} or nil end,
      fs_realpath = function(p) return "/work/" .. p end,
    },
    api = {
      nvim_buf_get_lines = function(_, _, _, _) return { o.first_line } end,
      nvim_create_autocmd = function(ev, a) table.insert(state.autocmds, { ev = ev, a = a }) end,
    },
    filetype = { add = function(r) table.insert(state.added, r) end },
    treesitter = {
      language = { register = function(lang, ft) state.registered[ft] = lang end },
      start = function(_, lang) table.insert(state.started, lang or "quillo"); if o.no_parser then error("no parser") end end,
    },
    cmd = function(c) table.insert(state.cmds, c) end,
    lsp = {},
  }
  if not o.old_nvim then
    vim.lsp.config = function(name, cfg) state.lsp[name] = cfg end
    vim.lsp.enable = function(name) table.insert(state.enabled, name) end
  end
  if o.treesitter == "master" then
    local configs = {}
    state.ts_configs = configs
    package.preload["nvim-treesitter.parsers"] = function() return { get_parser_configs = function() return configs end } end
  elseif o.treesitter == "main" then
    local parsers = {}
    state.ts_parsers = parsers
    package.preload["nvim-treesitter.parsers"] = function() return parsers end
  end
  if o.dap then
    state.dap = { adapters = {}, configurations = o.dap_configurations or {} }
    package.preload["dap"] = function() return state.dap end
  end
  if o.lspconfig then
    state.lspconfig = { configs = {}, setups = {} }
    package.preload["lspconfig.configs"] = function() return state.lspconfig.configs end
    package.preload["lspconfig.util"] = function() return { root_pattern = function(...) return { ... } end } end
    package.preload["lspconfig"] = function()
      return setmetatable({}, { __index = function(_, k) return { setup = function(c) state.lspconfig.setups[k] = c end } end })
    end
  end
end

-- Every file compiles.
for _, f in ipairs({ "ftdetect/quillo.lua", "ftplugin/quillo.lua", "ftplugin/qwer.lua", "lsp/quillo.lua", "lua/quillo/init.lua", "lua/quillo/filetype.lua" }) do
  local chunk, err = loadfile(f)
  check(f .. " compiles", chunk ~= nil, err)
end

-- Filetypes.
fresh()
local ft = require("quillo.filetype")
for _, l in ipairs({ "#!/usr/bin/env quillo", "#!/usr/local/bin/quillo run", "#!/usr/bin/env -S quillo run --allow-path ." }) do
  check("a script: " .. l, ft.is_script(l) == true)
end
for _, l in ipairs({ "#!/bin/sh", "#!/usr/bin/env quillo2", "#!/usr/bin/env myquillo", "// quillo", " #!/usr/bin/env quillo", "" }) do
  check("not a script: " .. l, ft.is_script(l) == false)
end
check("no line is no script", ft.is_script(nil) == false)
check(".qwe is quillo", ft.rules.extension.qwe == "quillo")
check(".qwer is qwer", ft.rules.extension.qwer == "qwer")
fresh({ first_line = "#!/usr/bin/env quillo" })
local detect = require("quillo.filetype").rules.pattern[".*"]
check("a script's buffer is quillo", detect[1]("tool", 1) == "quillo")
check("the pattern comes last", detect[2].priority == -math.huge)
fresh({ first_line = "#!/bin/bash" })
check("another script's buffer is left alone", require("quillo.filetype").rules.pattern[".*"][1]("tool", 1) == nil)
fresh()
dofile("ftdetect/quillo.lua")
check("ftdetect adds the rules", #state.added == 1 and state.added[1].extension.qwe == "quillo")

-- ftplugin.
fresh()
dofile("ftplugin/quillo.lua")
check("comments are //", state.bo.commentstring == "// %s")
check("tree-sitter starts", state.started[1] == "quillo")
check("indentation from the queries", state.bo.indentexpr == "v:lua.require'quillo'.indent()")
fresh({ no_parser = true })
dofile("ftplugin/quillo.lua")
check("without the parser, no tree-sitter indentation", state.bo.indentexpr == nil)
fresh()
dofile("ftplugin/qwer.lua")
check(".qwer is highlighted as Rust", state.started[1] == "rust" and #state.cmds == 0)
fresh({ no_parser = true })
dofile("ftplugin/qwer.lua")
check("without Rust's parser, Vim's Rust syntax", state.cmds[1] == "runtime! syntax/rust.vim")

-- The binary.
fresh()
local q = require("quillo")
check("quillo on the PATH", q.binary() == "quillo")
check("the option first", q.binary({ cmd = "/opt/quillo" }) == "/opt/quillo")
check("a blank option is none", q.binary({ cmd = "" }) == "quillo")
fresh({ files = { ["target/debug/quillo"] = true } })
check("a debug build here", require("quillo").binary() == "/work/target/debug/quillo")
fresh({ files = { ["target/debug/quillo"] = true, ["target/release/quillo"] = true } })
check("the release build before the debug one", require("quillo").binary() == "/work/target/release/quillo")

-- The language server, on Neovim 0.11.
fresh()
require("quillo").setup()
local c = state.lsp.quillo
check("vim.lsp.config gets quillo lsp", c and c.cmd[1] == "quillo" and c.cmd[2] == "lsp")
check("for .qwe and .qwer", c and c.filetypes[1] == "quillo" and c.filetypes[2] == "qwer")
check("a program's folder is its root", c and c.root_markers[1] == "main.qwe")
check("it is enabled", state.enabled[1] == "quillo")
check(".qwer takes Rust's parser", state.registered.qwer == "rust")
fresh()
require("quillo").setup({ lsp = false })
check("lsp = false starts none", state.lsp.quillo == nil and #state.enabled == 0)
fresh()
require("quillo").setup({ cmd = "/b/quillo" })
check("cmd reaches the server", state.lsp.quillo.cmd[1] == "/b/quillo")
fresh()
local lspfile = dofile("lsp/quillo.lua")
check("lsp/quillo.lua is the config", lspfile.cmd[2] == "lsp" and lspfile.filetypes[2] == "qwer")

-- Before 0.11, through nvim-lspconfig.
fresh({ old_nvim = true, lspconfig = true })
require("quillo").setup()
check("nvim-lspconfig gets a quillo config", state.lspconfig.configs.quillo ~= nil)
check("and sets it up", state.lspconfig.setups.quillo ~= nil)
check("with the plugin's root, which leaves a crate's .rs alone", state.lspconfig.configs.quillo.default_config.root_dir == require("quillo").root_for)
fresh({ old_nvim = true })
local ok = pcall(require("quillo").setup)
check("before 0.11 and without nvim-lspconfig, setup still works", ok)

-- nvim-treesitter.
fresh({ treesitter = "master" })
check("master branch found", require("quillo").register_parser() == "master")
local i = state.ts_configs.quillo.install_info
check("the parser is in tree-sitter/ of the repository", i.url == "https://github.com/quillolang/editors" and i.location == "tree-sitter")
check("with its scanner", i.files[2] == "src/scanner.c")
check("for the quillo filetype", state.ts_configs.quillo.filetype == "quillo")
fresh({ treesitter = "main" })
check("main branch found", require("quillo").register_parser() == "main")
check("main: the parser is listed", state.ts_parsers.quillo.install_info.location == "tree-sitter")
check("main: listed again at TSUpdate", state.autocmds[1] and state.autocmds[1].ev == "User" and state.autocmds[1].a.pattern == "TSUpdate")
state.ts_parsers.quillo = nil
state.autocmds[1].a.callback()
check("main: TSUpdate puts it back", state.ts_parsers.quillo ~= nil)
fresh()
check("without nvim-treesitter, nothing", require("quillo").register_parser() == nil)

-- nvim-dap.
fresh({ dap = true })
require("quillo").setup()
check("the adapter is quillo dap", state.dap.adapters.quillo.command == "quillo" and state.dap.adapters.quillo.args[1] == "dap")
local d = state.dap.configurations.quillo[1]
check("a configuration runs this file", d.type == "quillo" and d.request == "launch" and d.program == "${file}")
fresh({ dap = true, dap_configurations = { quillo = { { name = "mine" } } } })
require("quillo").setup()
check("the user's own configurations stay", state.dap.configurations.quillo[1].name == "mine")
fresh({ dap = true })
require("quillo").setup({ dap = false })
check("dap = false adds none", state.dap.adapters.quillo == nil)
fresh()
check("without nvim-dap, nothing", require("quillo").register_dap() == false)

-- .rs files: quillo lsp only for those a program uses, found on disk. vim.uv and vim.fs
-- stand in through the shell here.
local function sh(cmd)
  local p = io.popen(cmd)
  local out = p:read("*a")
  p:close()
  return out
end
local function real_uv()
  return {
    fs_stat = function(p) return os.execute("test -e '" .. p .. "'") == 0 and {} or nil end,
    fs_realpath = function(p)
      local r = sh("realpath '" .. p .. "' 2>/dev/null"):gsub("\n$", "")
      return r ~= "" and r or nil
    end,
    fs_scandir = function(dir)
      if os.execute("test -d '" .. dir .. "'") ~= 0 then return nil end
      local items = {}
      for line in sh("ls -1Ap '" .. dir .. "' 2>/dev/null"):gmatch("[^\n]+") do
        if line:sub(-1) == "/" then table.insert(items, { line:sub(1, -2), "directory" }) else table.insert(items, { line, "file" }) end
      end
      return { items = items, i = 0 }
    end,
    fs_scandir_next = function(h)
      h.i = h.i + 1
      local e = h.items[h.i]
      if e then return e[1], e[2] end
    end,
  }
end
fresh()
vim.uv = real_uv()
vim.fs = {
  dirname = function(p) return p:match("^(.*)/[^/]*$") end,
  find = function(names, o)
    local dir = o.path:match("^(.*)/[^/]*$")
    while dir and dir ~= "" do
      for _, n in ipairs(names) do
        if os.execute("test -e '" .. dir .. "/" .. n .. "'") == 0 then return { dir .. "/" .. n } end
      end
      dir = dir:match("^(.*)/[^/]*$")
    end
    return {}
  end,
}
local tmp = sh("cd \"$(mktemp -d)\" && pwd -P"):gsub("\n$", "")
local function put(rel, text)
  local full = tmp .. "/" .. rel
  os.execute("mkdir -p '" .. full:match("^(.*)/[^/]*$") .. "'")
  local f = io.open(full, "w")
  f:write(text or "")
  f:close()
  return full
end
local rf = require("quillo.rust_files")
local paths = rf.rust_paths('import tw.rs use f\nuse "lib/a.rs"\nuse x, y from ./b.rs\nlet s = "c.rs"\n// use d.rs\nimport a.rs use f // not b.rs\nuse tw.rs.bak')
check("the paths a line names", table.concat(paths, " ") == "tw.rs lib/a.rs ./b.rs a.rs", table.concat(paths, " "))
put("app/main.qwe", "import tw.rs use tailwind\nuse lib/forum.qwe\n")
local tw = put("app/tw.rs", "pub fn tailwind() -> String { String::new() }\n")
put("app/lib/forum.qwe", "import lib/md.rs use render\nimport ./near.rs use near\n")
check("a .rs file main.qwe imports", rf.used_by_program(tw))
check("a path from the program's folder", rf.used_by_program(put("app/lib/md.rs")))
check("./ from the file that writes it", rf.used_by_program(put("app/lib/near.rs")))
local loose = put("app/lib/loose.rs")
check("a .rs file nothing names", not rf.used_by_program(loose))
check("not there", not rf.used_by_program(tmp .. "/app/none.rs"))
put("crate/Cargo.toml", "[package]\n")
put("crate/src/notes.qwe", "// tw.rs\n")
check("a crate's own .rs file", not rf.used_by_program(put("crate/src/main.rs")))
put("outer/main.qwe", "import inner/crate/src/x.rs use f\n")
put("outer/inner/crate/Cargo.toml", "[package]\n")
check("not above a Cargo.toml", not rf.used_by_program(put("outer/inner/crate/src/x.rs")))
put("deep/main.qwe", "import a/b/c/d/e.rs use e\n")
check("five folders below, not found", not rf.used_by_program(put("deep/a/b/c/d/e.rs")))
put("deep2/main.qwe", "import a/b/c/f.rs use f\n")
check("four folders below, found", rf.used_by_program(put("deep2/a/b/c/f.rs")))
local q = require("quillo")
check("a used .rs file gets its program's root", q.root_for(tw) == tmp .. "/app", q.root_for(tw))
check("an unused one gets no server", q.root_for(loose) == nil)
check("a .qwe file gets its root", q.root_for(tmp .. "/app/main.qwe") == tmp .. "/app")
check("rust is among the server's filetypes", q.lsp_config().filetypes[3] == "rust")
local attached = {}
vim.api.nvim_buf_get_name = function(b) return b end
q.lsp_config().root_dir(tw, function(r) table.insert(attached, r) end)
q.lsp_config().root_dir(loose, function(r) table.insert(attached, r) end)
check("root_dir attaches to the used file only", #attached == 1 and attached[1] == tmp .. "/app", #attached)
os.execute("rm -rf '" .. tmp .. "'")

print(failed > 0 and (failed .. " of " .. count .. " failed") or ("all " .. count .. " Neovim checks passed"))
os.exit(failed > 0 and 1 or 0)
