"""The Sublime Text package: its grammars are the VS Code extension's, every rule a grammar
includes is there, the settings parse as Sublime reads them, the build system finds quillo's
errors, and the LSP plugin registers quillo. Run: python3 -m unittest discover -s test
(from sublime/). QUILLO_BIN, if set, runs `quillo check` for the error pattern."""
import json
import os
import plistlib
import re
import subprocess
import sys
import tempfile
import types
import unittest

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VSCODE = os.path.join(HERE, "..", "vscode")


def sublime_json(name):
    """Sublime's JSON: comments and trailing commas allowed."""
    text = open(os.path.join(HERE, name), encoding="utf-8").read()
    text = re.sub(r'("(?:[^"\\]|\\.)*")|//[^\n]*', lambda m: m.group(1) or "", text)
    text = re.sub(r",(\s*[}\]])", r"\1", text)
    return json.loads(text)


def plist(name):
    with open(os.path.join(HERE, name), "rb") as f:
        return plistlib.load(f)


def includes(node, out):
    if isinstance(node, dict):
        for k, v in node.items():
            if k == "include" and isinstance(v, str):
                out.append(v)
            else:
                includes(v, out)
    elif isinstance(node, list):
        for v in node:
            includes(v, out)
    return out


class Grammars(unittest.TestCase):
    def test_up_to_date(self):
        r = subprocess.run([sys.executable, os.path.join(HERE, "build.py"), "--check"], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout)

    def test_the_vscode_grammars_rule_for_rule(self):
        for tm, js, types_ in [("Quillo.tmLanguage", "quillo.tmLanguage.json", ["qwe"]), ("Quillo Rust.tmLanguage", "qwer.tmLanguage.json", ["qwer"])]:
            g = plist(tm)
            want = json.load(open(os.path.join(VSCODE, "syntaxes", js), encoding="utf-8"))
            for k in ("$schema", "fileTypes", "firstLineMatch"):
                want.pop(k, None)
            self.assertEqual(g["fileTypes"], types_)
            got = {k: v for k, v in g.items() if k not in ("fileTypes", "firstLineMatch")}
            self.assertEqual(got, want, tm)

    def test_every_include_is_there(self):
        for tm in ["Quillo.tmLanguage", "Quillo Rust.tmLanguage"]:
            g = plist(tm)
            for inc in includes(g, []):
                if inc.startswith("#"):
                    self.assertIn(inc[1:], g["repository"], "%s includes %s" % (tm, inc))
                else:
                    # Another grammar: Sublime's own CSS, SQL, Rust, or $self.
                    self.assertTrue(inc in ("$self", "$base") or inc.split("#")[0] in ("source.css", "source.sql", "source.rust", "source.toml"), inc)

    def test_a_script_by_its_first_line(self):
        first = re.compile(plist("Quillo.tmLanguage")["firstLineMatch"])
        for yes in ["#!/usr/bin/env quillo", "#!/usr/local/bin/quillo run"]:
            self.assertTrue(first.search(yes), yes)
        for no in ["#!/bin/sh", "#!/usr/bin/env quillo2", "// quillo"]:
            self.assertFalse(first.search(no), no)

    def test_scopes_match_the_settings(self):
        selector = sublime_json("LSP-quillo.sublime-settings")["selector"]
        for tm in ["Quillo.tmLanguage", "Quillo Rust.tmLanguage"]:
            self.assertIn(plist(tm)["scopeName"], selector)
        self.assertIn("source.quillo", plist("Comments.tmPreferences")["scope"])
        self.assertIn("source.qwer", plist("Comments.tmPreferences")["scope"])


class Preferences(unittest.TestCase):
    def test_comments(self):
        v = {s["name"]: s["value"] for s in plist("Comments.tmPreferences")["settings"]["shellVariables"]}
        self.assertEqual(v["TM_COMMENT_START"], "// ")
        self.assertEqual((v["TM_COMMENT_START_2"], v["TM_COMMENT_END_2"]), ("/*", "*/"))

    def test_indentation(self):
        s = plist("Indentation Rules.tmPreferences")["settings"]
        inc, dec = re.compile(s["increaseIndentPattern"]), re.compile(s["decreaseIndentPattern"])
        for line in ["fn f() {", "route GET / =", "    <div>", "let xs = ["]:
            self.assertTrue(inc.match(line), line)
        for line in ["let a = 1", "<br/>", "x == 1"]:
            self.assertFalse(inc.match(line), line)
        for line in ["}", "    ]", "</div>"]:
            self.assertTrue(dec.match(line), line)


class Build(unittest.TestCase):
    def setUp(self):
        self.build = sublime_json("Quillo.sublime-build")
        self.regex = re.compile(self.build["file_regex"])

    def test_commands(self):
        self.assertEqual(self.build["cmd"][:2], ["quillo", "run"])
        names = {v["name"]: v["cmd"] for v in self.build["variants"]}
        self.assertEqual(names["Check"][:2], ["quillo", "check"])

    def test_the_error_pattern(self):
        m = self.regex.match("/home/me/app/main.qwe:2: error: unknown name `nope` (did you mean `now`?)")
        self.assertIsNotNone(m)
        self.assertEqual((m.group(1), m.group(2)), ("/home/me/app/main.qwe", "2"))
        self.assertEqual(m.group(4), "error: unknown name `nope` (did you mean `now`?)")
        self.assertIsNone(self.regex.match("quillo: 1 error"))

    @unittest.skipUnless(os.environ.get("QUILLO_BIN"), "QUILLO_BIN is not set")
    def test_what_quillo_check_prints(self):
        d = tempfile.mkdtemp()
        main = os.path.join(d, "main.qwe")
        with open(main, "w") as f:
            f.write("let a = 1\nprint(nope)\n")
        out = subprocess.run([os.environ["QUILLO_BIN"], "check", main], capture_output=True, text=True)
        lines = [l for l in (out.stdout + out.stderr).splitlines() if self.regex.match(l)]
        self.assertEqual(len(lines), 1, out.stdout + out.stderr)
        m = self.regex.match(lines[0])
        self.assertEqual((os.path.realpath(m.group(1)), m.group(2)), (os.path.realpath(main), "2"))


class Lsp(unittest.TestCase):
    def test_settings(self):
        s = sublime_json("LSP-quillo.sublime-settings")
        self.assertEqual(s["command"], ["quillo", "lsp"])
        self.assertTrue(s["enabled"])

    def test_the_plugin_registers_quillo(self):
        calls = []

        class AbstractPlugin:
            pass

        lsp = types.ModuleType("LSP")
        lsp_plugin = types.ModuleType("LSP.plugin")
        lsp_plugin.AbstractPlugin = AbstractPlugin
        lsp_plugin.register_plugin = lambda c: calls.append(("register", c))
        lsp_plugin.unregister_plugin = lambda c: calls.append(("unregister", c))
        sys.modules["LSP"], sys.modules["LSP.plugin"] = lsp, lsp_plugin
        try:
            ns = {}
            exec(compile(open(os.path.join(HERE, "plugin.py")).read(), "plugin.py", "exec"), ns)
            ns["plugin_loaded"]()
            ns["plugin_unloaded"]()
        finally:
            del sys.modules["LSP"], sys.modules["LSP.plugin"]
        cls = ns["LspQuilloPlugin"]
        # The LSP package reads LSP-<name>.sublime-settings.
        self.assertEqual(cls.name(), "quillo")
        self.assertTrue(os.path.exists(os.path.join(HERE, "LSP-%s.sublime-settings" % cls.name())))
        self.assertEqual(calls, [("register", cls), ("unregister", cls)])

    def test_python_38(self):
        # Sublime Text 4 runs the plugin on Python 3.8 (.python-version).
        self.assertEqual(open(os.path.join(HERE, ".python-version")).read().strip(), "3.8")
        import ast

        ast.parse(open(os.path.join(HERE, "plugin.py")).read(), "plugin.py", feature_version=(3, 8))


if __name__ == "__main__":
    unittest.main()
