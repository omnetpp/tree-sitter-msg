; indents.scm — indentation for OMNeT++ MSG (nvim-treesitter style)

; Indent the contents of type/enum bodies and cplusplus blocks.
[
  (message)
  (packet)
  (class)
  (struct)
  (enum)
  (cplusplus)
] @indent.begin

; Dedent the closing delimiters back to the opener's level.
[
  "}"
  "}}"
] @indent.branch

[
  "}"
  "}}"
] @indent.end
