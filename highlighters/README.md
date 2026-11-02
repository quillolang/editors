# Quillo for highlighters

For pages that show Quillo code rather than edit it:

| Folder | For | How |
|---|---|---|
| [`shiki/`](shiki) | [Shiki](https://shiki.style) (VitePress, Astro, Nuxt Content, ...) | the VS Code extension's TextMate grammar, with Shiki's `name`, `aliases` and `embeddedLangs` |
| [`highlightjs/`](highlightjs) | [highlight.js](https://highlightjs.org) 11 | a language definition |
| [`prism/`](prism) | [Prism](https://prismjs.com) (Docusaurus, Gatsby, ...) | a language definition |
| [`kde/`](kde) | KDE's syntax files: Kate, KDevelop, and [pandoc](https://pandoc.org), which the book can print with | a syntax definition |

GitHub's own highlighting is [Linguist](LINGUIST.md)'s, which adds a language once enough
repositories use it.

## Use

Shiki:

```js
import { createHighlighter } from "shiki";
import quillo from "./shiki/quillo.tmLanguage.json" with { type: "json" };

const highlighter = await createHighlighter({ themes: ["github-dark"], langs: ["css", "sql", quillo] });
const html = highlighter.codeToHtml(code, { lang: "quillo", theme: "github-dark" });
```

highlight.js (on a page, after highlight.js; or `hljs.registerLanguage("quillo", require("./highlightjs/quillo.js"))`):

```html
<script src="highlight.min.js"></script>
<script src="quillo.js"></script>
<pre><code class="language-quillo">route GET / = "hello"</code></pre>
<script>hljs.highlightAll()</script>
```

Prism (on a page, after Prism; or `require("./prism/prism-quillo.js")(Prism)`):

```html
<script src="prism.js"></script>
<script src="prism-quillo.js"></script>
<pre><code class="language-quillo">route GET / = "hello"</code></pre>
```

pandoc, for the book:

```sh
pandoc --syntax-definition=kde/quillo.xml chapters/*.md -o book.pdf
```

with the code blocks marked `quillo` (```` ```quillo ````).

## Tests

```sh
npm ci && npm test
```

Each one highlights [`test/sample.qwe`](test/sample.qwe) and checks what each part of it is given,
and that no character is lost: Shiki's scopes (CSS and SQL by their own grammars) with Shiki
itself, highlight.js's classes and Prism's tokens with those libraries, and KDE's styles with a
small engine of the rules `quillo.xml` uses (no pandoc here). Each checks that its builtins are
the VS Code grammar's, and `build.mjs --check` that Shiki's grammar is that grammar.

Not yet run in pandoc, Kate or a documentation site.
