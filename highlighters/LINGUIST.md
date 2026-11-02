# GitHub Linguist: later

[Linguist](https://github.com/github-linguist/linguist) is what GitHub uses to name a file's
language, colour it, and count it in a repository's language bar. It adds a language once it is
in use: its rule is about **200 unique `user/repo` repositories** with the extension, not
counting forks or the language's own repositories. Until then `.qwe` files show as plain text
on GitHub.

## When the count is there

1. Count: search GitHub's code for `path:*.qwe` (signed in), and note the repositories that are
   not quillolang's and not forks.
2. Check `lib/linguist/languages.yml` for another language that already takes `.qwe` or `.qwer`;
   if one does, a heuristic in `lib/linguist/heuristics.yml` must tell them apart.
3. In a fork of Linguist:
   - add to `languages.yml` (keep it in alphabetical order):

     ```yaml
     Quillo:
       type: programming
       color: "#6e57e0"   # the quill of vscode/icons/qwe-light.svg
       extensions:
       - ".qwe"
       interpreters:
       - quillo
       tm_scope: source.quillo
       ace_mode: text
     ```

     then `script/update-ids` gives it its `language_id`;
   - `script/add-grammar https://github.com/quillolang/editors` takes the TextMate grammar
     (`vscode/syntaxes/quillo.tmLanguage.json`, MIT) as a submodule;
   - put real programs under `samples/Quillo/` (`app/main.qwe`, a component, a script with
     `#!/usr/bin/env quillo`), and run `bundle exec rake test`.
4. Open the pull request with the count and the search that found it.

## Until then

A Quillo program's own repository can say what its `.qwer` files are, as they are Rust:

```gitattributes
*.qwer linguist-language=Rust
```

There is no such line for `.qwe`, as Linguist has no language to name.
