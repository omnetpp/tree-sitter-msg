; highlights.scm — OMNeT++ MSG
; Uses standard tree-sitter capture names so editor themes pick them up.

; --- Keywords ---
[
  "namespace"
  "import"
  "cplusplus"
  "message"
  "packet"
  "class"
  "struct"
  "enum"
  "extends"
  "abstract"
  "const"
  "unsigned"
  "noncobject"
] @keyword

; --- Built-in primitive types ---
[
  "bool"
  "char"
  "short"
  "int"
  "long"
  "float"
  "double"
  "string"
] @type.builtin

; --- Literals ---
(string) @string
(char) @character
(number) @number

[
  "true"
  "false"
] @constant.builtin

(comment) @comment

; --- Operators ---
[
  "=" "==" "!=" "<" "<=" ">" ">=" "&&" "||" "!" "~"
  "&" "|" "^" "<<" ">>" "+" "-" "*" "/" "%" "?" "##" "#"
] @operator

; --- Type definitions (definition names) ---
(message name: (name) @type)
(packet name: (name) @type)
(class name: (name) @type)
(struct name: (name) @type)
(enum name: (name) @type)
(message_decl name: (name) @type)
(packet_decl name: (name) @type)
(class_decl name: (name) @type)
(struct_decl name: (name) @type)
(enum_decl name: (name) @type)

; Base type after `extends`, field/legacy-enum type references
(extends) @type
(type) @type
(tag) @type

; --- Namespaces and imports ---
(namespace name: (name) @namespace)
(import name: (name) @module)

; --- Properties (@prop, @prop[index], key=value) ---
"@" @attribute
(property name: (name) @attribute)
(property index: (index) @attribute)
(property_key name: (name) @property)

; --- Enum constants vs. struct/class/message/packet fields ---
; (enum constants are `field` nodes nested in an `enum` body)
(enum (body (field name: (name) @constant)))
(field name: (name) @variable.member)
