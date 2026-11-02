/**
 * @file Quillo grammar for tree-sitter: .qwe files.
 * @license MIT
 *
 * It follows quillo's own parser (src/parser.rs and src/lexer.rs in quillolang/quillo):
 * - A newline ends a statement only where one could end and the next line does not go
 *   on with it (`|`, `.`, `else`, `&&`, `?`, `:`, `- x`...). src/scanner.c decides, as
 *   the lexer's `newline_significant` does.
 * - A route's path is read by the scanner too, so `/*rest` is a path, not a comment.
 * - Markup text runs to the next `<`, `{` or `}`; `//` starts a comment there only at
 *   the start of a line, as in the parser.
 * - `client`, `import`, `type`, `site`, `state`, `style` and the other words that start
 *   a statement only in their own shape stay names elsewhere: `client = 1`.
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const PREC = {
  lambda: -1,
  ternary: 1,
  coalesce: 2,
  pipe: 3,
  or: 4,
  and: 5,
  compare: 6,
  range: 7,
  add: 8,
  multiply: 9,
  unary: 10,
  postfix: 11,
};

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'ANY'];

// Words that start a statement of their own shape, and are names everywhere else.
const SOFT = ['import', 'client', 'preload', 'preconnect', 'type', 'site', 'state', 'style', 'server', 'routes', 'service', 'mount', 'private', 'public'];

// Words a map's key or a field may be, though they are keywords elsewhere.
const KEY_WORDS = ['if', 'else', 'for', 'in', 'match', 'while', 'return', 'reply', 'let', 'fn', 'view', 'component', 'route', 'use', 'as', 'true', 'false', 'null', ...SOFT, ...METHODS];

const PATH_NAME = /[\p{L}\p{N}_]+/;

/** One or more of `rule`, with `sep` between and after. */
function sepTrail(rule, sep) {
  return seq(rule, repeat(seq(sep, rule)), optional(sep));
}

function commaSep(rule) {
  return optional(seq(rule, repeat(seq(',', rule)), optional(',')));
}

module.exports = grammar({
  name: 'quillo',

  word: $ => $.identifier,

  externals: $ => [
    $._newline,
    $._path_start,
    $._path_slash,
    $.html_text,
    $._void_tag_name,
    $._error_sentinel,
  ],

  extras: $ => [/\s/, $.comment],

  supertypes: $ => [$._statement, $._expression],

  conflicts: $ => [
    [$._name, $._key],
    [$._primary, $._name],
    [$.assignment, $._key],
    [$._primary, $._key],
    [$.return_expression, $._key_word],
    [$.null, $._key_word],
    [$.false, $._key_word],
    [$.true, $._key_word],
    [$.soft_identifier, $._key_word],
    [$._expression, $.reply_expression],
    [$._primary, $.shorthand],
    [$.block, $.map],
    [$.soft_identifier, $.style_statement],
  ],

  rules: {
    source_file: $ => seq(
      optional($.shebang),
      optional(sepTrail($._statement, $._terminator)),
    ),

    shebang: _ => token(seq('#!', /[^\n]*/)),

    comment: _ => token(choice(
      seq('//', /[^\n]*/),
      seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/'),
    )),

    _terminator: $ => choice($._newline, ';'),

    _statement: $ => choice(
      $.let_declaration,
      $.function_definition,
      $.component_definition,
      $.type_definition,
      $.route,
      $.route_group,
      $.import_statement,
      $.use_statement,
      $.service_declaration,
      $.mount_declaration,
      $.site_declaration,
      $.style_statement,
      $.state_declaration,
      $.assignment,
      $.expression_statement,
    ),

    // `private fn helper()`, `public view Card`.
    visibility: _ => choice('private', 'public'),

    let_declaration: $ => seq(
      optional($.visibility),
      'let',
      field('pattern', $._pattern),
      '=',
      field('value', $._expression),
    ),

    function_definition: $ => seq(
      optional($.visibility),
      optional(field('server', alias('server', $.server))),
      choice('fn', 'view'),
      field('name', $.identifier),
      field('parameters', $.parameters),
      optional(seq('->', field('return_type', $._type))),
      optional(seq('!', field('error_type', $._type))),
      optional($.effects),
      $._body,
    ),

    _body: $ => choice(seq('=', field('body', $._expression)), field('body', $.block)),

    effects: $ => seq('with', sepTrail1($.effect, ',')),

    effect: _ => choice('db', 'http', 'fs', 'env', 'time', 'random', 'net'),

    component_definition: $ => seq(
      optional($.visibility),
      'component',
      field('name', $.identifier),
      field('parameters', $.parameters),
      $._body,
    ),

    parameters: $ => seq('(', commaSep($.parameter), ')'),

    parameter: $ => seq(
      field('name', $._name),
      optional(seq(':', field('type', $._type))),
      optional(seq('=', field('default', $._expression))),
    ),

    // `state count = 0`, or `~count = 0`, in a component.
    state_declaration: $ => seq(
      choice('state', '~'),
      field('name', $.identifier),
      '=',
      field('value', $._expression),
    ),

    // `style css`...``, `style global css`...``.
    style_statement: $ => seq('style', optional('global'), field('sheet', $._expression)),

    type_definition: $ => seq(
      optional($.visibility),
      'type',
      field('name', alias($.identifier, $.type_identifier)),
      '=',
      field('type', $._type),
    ),

    // Routes.
    route: $ => seq(
      'route',
      field('method', $.http_method),
      field('path', $.route_path),
      optional(seq('?', field('query', $.record_pattern))),
      optional(field('request', $.record_pattern)),
      $._body,
    ),

    http_method: _ => choice(...METHODS),

    route_path: $ => seq(
      $._path_start,
      optional($._path_part),
      repeat(seq($._path_slash, optional($._path_part))),
    ),

    _path_part: $ => choice($.path_literal, $.path_parameter, $.path_rest),

    path_literal: _ => token.immediate(/[\p{L}\p{N}\-._~%]+/),

    path_parameter: $ => seq(
      token.immediate(':'),
      field('name', alias(token.immediate(PATH_NAME), $.identifier)),
      optional(seq(token.immediate('('), field('type', alias(token.immediate(PATH_NAME), $.type_identifier)), token.immediate(')'))),
    ),

    path_rest: $ => seq(token.immediate('*'), optional(field('name', alias(token.immediate(PATH_NAME), $.identifier)))),

    // `routes /admin | auth.required { route GET /users = ... }`
    route_group: $ => seq(
      'routes',
      field('path', $.route_path),
      repeat(seq('|', field('middleware', $._expression))),
      optional(field('request', $.record_pattern)),
      '{',
      optional(sepTrail(choice($.route, $.route_group), $._terminator)),
      '}',
    ),

    // Files.
    import_statement: $ => seq(
      field('kind', choice('import', 'client', 'preload', 'preconnect')),
      optional('module'),
      field('source', $._source),
      'use',
      field('names', $.import_names),
    ),

    import_names: $ => sepTrail1($.import_name, ','),

    import_name: $ => seq(
      field('name', choice($.identifier, alias('*', $.wildcard))),
      optional(seq('as', field('alias', $.identifier))),
    ),

    _source: $ => choice($.string, $.unquoted_path, alias($.identifier, $.unquoted_path)),

    unquoted_path: _ => /[^\s"'`=(),;{}]*[\/.][^\s"'`=(),;{}]*/,

    // 0.6's `use lib/auth`, `use a, b as c from lib/x.qwe`, `use Chart with preload from "..."`.
    use_statement: $ => seq(
      'use',
      choice(
        field('source', $._source),
        seq(
          field('names', $.import_names),
          optional(seq('with', field('hint', choice('preload', 'preconnect')))),
          'from',
          field('source', $._source),
        ),
      ),
    ),

    service_declaration: $ => seq(
      'service',
      choice(field('name', $.identifier), field('path', $.route_path)),
      '=',
      field('file', $.string),
      optional(field('options', $.map)),
    ),

    mount_declaration: $ => seq('mount', field('path', $.route_path), '=', field('file', $.string)),

    // `site shop = "https://shop.example.com"`
    site_declaration: $ => seq('site', field('name', $.identifier), '=', field('url', $._expression)),

    assignment: $ => seq(
      field('left', choice($.identifier, $.soft_identifier, $.member_expression, $.index_expression)),
      field('operator', choice('=', '+=', '-=')),
      field('right', $._expression),
    ),

    expression_statement: $ => $._expression,

    // Expressions.
    _expression: $ => choice(
      $._primary,
      $.unary_expression,
      $.binary_expression,
      $.ternary_expression,
      $.lambda,
      $.reply_expression,
      $.return_expression,
    ),

    _primary: $ => choice(
      $.identifier,
      $.soft_identifier,
      $.number,
      $.string,
      $.template_string,
      $.tagged_template,
      $.true,
      $.false,
      $.null,
      $.list,
      $.map,
      $.block,
      $.parenthesized_expression,
      $.call_expression,
      $.member_expression,
      $.index_expression,
      $.try_expression,
      $.if_expression,
      $.match_expression,
      $.for_expression,
      $.while_expression,
      $.element,
    ),

    soft_identifier: _ => choice(...SOFT),

    // A name being bound or taken: a soft word too (`(type: str) =>`, `{ state, style }`).
    _name: $ => choice($.identifier, alias($.soft_identifier, $.identifier)),

    true: _ => 'true',
    false: _ => 'false',
    null: _ => 'null',

    parenthesized_expression: $ => seq('(', $._expression, ')'),

    unary_expression: $ => prec(PREC.unary, seq(field('operator', choice('-', '!')), field('argument', $._expression))),

    binary_expression: $ => {
      const table = [
        [PREC.coalesce, '??'],
        [PREC.pipe, '|'],
        [PREC.or, '||'],
        [PREC.and, '&&'],
        [PREC.compare, choice('==', '!=', '<', '<=', '>', '>=')],
        [PREC.range, '..'],
        [PREC.add, choice('+', '-')],
        [PREC.multiply, choice('*', '/', '%')],
      ];
      return choice(...table.map(([p, op]) => prec.left(p, seq(
        field('left', $._expression),
        field('operator', op),
        field('right', $._expression),
      ))));
    },

    ternary_expression: $ => prec.right(PREC.ternary, seq(
      field('condition', $._expression),
      '?',
      field('consequence', $._expression),
      ':',
      field('alternative', $._expression),
    )),

    // `r?`: an error passed on, written against what it follows; the ternary's `?` has
    // space before it.
    try_expression: $ => prec(PREC.postfix, seq($._expression, alias(token.immediate(prec(1, '?')), '?'))),

    call_expression: $ => prec(PREC.postfix, seq(field('function', $._expression), field('arguments', $.arguments))),

    arguments: $ => seq('(', commaSep($._expression), ')'),

    member_expression: $ => prec(PREC.postfix, seq(
      field('object', $._expression),
      '.',
      field('property', choice(alias($._key_word, $.property_identifier), alias($.identifier, $.property_identifier), alias(/\d+/, $.property_identifier))),
    )),

    index_expression: $ => prec(PREC.postfix, seq(field('object', $._expression), '[', field('index', $._expression), ']')),

    lambda: $ => prec.right(PREC.lambda, seq(
      choice(field('parameters', $.parameters), field('parameter', $._name)),
      optional(seq(':', field('return_type', $._type))),
      '=>',
      field('body', $._expression),
    )),

    if_expression: $ => prec.right(seq(
      'if',
      field('condition', $._expression),
      field('consequence', $.block),
      optional(seq('else', field('alternative', choice($.if_expression, $.block)))),
    )),

    match_expression: $ => seq(
      'match',
      field('subject', $._expression),
      '{',
      repeat(seq($.match_arm, optional(choice(',', ';', $._newline)))),
      '}',
    ),

    match_arm: $ => seq(
      field('pattern', $._pattern),
      optional(seq('if', field('guard', $._expression))),
      '=>',
      field('body', $._expression),
    ),

    for_expression: $ => prec.right(seq(
      'for',
      field('pattern', $._pattern),
      'in',
      field('iterable', $._expression),
      choice(seq('=>', field('body', $._expression)), field('body', $.block)),
    )),

    while_expression: $ => seq('while', field('condition', $._expression), field('body', $.block)),

    reply_expression: $ => prec.right(seq('reply', field('status', $._primary), optional(field('body', $._expression)))),

    return_expression: $ => prec.right(seq('return', optional($._expression))),

    block: $ => seq('{', optional(sepTrail($._statement, $._terminator)), '}'),

    list: $ => seq('[', commaSep(choice($._expression, $.spread)), ']'),

    spread: $ => seq('...', $._expression),

    // `{}` and `{ x }` are maps, as quillo reads them, not blocks.
    map: $ => prec.dynamic(1, seq('{', optional(sepTrail(choice($.map_entry, $.shorthand, $.spread), $._list_sep)), '}')),

    _list_sep: $ => choice(',', ';', $._newline),

    map_entry: $ => seq(field('key', $._key), ':', field('value', $._expression)),

    shorthand: $ => choice(alias($.identifier, $.property_identifier), alias($.soft_identifier, $.property_identifier)),

    _key: $ => choice(
      alias($.identifier, $.property_identifier),
      alias($._key_word, $.property_identifier),
      $.string,
    ),

    _key_word: _ => choice(...KEY_WORDS),

    // Literals.
    identifier: _ => /[\p{L}_][\p{L}\p{N}_]*/,

    number: _ => token(choice(
      /0[xX][0-9a-fA-F_]+/,
      /\d[\d_]*(\.\d[\d_]*)?([eE][+-]?\d+)?m?/,
    )),

    string: $ => choice(
      seq('"', repeat(choice(alias(token.immediate(prec(1, /[^"\\]+/)), $.string_content), $.escape_sequence)), '"'),
      seq('\'', repeat(choice(alias(token.immediate(prec(1, /[^'\\]+/)), $.string_content), $.escape_sequence)), '\''),
    ),

    escape_sequence: _ => token.immediate(seq('\\', choice(/u\{[0-9a-fA-F]+\}/, /u[0-9a-fA-F]{4}/, /[^u]/))),

    template_string: $ => seq('`', repeat($._template_part), '`'),

    // css`a { color: ${c}; }`, sql`select ...`: the name, then the template with no space.
    tagged_template: $ => prec(PREC.postfix, seq(
      field('tag', $.identifier),
      alias(token.immediate('`'), '`'),
      repeat($._template_part),
      '`',
    )),

    _template_part: $ => choice(
      alias(token.immediate(prec(1, /[^`\\$]+/)), $.string_content),
      alias(token.immediate('$'), $.string_content),
      $.escape_sequence,
      $.template_substitution,
    ),

    template_substitution: $ => seq(token.immediate('${'), $._expression, '}'),

    // Patterns.
    _pattern: $ => choice($._pattern_atom, $.alternative_pattern, $.as_pattern),

    alternative_pattern: $ => prec.left(seq($._pattern, '|', $._pattern)),

    as_pattern: $ => prec.left(seq($._pattern, 'as', field('name', $.identifier))),

    _pattern_atom: $ => choice(
      $._name,
      $.number,
      seq('-', $.number),
      $.string,
      $.true,
      $.false,
      $.null,
      $.list_pattern,
      $.record_pattern,
    ),

    list_pattern: $ => seq('[', commaSep($._pattern), optional(seq('..', optional(field('rest', $.identifier)))), ']'),

    record_pattern: $ => seq('{', optional(sepTrail($.field_pattern, $._list_sep)), '}'),

    field_pattern: $ => seq(
      field('key', $._key),
      repeat(seq('.', field('key', $._key))),
      optional(seq(':', field('pattern', $._pattern))),
      optional(seq('=', field('default', $._expression))),
    ),

    // Types.
    _type: $ => choice($._type_atom, $.union_type),

    union_type: $ => prec.left(seq($._type, '|', $._type)),

    _type_atom: $ => choice($.named_type, $.generic_type, $.shape_type, $.literal_type, $.optional_type),

    named_type: $ => choice(alias($.identifier, $.type_identifier), alias('null', $.type_identifier), alias('fn', $.type_identifier)),

    generic_type: $ => seq(alias($.identifier, $.type_identifier), '<', sepTrail1($._type, ','), '>'),

    literal_type: $ => $.string,

    optional_type: $ => seq($._type_atom, '?'),

    shape_type: $ => seq('{', optional(sepTrail($.field_type, $._list_sep)), '}'),

    field_type: $ => seq(
      field('name', $._key),
      ':',
      field('type', $._type),
      optional(seq('=', field('default', $._expression))),
    ),

    // Markup.
    element: $ => choice(
      seq($.start_tag, repeat($._child), $.end_tag),
      $.self_closing_tag,
      $.void_tag,
    ),

    start_tag: $ => seq('<', field('name', $.tag_name), repeat($._tag_part), '>'),

    self_closing_tag: $ => seq('<', field('name', $.tag_name), repeat($._tag_part), '/>'),

    void_tag: $ => seq('<', field('name', alias($._void_tag_name, $.tag_name)), repeat($._tag_part), choice('>', '/>')),

    end_tag: $ => seq('</', field('name', $.tag_name), '>'),

    tag_name: _ => token.immediate(/[\p{L}][\p{L}\p{N}_\-]*/),

    _tag_part: $ => choice($.class_selector, $.id_selector, $.attribute, $.spread_attribute, $.shorthand_attribute),

    // `<li.todo>`, `<p.text-sm.md:text-lg>`, `<div.w-1/2>`
    class_selector: $ => seq('.', $._selector_name),

    id_selector: $ => seq('#', $._selector_name),

    _selector_name: $ => repeat1(choice(
      alias(token.immediate(/[\p{L}\p{N}_\-]+(:[\p{L}\p{N}][\p{L}\p{N}_\-]*|\/[0-9][\p{L}\p{N}_\-]*)*/), $.selector_name),
      $.attribute_expression_immediate,
    )),

    attribute_expression_immediate: $ => seq(token.immediate('{'), $._expression, '}'),

    attribute: $ => seq(
      field('name', $.attribute_name),
      optional(seq('=', field('value', choice($.string, $.attribute_expression)))),
    ),

    attribute_name: _ => /[\p{L}_@:][\p{L}\p{N}_\-:@.]*/,

    attribute_expression: $ => seq('{', $._expression, '}'),

    spread_attribute: $ => seq('{', '...', $._expression, '}'),

    shorthand_attribute: $ => seq('{', choice(alias($.identifier, $.attribute_name), alias($.soft_identifier, $.attribute_name)), '}'),

    _child: $ => choice($.element, $.html_text, $.html_expression),

    html_expression: $ => seq('{', optional($._expression), '}'),
  },
});

function sepTrail1(rule, sep) {
  return seq(rule, repeat(seq(sep, rule)), optional(sep));
}
