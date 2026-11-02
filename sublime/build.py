"""Writes the Sublime Text package's grammars and settings from the VS Code extension's
(../vscode): python3 build.py. With --check it writes nothing, and fails if a file differs
from what it would write.

Sublime reads a TextMate grammar as an XML plist (.tmLanguage); the JSON one VS Code reads
is turned into that, rule for rule. Comments and indentation come from VS Code's
language-configuration.json.
"""
import json
import os
import plistlib
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
VSCODE = os.path.join(HERE, "..", "vscode")


def load(name):
    with open(os.path.join(VSCODE, name), encoding="utf-8") as f:
        return json.load(f)


def grammar(src, file_types, first_line=None):
    g = {k: v for k, v in load(src).items() if k != "$schema"}
    g["fileTypes"] = file_types
    if first_line:
        g["firstLineMatch"] = first_line
    return plistlib.dumps(g, sort_keys=True)


def preferences(name, scope, settings):
    return plistlib.dumps({"name": name, "scope": scope, "settings": settings}, sort_keys=True)


def outputs():
    conf = load("language-configuration.json")
    rules = conf["indentationRules"]
    return {
        "Quillo.tmLanguage": grammar("syntaxes/quillo.tmLanguage.json", ["qwe"], r"^#!.*\bquillo\b"),
        "Quillo Rust.tmLanguage": grammar("syntaxes/qwer.tmLanguage.json", ["qwer"]),
        "Comments.tmPreferences": preferences(
            "Comments",
            "source.quillo, source.qwer",
            {
                "shellVariables": [
                    {"name": "TM_COMMENT_START", "value": conf["comments"]["lineComment"] + " "},
                    {"name": "TM_COMMENT_START_2", "value": "/*"},
                    {"name": "TM_COMMENT_END_2", "value": "*/"},
                ]
            },
        ),
        "Indentation Rules.tmPreferences": preferences(
            "Indentation Rules",
            "source.quillo",
            {
                "increaseIndentPattern": rules["increaseIndentPattern"],
                "decreaseIndentPattern": rules["decreaseIndentPattern"],
            },
        ),
    }


def main():
    check = "--check" in sys.argv
    stale = 0
    for name, data in outputs().items():
        path = os.path.join(HERE, name)
        if check:
            have = open(path, "rb").read() if os.path.exists(path) else None
            if have != data:
                print("out of date: sublime/%s (run python3 sublime/build.py)" % name)
                stale += 1
        else:
            with open(path, "wb") as f:
                f.write(data)
    return 1 if stale else 0


if __name__ == "__main__":
    sys.exit(main())
