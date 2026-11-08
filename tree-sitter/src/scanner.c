// The parts of Quillo a grammar's rules cannot read alone, as quillo's lexer reads them
// (src/lexer.rs and src/parser.rs in quillolang/quillo):
//
// - _newline: a line break that ends a statement. Only where the grammar has one end
//   (so not in `(...)` or `[...]`), and not when the next line goes on with it: `|`,
//   `||`, `&&`, `?`, `??`, `:`, `.` (not `..`), `else`, `*`, `%`, `==`, `!=`, and `- x`
//   or `+ x` with a space. `//` lines between are looked past, as the lexer does.
// - _path_start, _path_slash: a route's, `mount`'s, `service`'s or `routes`' path, so
//   `/*rest` is a path and not a comment (the scanner goes before the grammar's comments).
// - html_text: markup text, to the next `<`, `{` or `}`. `//` is a comment there only
//   at the start of a line.
// - _void_tag_name: `br`, `img`, `input` and the other elements with no end tag.
// - _mcp_tag, _service_mcp_tag: `mcp`, the tag of a tool, as quillo's highlighter's `mcp_tag`
//   reads it (src/highlight.rs; FEEDBACK56.md, Q-853). After `fn`, `view` or `component`, it
//   is the tag with spaces or tabs and then a name after it on its line; after `service`, a
//   name or a `/` that starts no comment. So `fn mcp(x)`, `fn mcp` at a line's end,
//   `service mcp = "mcp.qwe"` and `service mcp /* note */ = ...` name something `mcp`.

#include "tree_sitter/parser.h"

#include <string.h>
#include <wctype.h>

enum TokenType {
  NEWLINE,
  PATH_START,
  PATH_SLASH,
  HTML_TEXT,
  VOID_TAG_NAME,
  MCP_TAG,
  SERVICE_MCP_TAG,
  ERROR_SENTINEL,
};

static const char *const VOID_TAGS[] = {
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr",
};

void *tree_sitter_quillo_external_scanner_create(void) { return NULL; }
void tree_sitter_quillo_external_scanner_destroy(void *payload) { (void)payload; }
unsigned tree_sitter_quillo_external_scanner_serialize(void *payload, char *buffer) {
  (void)payload;
  (void)buffer;
  return 0;
}
void tree_sitter_quillo_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
  (void)payload;
  (void)buffer;
  (void)length;
}

static inline void advance(TSLexer *lexer) { lexer->advance(lexer, false); }
static inline void skip(TSLexer *lexer) { lexer->advance(lexer, true); }

static inline bool is_word(int32_t c) { return iswalnum(c) || c == '_'; }

// Past spaces, line breaks and `//` lines, without taking them into the token.
static void look_past_blank(TSLexer *lexer) {
  for (;;) {
    while (iswspace(lexer->lookahead)) advance(lexer);
    if (lexer->lookahead != '/') return;
    advance(lexer);
    if (lexer->lookahead != '/') return;  // a lone `/`: not a continuation either way
    while (lexer->lookahead != '\n' && !lexer->eof(lexer)) advance(lexer);
  }
}

// Whether the text at the lexer goes on with the line before (`newline_significant`).
static bool continues(TSLexer *lexer) {
  int32_t c = lexer->lookahead;
  switch (c) {
    case '|':
    case '?':
    case ':':
    case '*':
    case '%':
      return true;
    case '&':
      advance(lexer);
      return lexer->lookahead == '&';
    case '.':
      advance(lexer);
      return lexer->lookahead != '.';
    case '=':
    case '!':
      advance(lexer);
      return lexer->lookahead == '=';
    case '-':
    case '+':
      advance(lexer);
      return lexer->lookahead == ' ' || lexer->lookahead == '\t';
    case 'e': {
      const char *rest = "lse";
      advance(lexer);
      for (const char *r = rest; *r; r++) {
        if (lexer->lookahead != *r) return false;
        advance(lexer);
      }
      return !is_word(lexer->lookahead);
    }
    default:
      return false;
  }
}

static bool scan_html_text(TSLexer *lexer) {
  bool line_start = lexer->get_column(lexer) == 0;
  while (iswspace(lexer->lookahead)) {
    if (lexer->lookahead == '\n') line_start = true;
    skip(lexer);
  }
  bool has = false;
  for (;;) {
    int32_t c = lexer->lookahead;
    if (lexer->eof(lexer) || c == '<' || c == '{' || c == '}') break;
    if (c == '/' && line_start) {
      advance(lexer);
      if (lexer->lookahead == '/') break;  // a comment: the text ends before it
      has = true;
      lexer->mark_end(lexer);
      line_start = false;
      continue;
    }
    if (c == '\n') {
      line_start = true;
      advance(lexer);
      continue;
    }
    advance(lexer);
    if (!iswspace(c)) {
      has = true;
      line_start = false;
      lexer->mark_end(lexer);
    }
  }
  if (!has) return false;
  lexer->result_symbol = HTML_TEXT;
  return true;
}

static bool scan_void_tag_name(TSLexer *lexer) {
  char name[8];
  unsigned n = 0;
  while (iswalnum(lexer->lookahead) || lexer->lookahead == '-' || lexer->lookahead == '_') {
    if (n >= sizeof name - 1) return false;
    name[n++] = (char)lexer->lookahead;
    advance(lexer);
  }
  name[n] = 0;
  for (unsigned i = 0; i < sizeof VOID_TAGS / sizeof VOID_TAGS[0]; i++) {
    if (strcmp(name, VOID_TAGS[i]) == 0) {
      lexer->mark_end(lexer);
      lexer->result_symbol = VOID_TAG_NAME;
      return true;
    }
  }
  return false;
}

// A name's start: a letter or `_`. Past ASCII every character counts, as iswalpha's answer
// there hangs on the locale; one that is no letter is an error in quillo too.
static inline bool is_name_start(int32_t c) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_' || c > 0x7f;
}

// `mcp` with spaces or tabs after it, then a name, or with `path` a `/` that starts no comment.
static bool scan_mcp_tag(TSLexer *lexer, bool path) {
  for (const char *w = "mcp"; *w; w++) {
    if (lexer->lookahead != *w) return false;
    advance(lexer);
  }
  lexer->mark_end(lexer);
  if (lexer->lookahead != ' ' && lexer->lookahead != '\t') return false;
  while (lexer->lookahead == ' ' || lexer->lookahead == '\t') advance(lexer);
  if (is_name_start(lexer->lookahead)) return true;
  if (!path || lexer->lookahead != '/') return false;
  advance(lexer);
  return lexer->lookahead != '/' && lexer->lookahead != '*';
}

bool tree_sitter_quillo_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid) {
  (void)payload;
  // Error recovery asks for every token at once: leave it to the grammar's own.
  if (valid[ERROR_SENTINEL]) return false;

  if (valid[PATH_SLASH] && lexer->lookahead == '/') {
    advance(lexer);
    lexer->mark_end(lexer);
    lexer->result_symbol = PATH_SLASH;
    return true;
  }
  if (valid[VOID_TAG_NAME] && iswalpha(lexer->lookahead)) return scan_void_tag_name(lexer);
  if (valid[HTML_TEXT]) {
    return scan_html_text(lexer);
  }

  while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r') skip(lexer);

  // Only spaces between: `fn` and `mcp` on two lines is no tag either, as in quillo's highlighter.
  if ((valid[MCP_TAG] || valid[SERVICE_MCP_TAG]) && lexer->lookahead == 'm') {
    bool service = valid[SERVICE_MCP_TAG];
    if (!scan_mcp_tag(lexer, service)) return false;
    lexer->result_symbol = service ? SERVICE_MCP_TAG : MCP_TAG;
    return true;
  }
  if (valid[NEWLINE] && lexer->lookahead == '\n') {
    advance(lexer);
    lexer->mark_end(lexer);
    look_past_blank(lexer);
    if (!lexer->eof(lexer) && continues(lexer)) return false;
    lexer->result_symbol = NEWLINE;
    return true;
  }
  if (valid[PATH_START] && lexer->lookahead == '/') {
    advance(lexer);
    lexer->mark_end(lexer);
    lexer->result_symbol = PATH_START;
    return true;
  }
  return false;
}
