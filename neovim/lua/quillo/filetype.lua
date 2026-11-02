local M = {}

--- Whether a file's first line runs quillo: `#!/usr/bin/env quillo`, `#!/usr/local/bin/quillo run`.
function M.is_script(first_line)
  if type(first_line) ~= "string" or first_line:sub(1, 2) ~= "#!" then
    return false
  end
  for word in first_line:sub(3):gmatch("[^%s]+") do
    local name = word:match("([^/]+)$")
    if name == "quillo" then
      return true
    end
  end
  return false
end

M.rules = {
  extension = {
    qwe = "quillo",
    qwer = "qwer",
  },
  pattern = {
    [".*"] = {
      function(_, bufnr)
        local line = vim.api.nvim_buf_get_lines(bufnr, 0, 1, false)[1]
        if M.is_script(line) then
          return "quillo"
        end
      end,
      { priority = -math.huge },
    },
  },
}

return M
