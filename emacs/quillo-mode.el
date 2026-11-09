;;; quillo-mode.el --- Major modes for Quillo -*- lexical-binding: t; -*-

;; Version: 0.1.0
;; Package-Requires: ((emacs "29.1"))
;; Keywords: languages
;; URL: https://github.com/quillolang/editors
;; SPDX-License-Identifier: MIT

;;; Commentary:

;; Quillo's .qwe files: `quillo-ts-mode', on tree-sitter-quillo (Emacs 29 and later, with
;; the grammar installed: M-x quillo-install-grammar), or `quillo-mode', on regular
;; expressions, where it is not.  A .qwe file opens in whichever can run.  A .qwer file is
;; Rust and opens in Rust's mode.
;;
;; quillo lsp is set up for eglot and quillo dap for dape when either is loaded.

;;; Code:

(require 'treesit)
(eval-when-compile (require 'rx))

(defgroup quillo nil
  "Quillo, the small web language."
  :group 'languages
  :prefix "quillo-")

(defcustom quillo-indent-offset 4
  "How many columns a Quillo block indents by."
  :type 'integer
  :safe #'integerp)

(defcustom quillo-program "quillo"
  "The quillo binary, for its language server and debugger."
  :type 'string)

(defconst quillo--grammar-source
  '(quillo "https://github.com/quillolang/editors" "main" "tree-sitter/src")
  "Where tree-sitter-quillo is, for `treesit-install-language-grammar'.")

(defconst quillo--builtins
  '("print" "str" "int" "float" "dec" "len" "type_of" "upper" "lower" "trim" "split" "join"
    "contains" "starts_with" "ends_with" "replace" "slice" "map" "filter" "find" "any" "all"
    "reduce" "sum" "min" "max" "sort" "sort_by" "reverse" "first" "last" "push" "range"
    "enumerate" "keys" "values" "get" "has" "set" "remove" "merge" "err" "is_err" "unwrap" "raw"
    "escape" "url_encode" "env" "now" "sleep" "file" "redirect" "respond" "read_file"
    "write_file" "random" "random_int" "uuid" "abs" "round" "floor" "ceil" "sqrt" "pow" "unique"
    "flatten" "zip" "take" "drop" "count" "group_by" "index_of" "repeat" "format_number" "live"
    "publish" "watch" "unwatched" "delete_file" "check_program" "join_on" "markdown" "highlight"
    "run_script" "sql_name" "sql_param" "ask" "notify" "translations" "locale_from" "locale"
    "with_locale" "t" "schedule" "allow_cross_site" "tenant" "tenant_from" "with_tenant"
    "save_upload" "read_upload" "js" "js_new" "parallel" "every" "stream" "events" "listen"
    "receive" "url" "css" "sql" "navigate" "set_cookie" "delete_cookie" "session" "set_session"
    "end_session" "sessions" "renew_session" "end_sessions" "user_sessions" "rate_limit"
    "rate_limit_reset" "security_headers" "csp" "csp_nonce" "idempotent" "args" "cookie"
    "cursor_index" "defer" "error" "exit" "filled" "js_has" "local_path" "new_tenant"
    "normalize" "page_updated" "platform" "read_line" "ready" "run_after" "site_headers" "stdin"
    "style_with" "waiting" "accept_calls" "classes" "files" "markdown_page" "confirm" "mcp_token"
    "mcp_tokens" "revoke_mcp_token" "about")
  "Quillo's builtin functions, as the VS Code extension's grammar has them.")

(defconst quillo--modules
  '("json" "db" "http" "udp" "channel" "media" "crypto" "image" "math" "stats" "vec" "date"
    "money" "re" "bit" "later")
  "Quillo's builtin modules.")

(defconst quillo--keywords
  '("let" "fn" "view" "component" "route" "routes" "use" "import" "client" "preload"
    "preconnect" "module" "from" "as" "with" "if" "else" "match" "for" "in" "while" "return"
    "reply" "type" "state" "style" "global" "site" "service" "mount" "server" "private" "public"
    "build")
  "Quillo's keywords, the words that are keywords only in their own statement too.")

;;;; The syntax table, for both modes

(defvar quillo-mode-syntax-table
  (let ((table (make-syntax-table)))
    (modify-syntax-entry ?/ ". 124b" table)
    (modify-syntax-entry ?* ". 23" table)
    (modify-syntax-entry ?\n "> b" table)
    (modify-syntax-entry ?\" "\"" table)
    (modify-syntax-entry ?\' "\"" table)
    (modify-syntax-entry ?` "\"" table)
    (modify-syntax-entry ?\\ "\\" table)
    (modify-syntax-entry ?_ "_" table)
    (dolist (c '(?+ ?- ?= ?% ?< ?> ?& ?| ?! ?? ?~ ?@ ?#))
      (modify-syntax-entry c "." table))
    table)
  "Syntax table for Quillo: // and /* */ comments, three kinds of strings.")

;;;; quillo-ts-mode

(defvar quillo-ts-mode--font-lock-settings
  (treesit-font-lock-rules
   :language 'quillo
   :feature 'comment
   '((comment) @font-lock-comment-face
     (html_comment) @font-lock-comment-face
     (shebang) @font-lock-preprocessor-face
     (doctype) @font-lock-preprocessor-face)

   :language 'quillo
   :feature 'keyword
   `([,@(seq-filter (lambda (k) (not (member k '("import" "client" "preload" "preconnect" "type" "state" "style" "site" "service" "mount" "server" "private" "public" "routes" "module" "global" "from" "with" "build")))) quillo--keywords)]
     @font-lock-keyword-face
     (import_statement ["import" "client" "preload" "preconnect" "module" "use"] @font-lock-keyword-face)
     (use_statement ["use" "from" "with" "preload" "preconnect"] @font-lock-keyword-face)
     (type_definition "type" @font-lock-keyword-face)
     (state_declaration ["state" "~"] @font-lock-keyword-face)
     (style_statement ["style" "global"] @font-lock-keyword-face)
     (site_declaration "site" @font-lock-keyword-face)
     (service_declaration "service" @font-lock-keyword-face)
     (mount_declaration "mount" @font-lock-keyword-face)
     (build_declaration "build" @font-lock-keyword-face)
     (function_definition "for" @font-lock-keyword-face)
     (route_group "routes" @font-lock-keyword-face)
     (effects "with" @font-lock-keyword-face)
     (server) @font-lock-keyword-face
     ;; `fn mcp total()`, `service mcp /billing`: the tag of a tool (quillo FEEDBACK56.md, Q-853).
     (mcp) @font-lock-keyword-face
     (visibility) @font-lock-keyword-face)

   :language 'quillo
   :feature 'definition
   '((function_definition name: (identifier) @font-lock-function-name-face)
     (component_definition name: (identifier) @font-lock-type-face)
     (type_definition name: (type_identifier) @font-lock-type-face)
     (parameter name: (identifier) @font-lock-variable-name-face)
     (lambda parameter: (identifier) @font-lock-variable-name-face)
     (let_declaration pattern: (identifier) @font-lock-variable-name-face)
     (state_declaration name: (identifier) @font-lock-variable-name-face)
     (site_declaration name: (identifier) @font-lock-variable-name-face)
     (import_name name: (identifier) @font-lock-function-name-face)
     (import_name alias: (identifier) @font-lock-function-name-face))

   :language 'quillo
   :feature 'string
   '((string) @font-lock-string-face
     (template_string) @font-lock-string-face
     (tagged_template (string_content) @font-lock-string-face)
     (unquoted_path) @font-lock-string-face
     (attribute_value) @font-lock-string-face
     (route_path) @font-lock-string-face)

   :language 'quillo
   :feature 'escape
   :override t
   '((escape_sequence) @font-lock-escape-face
     (template_substitution ["${" "}"] @font-lock-misc-punctuation-face))

   :language 'quillo
   :feature 'type
   '((type_identifier) @font-lock-type-face
     (effect) @font-lock-type-face
     (http_method) @font-lock-constant-face)

   :language 'quillo
   :feature 'builtin
   `(((call_expression function: (identifier) @font-lock-builtin-face)
      (:match ,(rx-to-string `(seq bos (or ,@quillo--builtins) eos)) @font-lock-builtin-face))
     ((member_expression object: (identifier) @font-lock-builtin-face)
      (:match ,(rx-to-string `(seq bos (or ,@quillo--modules) eos)) @font-lock-builtin-face))
     (accept_calls_statement (identifier) @font-lock-builtin-face))

   :language 'quillo
   :feature 'constant
   '([(true) (false) (null)] @font-lock-constant-face
     (wildcard) @font-lock-constant-face)

   :language 'quillo
   :feature 'number
   '((number) @font-lock-number-face)

   :language 'quillo
   :feature 'function
   '((call_expression function: (identifier) @font-lock-function-call-face)
     (call_expression function: (member_expression property: (property_identifier) @font-lock-function-call-face))
     (tagged_template tag: (identifier) @font-lock-function-call-face))

   :language 'quillo
   :feature 'property
   '((property_identifier) @font-lock-property-use-face
     (field_type name: (property_identifier) @font-lock-property-name-face))

   :language 'quillo
   :feature 'tag
   '((tag_name) @font-lock-function-call-face
     (attribute_name) @font-lock-constant-face
     (class_selector (selector_name) @font-lock-constant-face)
     (id_selector (selector_name) @font-lock-constant-face))

   :language 'quillo
   :feature 'operator
   '(["=" "+=" "-=" "==" "!=" "<=" ">=" "+" "-" "*" "/" "%" "!" "&&" "||" "??" "|" ".." "..." "->" "=>" "?"]
     @font-lock-operator-face)

   :language 'quillo
   :feature 'bracket
   '(["(" ")" "[" "]" "{" "}"] @font-lock-bracket-face)

   :language 'quillo
   :feature 'delimiter
   '(["," ";" ":" "."] @font-lock-delimiter-face))
  "Font-lock rules for `quillo-ts-mode'.")

(defvar quillo-ts-mode--indent-rules
  `((quillo
     ((parent-is "source_file") column-0 0)
     ((node-is "}") parent-bol 0)
     ((node-is "]") parent-bol 0)
     ((node-is ")") parent-bol 0)
     ((node-is "end_tag") parent-bol 0)
     ((parent-is "block") parent-bol quillo-indent-offset)
     ((parent-is "map") parent-bol quillo-indent-offset)
     ((parent-is "list") parent-bol quillo-indent-offset)
     ((parent-is "arguments") parent-bol quillo-indent-offset)
     ((parent-is "parameters") parent-bol quillo-indent-offset)
     ((parent-is "match_expression") parent-bol quillo-indent-offset)
     ((parent-is "route_group") parent-bol quillo-indent-offset)
     ((parent-is "shape_type") parent-bol quillo-indent-offset)
     ((parent-is "record_pattern") parent-bol quillo-indent-offset)
     ((parent-is "element") parent-bol quillo-indent-offset)
     ((parent-is "binary_expression") parent-bol quillo-indent-offset)
     ((parent-is "route") parent-bol quillo-indent-offset)
     ((parent-is "function_definition") parent-bol quillo-indent-offset)
     ((parent-is "let_declaration") parent-bol quillo-indent-offset)
     (no-node parent-bol 0)))
  "Indentation rules for `quillo-ts-mode'.")

(defun quillo-ts-mode--defun-name (node)
  "The name of the definition NODE: a function's, a component's, a type's, a route's."
  (pcase (treesit-node-type node)
    ((or "function_definition" "component_definition" "type_definition")
     (treesit-node-text (treesit-node-child-by-field-name node "name") t))
    ("route"
     (concat (treesit-node-text (treesit-node-child-by-field-name node "method") t) " "
             (treesit-node-text (treesit-node-child-by-field-name node "path") t)))))

;;;###autoload
(define-derived-mode quillo-ts-mode prog-mode "Quillo"
  "Major mode for Quillo, on tree-sitter-quillo."
  :group 'quillo
  :syntax-table quillo-mode-syntax-table
  (unless (treesit-ready-p 'quillo)
    (error "No tree-sitter-quillo: M-x quillo-install-grammar"))
  (treesit-parser-create 'quillo)
  (setq-local comment-start "// ")
  (setq-local comment-end "")
  (setq-local comment-start-skip (rx "//" (* "/") (* (syntax whitespace))))
  (setq-local treesit-font-lock-settings quillo-ts-mode--font-lock-settings)
  (setq-local treesit-font-lock-feature-list
              '((comment definition)
                (keyword string type)
                (builtin constant escape number function property tag)
                (operator bracket delimiter)))
  (setq-local treesit-simple-indent-rules quillo-ts-mode--indent-rules)
  (setq-local treesit-defun-type-regexp
              (rx bos (or "function_definition" "component_definition" "type_definition" "route") eos))
  (setq-local treesit-defun-name-function #'quillo-ts-mode--defun-name)
  (setq-local treesit-simple-imenu-settings
              '(("Function" "\\`function_definition\\'" nil nil)
                ("Component" "\\`component_definition\\'" nil nil)
                ("Type" "\\`type_definition\\'" nil nil)
                ("Route" "\\`route\\'" nil nil)))
  (treesit-major-mode-setup))

;;;; quillo-mode: regular expressions, where tree-sitter-quillo cannot run

(defvar quillo-mode-font-lock-keywords
  `((,(rx bol "#!" (* nonl)) . font-lock-preprocessor-face)
    (,(rx bol (* space) (or "import" "client" "preload" "preconnect") (+ space) (opt "module" (+ space))
          (group (+ (not (any space)))) (+ space) "use" symbol-end)
     (0 font-lock-keyword-face) (1 font-lock-string-face t))
    ;; `service mcp /billing = ...`, `service mcp crm = ...`: the tag of a tool, with a path or a
    ;; name after it on its line; `service mcp = ...` and `service mcp /* note */ = ...` name a
    ;; service `mcp` (quillo FEEDBACK56.md, Q-853).
    (,(rx bol (* space) (group "service") (+ (any " \t")) (group "mcp") (+ (any " \t"))
          (or (any alpha "_") (seq "/" (or eol (not (any "/" "*"))))))
     (1 font-lock-keyword-face) (2 font-lock-keyword-face))
    (,(rx bol (* space) "service" (+ (any " \t")) "mcp" (+ (any " \t"))
          (group "/" (not (any space "/" "*" "{" "=" "?" "|")) (* (not (any space "{" "=" "?" "|")))))
     (1 font-lock-string-face))
    (,(rx bol (* space) (group (or "route" "routes" "mount" "service")) (+ space)
          (opt (group (or "GET" "POST" "PUT" "PATCH" "DELETE" "HEAD" "OPTIONS" "ANY")) (+ space))
          (group "/" (* (not (any space "{" "=" "?" "|")))))
     (1 font-lock-keyword-face) (2 font-lock-constant-face nil t) (3 font-lock-string-face))
    ;; `fn mcp total()`, `server fn mcp add_note()`: `mcp` with a name after it on its line is
    ;; the tag of a tool; `fn mcp(x)` and the second `mcp` of `fn mcp mcp()` name a function.
    (,(rx symbol-start (or "fn" "view" "component") (+ (any " \t")) (group "mcp") (+ (any " \t"))
          (group (any alpha "_") (* (or word (syntax symbol)))))
     (1 font-lock-keyword-face) (2 font-lock-function-name-face))
    (,(rx symbol-start (or "fn" "view" "component") (+ space) (group (+ (or word (syntax symbol)))))
     (1 font-lock-function-name-face))
    (,(rx symbol-start "type" (+ space) (group upper (* (or word (syntax symbol)))) (* space) "=")
     (1 font-lock-type-face))
    (,(rx symbol-start (or "let" "state") (+ space) (group (+ (or word (syntax symbol)))))
     (1 font-lock-variable-name-face))
    (,(rx symbol-start (or "let" "fn" "view" "component" "if" "else" "match" "for" "in" "while"
                           "return" "reply" "use" "as" "from" "with")
          symbol-end)
     . font-lock-keyword-face)
    (,(rx bol (* space) (or "private" "public" "server" "state" "style" "site" "type") symbol-end)
     . font-lock-keyword-face)
    ;; `public server fn x()`: `server` after `private` or `public` starts its definition too.
    (,(rx bol (* space) (or "private" "public") (+ (any " \t")) (group "server") (+ space) "fn" symbol-end)
     (1 font-lock-keyword-face))
    (,(rx bol (* space) (group "build") (+ space) "\"" (* (not (any "\""))) "\"" (* space) "=" (not (any "=")))
     (1 font-lock-keyword-face))
    (,(rx bol (* space) (group "accept_calls") (* space) "{") (1 font-lock-builtin-face))
    (,(rx "<!--" (*? anything) "-->") 0 font-lock-comment-face t)
    (,(rx "<!" (any "dD") (any "oO") (any "cC") (any "tT") (any "yY") (any "pP") (any "eE") (+ space) "html" (* space) ">")
     . font-lock-preprocessor-face)
    (,(rx symbol-start (or "true" "false" "null") symbol-end) . font-lock-constant-face)
    (,(rx-to-string `(seq symbol-start (group (or ,@quillo--builtins)) (* space) "(") t) (1 font-lock-builtin-face))
    (,(rx-to-string `(seq symbol-start (group (or ,@quillo--modules)) ".") t) (1 font-lock-builtin-face))
    (,(rx symbol-start (+ digit) (* (any digit "_")) (opt "." (+ digit)) (opt (any "eE") (opt (any "+-")) (+ digit)) (opt "m") symbol-end)
     . font-lock-constant-face)
    (,(rx "</" (group (+ (or word "-"))) ">") (1 font-lock-function-call-face))
    (,(rx "<" (group alpha (* (or word "-"))) (or space ">" "/" "." "#")) (1 font-lock-function-call-face))
    (,(rx (or space "<" alnum) (group (or "@" (seq "bind:")) (+ (or word "-" ":" "."))) "=") (1 font-lock-constant-face)))
  "Font-lock keywords for `quillo-mode'.")

(defun quillo-indent-line ()
  "Indent this line by the brackets open at its start."
  (interactive)
  (let* ((depth (save-excursion (car (syntax-ppss (line-beginning-position)))))
         (closer (save-excursion (back-to-indentation) (looking-at-p (rx (any "}])")))))
         (col (* quillo-indent-offset (max 0 (- depth (if closer 1 0))))))
    (if (<= (current-column) (current-indentation))
        (indent-line-to col)
      (save-excursion (indent-line-to col)))))

;;;###autoload
(define-derived-mode quillo-mode prog-mode "Quillo"
  "Major mode for Quillo, on regular expressions: use `quillo-ts-mode' where it can run."
  :group 'quillo
  :syntax-table quillo-mode-syntax-table
  (setq-local comment-start "// ")
  (setq-local comment-end "")
  (setq-local font-lock-defaults '(quillo-mode-font-lock-keywords))
  (setq-local indent-line-function #'quillo-indent-line))

;;;; Which mode a file opens in, the grammar, eglot and dape

;;;###autoload
(defun quillo-best-mode ()
  "Open the buffer in `quillo-ts-mode' if tree-sitter-quillo can run, else `quillo-mode'."
  (if (and (fboundp 'treesit-ready-p) (treesit-ready-p 'quillo t))
      (quillo-ts-mode)
    (quillo-mode)))

;;;###autoload
(defun quillo-install-grammar ()
  "Build and install tree-sitter-quillo, from tree-sitter/ in quillolang/editors."
  (interactive)
  (add-to-list 'treesit-language-source-alist quillo--grammar-source)
  (treesit-install-language-grammar 'quillo))

;;;###autoload
(progn
  (add-to-list 'auto-mode-alist '("\\.qwe\\'" . quillo-best-mode))
  (add-to-list 'auto-mode-alist
               (cons "\\.qwer\\'" (if (fboundp 'rust-ts-mode) 'rust-ts-mode 'rust-mode)))
  (add-to-list 'interpreter-mode-alist '("quillo" . quillo-best-mode)))

(with-eval-after-load 'treesit
  (add-to-list 'treesit-language-source-alist quillo--grammar-source))

(with-eval-after-load 'eglot
  (defvar eglot-server-programs)
  (add-to-list 'eglot-server-programs
               `((quillo-ts-mode quillo-mode) . (,quillo-program "lsp"))))

(with-eval-after-load 'dape
  (defvar dape-configs)
  (add-to-list 'dape-configs
               `(quillo
                 modes (quillo-ts-mode quillo-mode)
                 command ,quillo-program
                 command-args ("dap")
                 :type "quillo"
                 :request "launch"
                 :program dape-buffer-default
                 :cwd dape-cwd
                 :args ["--watch"])))

(provide 'quillo-mode)

;;; quillo-mode.el ends here
