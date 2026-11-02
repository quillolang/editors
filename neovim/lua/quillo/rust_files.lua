-- Which .rs files quillo lsp is given: those a program uses (FEEDBACK37.md, Q-453). Most .rs
-- files are a crate's, and quillo would run cargo check on each and warn of every pub fn it
-- cannot export. So a .rs buffer gets quillo lsp only when a program reaches it through its
-- `use` and `import` lines. The program is looked for as quillo's own program_entry looks: the
-- .qwe files in the file's folder and in up to three folders above it, not above a Cargo.toml
-- or a .git, each followed through the .qwe files it takes. A folder or file that cannot be
-- read is passed over. The same rule as the VS Code extension's rust-files.js.
local M = {}

local MAX_FILES = 500

local function uv()
  return vim.uv or vim.loop
end

local function real(p)
  return uv().fs_realpath(p)
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

local function unquote(p)
  return p:match('^"(.*)"$') or p
end

--- The files a .qwe file's `use` and `import` lines name, as written: .qwe (a path with no
--- extension is one) and .rs. Browser scripts and .qwer files are left out.
function M.use_paths(text)
  local out = {}
  for raw in (text .. "\n"):gmatch("([^\n]*)\n") do
    local line = raw:gsub("%s//.*$", "")
    local p
    local kind, rest = line:match("^%s*(%a+)%s+(.*)$")
    if kind == "import" or kind == "client" or kind == "preload" or kind == "preconnect" then
      rest = rest:gsub("^module%s+", "")
      local path = rest:match('^("[^"]*")%s+use%f[^%w_]') or rest:match("^(%S+)%s+use%f[^%w_]")
      if kind == "import" and path then
        p = unquote(path)
      end
    elseif kind == "use" then
      rest = rest:gsub("%s+$", "")
      local from = rest:match('%f[%w_]from%s+("[^"]*")$') or rest:match("%f[%w_]from%s+(%S+)$")
      p = unquote(from or rest:match("^(%S+)") or "")
      if not from and not p:find("/", 1, true) and not p:find(".", 1, true) and rest:sub(1, 1) ~= '"' then
        p = nil
      end
    end
    if p and p ~= "" and not p:match("^%a+://") and p:sub(1, 1) ~= "/" then
      if p:match("%.rs$") or p:match("%.qwe$") then
        table.insert(out, p)
      elseif not p:match("%.%w+$") then
        table.insert(out, p .. ".qwe")
      end
    end
  end
  return out
end

--- The .qwe files right in `dir`, sorted.
local function qwe_in(dir)
  local handle = uv().fs_scandir(dir)
  local out = {}
  if not handle then
    return out
  end
  while true do
    local name, kind = uv().fs_scandir_next(handle)
    if not name then
      break
    end
    if kind == "file" and name:match("%.qwe$") then
      table.insert(out, join(dir, name))
    end
  end
  table.sort(out)
  return out
end

local function reaches(main, base, target)
  local todo, seen, count = { main }, {}, 0
  while #todo > 0 do
    local f = table.remove(todo)
    if not seen[f] and count < MAX_FILES then
      seen[f] = true
      count = count + 1
      local h = io.open(f, "r")
      if h then
        local text = h:read("*a") or ""
        h:close()
        for _, p in ipairs(M.use_paths(text)) do
          -- `./` and `../` count from the file that writes them; the rest from the program's folder.
          local from = (p:sub(1, 2) == "./" or p:sub(1, 3) == "../") and dirname(f) or base
          local full = real(join(from, p))
          if full then
            if p:match("%.rs$") then
              if full == target then
                return true
              end
            else
              table.insert(todo, full)
            end
          end
        end
      end
    end
  end
  return false
end

--- Whether a program uses the .rs file `file`.
function M.used_by_program(file)
  if type(file) ~= "string" or not file:match("%.rs$") then
    return false
  end
  local target = real(file)
  if not target then
    return false
  end
  local dir = dirname(target)
  for _ = 1, 4 do
    for _, main in ipairs(qwe_in(dir)) do
      if reaches(main, dir, target) then
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
