"""quillo-mode.el without Emacs: it reads as Lisp (balanced, strings and character literals
closed), its tree-sitter queries compile against tree-sitter-quillo (each feature's, with
the keyword list and :match predicates as Emacs builds them), the node types its indent rules,
defuns and imenu name are the grammar's, every face is one Emacs 29 has, and its lists are
the VS Code grammar's. Run: python3 test/check.py (from emacs/)."""
import json
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.join(HERE, "..")
TS = os.path.join(REPO, "tree-sitter")
SRC = open(os.path.join(HERE, "quillo-mode.el"), encoding="utf-8").read()
failed = 0
count = 0


def check(what, ok, got=None):
    global failed, count
    count += 1
    if not ok:
        failed += 1
        print("FAIL %s%s" % (what, "" if got is None else "\n  got %r" % (got,)))


def tokens(text):
    """Lisp's tokens: strings, character literals, comments skipped, brackets kept."""
    i, out = 0, []
    while i < len(text):
        c = text[i]
        if c == ";":
            i = text.find("\n", i)
            i = len(text) if i < 0 else i
        elif c == '"':
            j = i + 1
            while j < len(text) and text[j] != '"':
                j += 2 if text[j] == "\\" else 1
            if j >= len(text):
                return None, "a string at %d is never closed" % i
            out.append(("str", text[i : j + 1], i))
            i = j + 1
        elif c == "?":
            # ?x, ?\(, ?\n: a character
            i += 3 if text[i + 1 : i + 2] == "\\" else 2
        elif c in "()[]":
            out.append((c, c, i))
            i += 1
        else:
            i += 1
    return out, None


toks, err = tokens(SRC)
check("every string is closed", err is None, err)
depth, bad = 0, None
pairs = {")": "(", "]": "["}
stack = []
for kind, _, pos in toks or []:
    if kind in "([":
        stack.append(kind)
    elif kind in ")]":
        if not stack or stack[-1] != pairs[kind]:
            bad = pos
            break
        stack.pop()
check("brackets balance", bad is None and not stack, (bad, SRC[bad - 40 : bad + 10] if bad else stack))


def lisp_strings(name):
    m = re.search(r"\(defconst %s\s+'\(((?:\s|\"[^\"]*\")*)\)" % re.escape(name), SRC)
    return re.findall(r'"([^"]*)"', m.group(1)) if m else None


builtins = lisp_strings("quillo--builtins")
modules = lisp_strings("quillo--modules")
keywords = lisp_strings("quillo--keywords")
tm = json.load(open(os.path.join(REPO, "vscode/syntaxes/quillo.tmLanguage.json")))
want_builtins = re.search(r"\\b\((.*?)\)\\b", tm["repository"]["call"]["patterns"][0]["match"]).group(1).split("|")
want_modules = re.search(r"\\b\((.*?)\)", tm["repository"]["module-call"]["match"]).group(1).split("|")
check("the builtins are the VS Code grammar's", builtins == want_builtins, sorted(set(want_builtins) ^ set(builtins or [])))
check("the modules are the VS Code grammar's", modules == want_modules)

# The font-lock rules: each feature's query, as Emacs builds it.
fl = SRC[SRC.index("(defvar quillo-ts-mode--font-lock-settings") : SRC.index('"Font-lock rules for')]
features = re.findall(r":feature '(\w+)\s*(?::override t\s*)?([`'])\(", fl)
check("every feature has a query", len(features) >= 12, features)
soft = re.search(r"\(member k '\(([^)]*)\)\)", fl).group(1)
soft = re.findall(r'"([^"]*)"', soft)
queries = {}
for m in re.finditer(r":feature '(\w+)\s*(?::override t\s*)?[`']\(", fl):
    start = m.end() - 1
    d, j = 0, start
    while True:
        ch = fl[j]
        if ch == '"':
            j = fl.index('"', j + 1)
        elif ch == "(":
            d += 1
        elif ch == ")":
            d -= 1
            if d == 0:
                break
        j += 1
    body = fl[start + 1 : j]
    body = re.sub(r"\[,@\(seq-filter.*?quillo--keywords\)\]", "[" + " ".join('"%s"' % k for k in keywords if k not in soft) + "]", body, flags=re.S)
    body = re.sub(
        r"\(:match ,\(rx-to-string `\(seq bos \(or ,@quillo--(\w+)\) eos\)\) (@[\w-]+)\)",
        lambda mm: '(#match? %s "^(%s)$")' % (mm.group(2), "|".join(builtins if mm.group(1) == "builtins" else modules)),
        body,
    )
    check("feature %s has nothing Emacs builds left" % m.group(1), ",@" not in body and ",(" not in body, body[:200])
    queries[m.group(1)] = body

sample = os.path.join(tempfile.mkdtemp(), "s.qwe")
open(sample, "w").write("let a = 1\n")
for name, q in queries.items():
    qf = os.path.join(tempfile.mkdtemp(), name + ".scm")
    open(qf, "w").write(q)
    r = subprocess.run(["npx", "tree-sitter", "query", qf, sample], cwd=TS, capture_output=True, text=True)
    check("feature %s compiles against the grammar" % name, r.returncode == 0, (r.stderr or r.stdout)[:300])

# Node types named outside the queries.
nodes = {n["type"] for n in json.load(open(os.path.join(TS, "src/node-types.json")))}
for n in re.findall(r'\((?:parent-is|node-is) "(\w+)"\)', SRC):
    check("indent rule's %s is a node" % n, n in nodes or n in ("}", "]", ")"))
for n in re.findall(r'"\\\\`(\w+)\\\\\'"', SRC):
    check("imenu's %s is a node" % n, n in nodes)
for n in re.findall(r'\(rx bos \(or ((?:"\w+"\s*)+)\) eos\)', SRC)[0].split():
    check("defun %s is a node" % n.strip('"'), n.strip('"') in nodes)
types = {n["type"]: n for n in json.load(open(os.path.join(TS, "src/node-types.json"))) if n.get("named")}
body = re.search(r"\(pcase \(treesit-node-type node\)(.*?)\n\n", SRC, re.S).group(1)
arms = re.findall(r'^\s*\(\((?:or )?((?:"\w+"\s*)+)\)|^\s*\("(\w+)"', body, re.M)
named = [t for a, b in arms for t in (re.findall(r'"(\w+)"', a) if a else [b])]
check("the defun name knows four kinds", sorted(named) == sorted(["function_definition", "component_definition", "type_definition", "route"]), named)
fields = {"function_definition": ["name"], "component_definition": ["name"], "type_definition": ["name"], "route": ["method", "path"]}
for kind, want in fields.items():
    for field in want:
        check("%s has a field %s" % (kind, field), field in types[kind].get("fields", {}))
used_fields = set(re.findall(r'child-by-field-name node "(\w+)"', body))
check("the defun name uses only those fields", used_fields == {f for fs in fields.values() for f in fs}, used_fields)

# Faces: every one is in Emacs 29.
FACES = set(
    "font-lock-comment-face font-lock-comment-delimiter-face font-lock-string-face font-lock-doc-face font-lock-keyword-face "
    "font-lock-builtin-face font-lock-function-name-face font-lock-function-call-face font-lock-variable-name-face "
    "font-lock-variable-use-face font-lock-type-face font-lock-constant-face font-lock-warning-face font-lock-negation-char-face "
    "font-lock-preprocessor-face font-lock-escape-face font-lock-number-face font-lock-operator-face font-lock-property-name-face "
    "font-lock-property-use-face font-lock-punctuation-face font-lock-bracket-face font-lock-delimiter-face "
    "font-lock-misc-punctuation-face font-lock-regexp-grouping-backslash font-lock-regexp-grouping-construct".split()
)
used = set(re.findall(r"@?(font-lock-[\w-]+-face)", SRC))
check("every face is one Emacs 29 has", used <= FACES, sorted(used - FACES))

# Where it hooks in.
check(".qwe opens in the best mode", '("\\\\.qwe\\\\\'" . quillo-best-mode)' in SRC)
check("a quillo script opens in it", '(add-to-list \'interpreter-mode-alist \'("quillo" . quillo-best-mode))' in SRC)
check("the grammar is tree-sitter/src of this repository", '"https://github.com/quillolang/editors" "main" "tree-sitter/src"' in SRC)
check("the grammar's folder is there", os.path.exists(os.path.join(TS, "src/parser.c")))
check("eglot runs quillo lsp", "(,quillo-program \"lsp\")" in SRC)
check("dape runs quillo dap", 'command-args ("dap")' in SRC and ":request \"launch\"" in SRC)
check("it provides quillo-mode", "(provide 'quillo-mode)" in SRC and SRC.rstrip().endswith(";;; quillo-mode.el ends here"))
check("lexical binding", SRC.splitlines()[0].endswith("-*- lexical-binding: t; -*-"))

print("%s Emacs checks %s" % (("%d of %d" % (failed, count)) if failed else "all %d" % count, "failed" if failed else "passed"))
sys.exit(1 if failed else 0)
