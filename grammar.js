// grammar.js
module.exports = grammar({
  name: "msg",

  extras: ($) => [/\s/, $._commentline],

  supertypes: ($) => [$._targetitem],

  rules: {
    msg_file: ($) =>
      repeat(
        choice(
          $.comment,
          $._EMPTYLINE,
          $.namespace,
          $.property,
          $.cplusplus,
          $.import,
          $.struct_decl,
          $.class_decl,
          $.message_decl,
          $.packet_decl,
          $.enum_decl,
          $.enum,
          $.message,
          $.packet,
          $.class,
          $.struct,
        ),
      ),

    cplusplus: ($) =>
      seq(
        "cplusplus",
        optional(seq("(", field("target", alias($.targetspec, $.target)), ")")),
        "{{",
        field("body", alias(/([^}]|}[^}])*/, $.body)),
        "}}",
        optional(";"),
      ),

    comment: ($) => prec.right(repeat1($._commentline)),

    _commentline: (_) => token(seq("//", /(\\+(.|\r?\n)|[^\\\n])*/)),

    namespace: ($) =>
      seq("namespace", optional(field("name", alias($._qname, $.name))), ";"),

    _qname: ($) => seq(optional("::"), $._NAME, repeat(seq("::", $._NAME))),

    targetspec: ($) => seq($._targetitem, repeat($._targetitem)),

    _targetitem: ($) =>
      choice($._NAME, "::", $._INTCONSTANT, ":", ".", ",", "~", "=", "&"),

    import: ($) => seq("import", field("name", alias($.importspec, $.name)), ";"),

    importspec: ($) =>
      choice(
        $._import_un_qname,
        seq(repeat(seq($._importname, ".")), $._import_un_qname),
      ),

    _import_un_qname: ($) => $._importname,

    _importname: ($) =>
      choice(
        $._NAME,
        "message",
        "packet",
        "class",
        "struct",
        "enum",
        "abstract",
      ),

    struct_decl: ($) =>
      seq("struct", field("name", alias($._qname, $.name)), ";"),

    class_decl: ($) =>
      choice(
        seq("class", "noncobject", field("name", alias($._qname, $.name)), ";"),
        seq(
          "class",
          field("name", alias($._qname, $.name)),
          optional(seq("extends", field("extends", alias($._qname, $.extends)))),
          ";",
        ),
      ),

    message_decl: ($) =>
      seq("message", field("name", alias($._qname, $.name)), ";"),

    packet_decl: ($) =>
      seq("packet", field("name", alias($._qname, $.name)), ";"),

    enum_decl: ($) => seq("enum", field("name", alias($._qname, $.name)), ";"),

    enum: ($) =>
      prec(
        10,
        seq(
          optional($.comment),
          "enum",
          field("name", alias($._qname, $.name)),
          "{",
          alias(
            repeat(choice($._enumfield_or_property, $.comment, $._EMPTYLINE)),
            $.body,
          ),
          "}",
          optional(";"),
        ),
      ),

    _enumfield_or_property: ($) =>
      prec.right(
        seq(
          choice(alias($.enumfield, $.field), $.property),
          optional($.comment),
        ),
      ),

    enumfield: ($) =>
      seq(
        field("name", alias($._NAME, $.name)),
        optional(seq("=", field("value", alias($.enumvalue, $.value)))),
        ";",
      ),

    enumvalue: ($) =>
      choice(
        alias($._INTCONSTANT, $.number),
        seq("-", alias($._INTCONSTANT, $.number)),
        $._NAME,
      ),

    message: ($) =>
      prec(10, seq(optional($.comment), $._message_header, $._body)),

    packet: ($) =>
      prec(10, seq(optional($.comment), $._packet_header, $._body)),

    class: ($) => prec(10, seq(optional($.comment), $._class_header, $._body)),

    struct: ($) =>
      prec(10, seq(optional($.comment), $._struct_header, $._body)),

    _message_header: ($) =>
      seq(
        "message",
        field("name", alias($._qname, $.name)),
        optional(seq("extends", field("extends", alias($._qname, $.extends)))),
      ),

    _packet_header: ($) =>
      seq(
        "packet",
        field("name", alias($._qname, $.name)),
        optional(seq("extends", field("extends", alias($._qname, $.extends)))),
      ),

    _class_header: ($) =>
    seq(
      "class",
      field("name", alias(prec.left($._qname), $.name)),
      optional(seq("extends", field("extends", alias($._qname, $.extends)))),
    ),

    _struct_header: ($) =>
      seq(
        "struct",
        field("name", alias($._qname, $.name)),
        optional(seq("extends", field("extends", alias($._qname, $.extends)))),
      ),

    _body: ($) =>
      seq(
        "{",
        alias(
          repeat(
            seq(
              choice($.field, $.property, $.comment, $._EMPTYLINE),
              optional($.comment),
            ),
          ),
          $.body,
        ),
        "}",
        optional(";"),
      ),

    field: ($) =>
      choice(
        seq(
          $._fieldtypename,
          optional(alias($.opt_fieldvector, $.vector)),
          optional($._inline_properties),
          ";",
        ),
        seq(
          $._fieldtypename,
          optional(alias($.opt_fieldvector, $.vector)),
          optional($._inline_properties),
          "=",
          field("value", alias($.fieldvalue, $.value)),
          optional($._inline_properties),
          ";",
        ),
      ),

    _fieldtypename: ($) =>
      seq(
        optional("abstract"),
        field("type", alias(optional($._fielddatatype), $.type)),
        field("name", alias($._NAME, $.name)),
      ),

    _fielddatatype: ($) =>
      choice(
        $._fieldsimpledatatype,
        seq($._fieldsimpledatatype, "*"),
        seq("const", $._fieldsimpledatatype),
        seq("const", $._fieldsimpledatatype, "*"),
      ),

    _fieldsimpledatatype: ($) =>
      choice(
        $._qname,
        "char",
        "short",
        "int",
        "long",
        seq("unsigned", "char"),
        seq("unsigned", "short"),
        seq("unsigned", "int"),
        seq("unsigned", "long"),
        "double",
        "string",
        "bool",
      ),

    opt_fieldvector: ($) =>
      choice(
        seq("[", field("size", alias($._INTCONSTANT, $.size)), "]"),
        seq("[", field("size", alias($._qname, $.name)), "]"),
        seq("[", "]"),
      ),

    fieldvalue: ($) => repeat1($._fieldvalueitem),

    _fieldvalueitem: ($) =>
      choice(
        alias($._STRINGCONSTANT, $.string),
        alias($._CHARCONSTANT, $.char),
        alias($._REALCONSTANT, $.number),
        alias($._INTCONSTANT, $.number),
        "true",
        "false",
        $._NAME,
        "::",
        "?",
        ":",
        "&&",
        "||",
        "##",
        "==",
        "!=",
        ">",
        ">=",
        "<",
        "<=",
        "&",
        "|",
        "#",
        "<<",
        ">>",
        "+",
        "-",
        "*",
        "/",
        "%",
        "^",
        "!",
        "~",
        ".",
        ",",
        "(",
        ")",
        "[",
        "]",
      ),

    property: ($) =>
      choice(
        seq("@", $._prop_body, ";"),
        seq(
          field("name", alias("enum", $.name)),
          "(",
          field("tag", alias($._NAME, $.tag)),
          ")",
          ";",
        ), // legacy syntax
      ),

    _prop_body: ($) =>
      seq(
        field("name", alias($._PROPNAME, $.name)),
        optional(seq("[", field("index", alias($._PROPNAME, $.index)), "]")),
        optional($._prop_parenthesized),
      ),

    _prop_parenthesized: ($) =>
      seq("(", optional($._property_keys), ")"),

    _property_keys: ($) =>
      seq($.property_key, repeat(seq(";", $.property_key))),

    property_key: ($) =>
      choice(
        seq(
          field("name", alias($.property_value, $.name)),
          "=",
          $._property_values,
        ),
        $._property_values,
      ),

    _property_values: ($) =>
      seq($.property_value, repeat(seq(",", $.property_value))),

    property_value: ($) =>
      repeat1(choice(alias($._STRINGCONSTANT, $.string), $._prop_group, $._prop_text)),

    _prop_group: ($) =>
      seq(
        choice("(", "[", "{"),
        repeat(
          choice(alias($._STRINGCONSTANT, $.string), $._prop_group, $._prop_group_text),
        ),
        choice(")", "]", "}"),
      ),

    _prop_text: (_) => token(/[^()\[\]{},;="\s]+/),

    _prop_group_text: (_) => token(/[^()\[\]{}"]+/),

    _inline_properties: ($) => repeat1(alias($.inline_property, $.property)),

    inline_property: ($) =>
      choice(
        seq("@", $._prop_body),
        seq(
          field("name", alias("enum", $.name)),
          "(",
          field("tag", alias($._NAME, $.tag)),
          ")",
        ), // legacy syntax
      ),

    _NAME: (_) => /[a-zA-Z_][a-zA-Z0-9_]*/,
    _PROPNAME: (_) => token(/[a-zA-Z0-9_:.\-]+/),
    _INTCONSTANT: (_) => /0[xX][0-9a-fA-F]+|[0-9]+/,
    _REALCONSTANT: (_) => /[0-9]*\.[0-9]+([eE][+-]?[0-9]+)?/,
    _CHARCONSTANT: (_) => /'[^']'/,
    _STRINGCONSTANT: (_) => /"([^"\\]|\\.)*"/,
    _EMPTYLINE: (_) => /\r?\n\s*\r?\n\s*/,
  },
});
