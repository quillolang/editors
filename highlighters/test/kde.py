"""kde/quillo.xml: every context, style and list it names is there, every pattern compiles,
the lists are the VS Code grammar's, and the sample read the way KDE's engine reads (the
parts of it this file uses: DetectSpaces, DetectChar, Detect2Chars, RegExpr, keyword,
DetectIdentifier, IncludeRules, fallthrough and line-end contexts) gives each word its style.
Run: python3 test/kde.py (from highlighters/)."""
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
root = ET.parse(os.path.join(HERE, "kde/quillo.xml")).getroot()
hl = root.find("highlighting")
failed = 0
count = 0


def check(what, ok, got=None):
    global failed, count
    count += 1
    if not ok:
        failed += 1
        print("FAIL %s%s" % (what, "" if got is None else "\n  got %r" % (got,)))


lists = {l.get("name"): [i.text.strip() for i in l.findall("item")] for l in hl.findall("list")}
contexts = {c.get("name"): c for c in hl.find("contexts")}
styles = {d.get("name"): d.get("defStyleNum") for d in hl.find("itemDatas")}
DEFAULT_STYLES = set(
    "dsNormal dsKeyword dsFunction dsVariable dsControlFlow dsOperator dsBuiltIn dsExtension dsPreprocessor dsAttribute "
    "dsChar dsSpecialChar dsString dsVerbatimString dsSpecialString dsImport dsDataType dsDecVal dsBaseN dsFloat dsConstant "
    "dsComment dsDocumentation dsAnnotation dsCommentVar dsRegionMarker dsInformation dsWarning dsAlert dsOthers dsError".split()
)

# What it names is there.
for name, d in styles.items():
    check("style %s is one of KDE's" % name, d in DEFAULT_STYLES, d)
for cname, c in contexts.items():
    for attr in ("lineEndContext", "fallthroughContext"):
        v = c.get(attr)
        if v and not v.startswith("#"):
            check("%s's %s %s is a context" % (cname, attr, v), v in contexts)
    check("context %s's style is there" % cname, c.get("attribute") in styles, c.get("attribute"))
    for r in c:
        if r.get("attribute"):
            check("%s: %s's style %s is there" % (cname, r.tag, r.get("attribute")), r.get("attribute") in styles)
        ctx = r.get("context")
        if ctx and not ctx.startswith("#"):
            check("%s: %s's context %s is there" % (cname, r.tag, ctx), ctx in contexts)
        if r.tag == "keyword":
            check("%s: list %s is there" % (cname, r.get("String")), r.get("String") in lists)
        if r.tag == "RegExpr":
            try:
                re.compile(r.get("String"))
                ok = True
            except re.error as e:
                ok = str(e)
            check("%s: %s compiles" % (cname, r.get("String")[:40]), ok is True, ok)
check("the language is for .qwe", root.get("extensions") == "*.qwe" and root.get("name") == "Quillo")

tm = json.load(open(os.path.join(HERE, "../vscode/syntaxes/quillo.tmLanguage.json")))
want_b = re.search(r"\\b\((.*?)\)\\b", tm["repository"]["call"]["patterns"][0]["match"]).group(1).split("|")
want_m = re.search(r"\\b\((.*?)\)", tm["repository"]["module-call"]["match"]).group(1).split("|")
check("the builtins are the VS Code grammar's", lists["builtins"] == want_b)
check("the modules are the VS Code grammar's", lists["modules"] == want_m)
in_regex = [r.get("String") for r in contexts["Normal"].findall("RegExpr")]
check("the builtin pattern has the list", any(s.startswith(r"\b(" + "|".join(want_b) + ")") for s in in_regex))
check("the module pattern has the list", any(s.startswith(r"\b(" + "|".join(want_m) + ")") for s in in_regex))

# The sample, read as KDE's engine reads it.
DELIMS = set(" \t.():!+,-<=>%&*/;?[]^{|}~\\")


def rules(cname, seen=()):
    for r in contexts[cname]:
        if r.tag == "IncludeRules":
            if r.get("context") not in seen:
                yield from rules(r.get("context"), seen + (cname,))
        else:
            yield r


def match(r, line, pos):
    t = r.tag
    if t == "DetectSpaces":
        m = re.compile(r"[ \t]+").match(line, pos)
        return m.end() if m else None
    if t == "DetectChar":
        return pos + 1 if line[pos] == r.get("char") else None
    if t == "StringDetect":
        return pos + len(r.get("String")) if line.startswith(r.get("String"), pos) else None
    if t == "Detect2Chars":
        return pos + 2 if line[pos : pos + 2] == r.get("char") + r.get("char1") else None
    if t == "RegExpr":
        if r.get("column") is not None and int(r.get("column")) != pos:
            return None
        if r.get("firstNonSpace") == "true" and line[:pos].strip():
            return None
        m = re.compile(r.get("String"), re.I if r.get("insensitive") == "true" else 0).match(line, pos)
        return m.end() if m and m.end() > pos else None
    if t == "keyword":
        if pos > 0 and line[pos - 1] not in DELIMS:
            return None
        end = pos
        while end < len(line) and line[end] not in DELIMS:
            end += 1
        return end if line[pos:end] in lists[r.get("String")] else None
    if t == "DetectIdentifier":
        m = re.compile(r"[A-Za-z_]\w*").match(line, pos)
        return m.end() if m else None
    raise ValueError(t)


def switch(stack, to):
    if not to or to == "#stay":
        return
    for part in re.findall(r"#pop|[^#!]+", to):
        if part == "#pop":
            if len(stack) > 1:
                stack.pop()
        else:
            stack.append(part)


def read(text):
    stack, out = ["Normal"], []
    for line in text.split("\n"):
        pos, styled = 0, []
        while pos < len(line):
            ctx = contexts[stack[-1]]
            for r in rules(stack[-1]):
                end = match(r, line, pos)
                if end is not None:
                    styled.append((line[pos:end], r.get("attribute") or ctx.get("attribute")))
                    switch(stack, r.get("context"))
                    pos = end
                    break
            else:
                if ctx.get("fallthroughContext"):
                    switch(stack, ctx.get("fallthroughContext"))
                    continue
                styled.append((line[pos], ctx.get("attribute")))
                pos += 1
        out.append(styled)
        switch(stack, contexts[stack[-1]].get("lineEndContext"))
    return out


sample = open(os.path.join(HERE, "test/sample.qwe")).read()
lines = read(sample)
check("every character is kept", "\n".join("".join(t for t, _ in l) for l in lines) == sample)


def style(n, text):
    """The style of `text` on line n (from 1): the piece holding it, joined with its neighbours of one style."""
    merged = []
    for t, s in lines[n - 1]:
        if merged and merged[-1][1] == s:
            merged[-1] = (merged[-1][0] + t, s)
        else:
            merged.append((t, s))
    for t, s in merged:
        if text in t:
            return s
    return None


for n, text, want in [
    (1, "#!/usr/bin/env quillo", "Shebang"),
    (2, "A comment", "Comment"),
    (3, "import", "Keyword"),
    (3, "lib/forum.qwe", "Path"),
    (3, "use", "Keyword"),
    (4, "site", "Keyword"),
    (4, "https://shop", "String"),
    (5, "private", "Keyword"),
    (5, "add", "Function"),
    (5, "int", "Type"),
    (5, "10", "Number"),
    (6, "route", "Keyword"),
    (6, "GET", "Constant"),
    (6, "/users/:id(int)", "Path"),
    (6, "find_user", "Function"),
    (7, "client", "Normal Text"),
    (8, "len", "Builtin"),
    (8, "12.50m", "Number"),
    (9, "Hello", "String"),
    (9, "${", "Interpolation"),
    (10, "css", "Function"),
    (11, "db", "Builtin"),
    (11, "select count", "String"),
    (12, "if", "Keyword"),
    (12, "true", "Constant"),
    (13, "Counter", "Function"),
    (14, "state", "Keyword"),
    (15, "<button", "Tag"),
    (15, ".big", "Attribute"),
    (15, "@click", "Attribute"),
    (15, "disabled", "Attribute"),
]:
    got = style(n, text)
    check("line %d: %s is %s" % (n, text, want), got == want, got)
# An indented route, in a group, is a route too.
group = read("routes /admin {\n    route GET /users = users()\n}\n")
check("a route in a group", [s for t, s in group[1] if t == "route"] == ["Keyword"] and [s for t, s in group[1] if t == "/users"] == ["Path"], group[1])
for n, text, want in [
    (17, "build", "Keyword"),
    (17, "classes", "Builtin"),
    (18, "accept_calls", "Builtin"),
    (19, "box", "String"),
    (19, "'A cat'", "String"),
    (19, "<!-- a note -->", "Comment"),
    (19, "a.png", "String"),
    (20, "<!DOCTYPE html>", "Doctype"),
]:
    got = style(n, text)
    check("line %d: %s is %s" % (n, text, want), got == want, got)
check("the tag after an unquoted value closes", style(19, "</div") == "Tag", lines[18])
# `mcp` before a name on its line is the tag of a tool, and a name everywhere else (quillo
# FEEDBACK56.md, Q-853): each line alone, its words in turn.
for line, want in [
    ("fn mcp total_today() = 1", [("fn", "Keyword"), ("mcp", "Keyword"), ("total_today", "Function")]),
    ("public server fn mcp add_note(text: str) = text", [("public", "Keyword"), ("fn", "Keyword"), ("mcp", "Keyword"), ("add_note", "Function")]),
    ("server fn mcp add_note(text: str) = text", [("server", "Keyword"), ("fn", "Keyword"), ("mcp", "Keyword"), ("add_note", "Function")]),
    ("fn\tmcp\ttabbed() = 1", [("mcp", "Keyword"), ("tabbed", "Function")]),
    ("fn mcp mcp() = 1", [("fn", "Keyword"), ("mcp", "Keyword"), ("mcp", "Function")]),
    ("fn mcp(x) = x + 1", [("fn", "Keyword"), ("mcp", "Function")]),
    ("fn mcp (x) = x", [("mcp", "Function")]),
    ("view mcp(x) = x", [("mcp", "Function")]),
    ("component mcp Card() = 1", [("mcp", "Keyword"), ("Card", "Function")]),
    ('service mcp /billing = "billing.qwe"', [("service", "Keyword"), ("mcp", "Keyword"), ("/billing", "Path")]),
    ('service mcp crm = "https://crm.example.com/mcp"', [("service", "Keyword"), ("mcp", "Keyword"), ("crm", "Normal Text")]),
    ('service mcp = "mcp.qwe"', [("service", "Keyword"), ("mcp", "Normal Text")]),
    ('service mcp /* note */ = "x.qwe"', [("mcp", "Normal Text"), ("/* note */", "Comment")]),
    ("let mcp = mcp(1)", [("mcp", "Normal Text"), ("mcp", "Function")]),
]:
    merged = []
    for t, s in read(line)[0]:
        if merged and merged[-1][1] == s == "Comment":
            merged[-1] = (merged[-1][0] + t, s)
        else:
            merged.append((t, s))
    merged = [(t, s) for t, s in merged if t.strip()]
    at, ok = 0, True
    for text, sty in want:
        i = next((k for k in range(at, len(merged)) if merged[k][0] == text), None)
        if i is None or merged[i][1] != sty:
            ok = False
            break
        at = i + 1
    check("%r: %s" % (line, ", ".join("%s %s" % w for w in want)), ok, merged)
# Back to code after the markup: the line after the element is read from Normal.
check("after the tag, code", style(16, "}") == "Normal Text", style(16, "}"))
# FEEDBACK56: the `//!` instructions and `///` are comments, `/* */` over lines too; `server` after
# `public` starts its definition; a tool's questions and the door's tokens are builtins.
for n, text, want in [
    (29, "//! Notes are private", "Comment"),
    (30, "/// Adds a note.", "Comment"),
    (31, "public", "Keyword"),
    (31, "server", "Keyword"),
    (31, "save", "Function"),
    (32, "revoke_mcp_token", "Builtin"),
    (32, "a block", "Comment"),
    (33, "comment */", "Comment"),
    (33, "confirm", "Builtin"),
    (34, "/*x", "Path"),
    (34, "with", "Keyword"),
]:
    got = style(n, text)
    check("line %d: %s is %s" % (n, text, want), got == want, got)
for line, want in [
    ("  private server fn x() = 1", {"server": "Keyword", "fn": "Keyword", "x": "Function"}),
    ("public server = 1", {"server": "Normal Text"}),
    ('let k = ask("Who?", { a: "A" }, "a") ?? mcp_tokens()', {"ask": "Builtin", "mcp_tokens": "Builtin"}),
]:
    words = {}
    for t, s in read(line)[0]:
        for w in re.findall(r"\w+", t):
            words.setdefault(w, s)
    check("%r: %s" % (line, want), all(words.get(w) == s for w, s in want.items()), words)

print("%s KDE checks %s" % (("%d of %d" % (failed, count)) if failed else "all %d" % count, "failed" if failed else "passed"))
sys.exit(1 if failed else 0)
