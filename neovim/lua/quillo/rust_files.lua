-- Which .rs files quillo lsp is given: those a program uses (FEEDBACK37.md, Q-453). Most .rs
-- files are a crate's, and quillo would run cargo check on each and warn of every pub fn it
-- cannot export. So a .rs buffer gets quillo lsp only when a .qwe file names it on a `use` or
-- `import` line, looked for as quillo's own program_entry looks: in the file's folder and up to
-- three above it, not above a Cargo.toml or a .git, the .qwe files there and three folders
-- down. The same rule as the VS Code extension's rust-files.js.
local M = {}

local MAX_FILES = 400

local function uv()
  return vim.uv or vim.loop
end

local function real(p)
  return uv().fs_realpath(p) or p
end

local function join(a, b)
  return (a:gsub("/$", "")) .. "/" .. b
end

local function dirname(p)
  return p:match("^(.*)/[^/]*$") or "."
end

local function exists(p)
  return uv().fs_stat(p) ~= nil
end

--- The .rs paths a .qwe file's `use` and `import` lines name, as written.
function M.rust_paths(text)
  local out = {}
  for line in (text .. "\n"):gmatch("([^\n]*)\n") do
    local rest
    for _, w in ipairs({ "use", "import", "client", "preload", "preconnect" }) do
      rest = rest or line:match("^%s*" .. w .. "%f[^%w_](.*)$")
    end
    if rest then
      rest = rest:gsub("//.*$", "")
      for quoted in rest:gmatch('"([^"]+%.rs)"') do
        table.insert(out, quoted)
      end
      local unquoted = rest:gsub('"[^"]*"', " ")
      for p in unquoted:gmatch("[^%s,;]+") do
        if p:match("%.rs$") then
          table.insert(out, p)
        end
      end
    end
  end
  return out
end

local function qwe_files(dir, depth, out)
  local handle = uv().fs_scandir(dir)
  if not handle then
    return out
  end
  local names = {}
  while true do
    local name, kind = uv().fs_scandir_next(handle)
    if not name then
      break
    end
    table.insert(names, { name, kind })
  end
  table.sort(names, function(a, b) return a[1] < b[1] end)
  for _, e in ipairs(names) do
    if #out >= MAX_FILES then
      break
    end
    local name, kind = e[1], e[2]
    if not (name:sub(1, 1) == "." or name == "node_modules" or name == "target") then
      local full = join(dir, name)
      if kind == "file" and name:match("%.qwe$") then
        table.insert(out, full)
      elseif kind == "directory" and depth > 0 then
        qwe_files(full, depth - 1, out)
      end
    end
  end
  return out
end

local function names(qwe, base, target)
  local f = io.open(qwe, "r")
  if not f then
    return false
  end
  local text = f:read("*a")
  f:close()
  for _, p in ipairs(M.rust_paths(text)) do
    -- `./` and `../` count from the file that writes them; the rest from the program's folder.
    local from = (p:sub(1, 2) == "./" or p:sub(1, 3) == "../") and { dirname(qwe) } or { base, dirname(qwe) }
    for _, d in ipairs(from) do
      if real(join(d, p)) == target then
        return true
      end
    end
  end
  return false
end

--- Whether a program uses the .rs file `file`.
function M.used_by_program(file)
  if type(file) ~= "string" or not file:match("%.rs$") or not exists(file) then
    return false
  end
  local target = real(file)
  local dir = dirname(target)
  for _ = 1, 4 do
    for _, q in ipairs(qwe_files(dir, 3, {})) do
      if names(q, dir, target) then
        return true
      end
    end
    if exists(join(dir, "Cargo.toml")) or exists(join(dir, ".git")) then
      return false
    end
    local up = dirname(dir)
    if up == dir or up == "" then
      return false
    end
    dir = up
  end
  return false
end

return M
