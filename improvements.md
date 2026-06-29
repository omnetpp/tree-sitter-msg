# tree-sitter-msg — Improvement Report

Analysis of the current tree-sitter parser for the OMNeT++ MSG (a.k.a. MSG-2)
language, with recommendations for better coverage so downstream tools
(editors, language servers, code navigation, documentation generators) can make
fuller use of the syntax tree.

## Method & references

The current grammar (`grammar.js`, generated `src/`) was compared against:

- **The authoritative grammar**: `omnetpp/src/nedxml/msg2.y` (Bison) and
  `omnetpp/src/nedxml/msg2.lex` (Flex). These define exactly what `opp_msgc`
  accepts.
- **A real-world corpus**: all 228 `*.msg` files in INET
  (`inet/src/inet/**`), used to confirm which constructs actually occur and to
  spot patterns the grammar mishandles.

> Note: the parser could not be compiled and run in this environment (no C
> compiler available), so findings are by static comparison against the
> reference grammar and the corpus rather than by executing the parser. Items
> marked *(verify)* should be confirmed with `tree-sitter parse` over the INET
> corpus once a build toolchain is available.

## Guiding principle: C++ stays opaque

`cplusplus {{ ... }}` blocks (top-level, targeted `cplusplus(target) {{ }}`,
and inline method bodies) — and any `#include` lines inside them — must remain
**opaque**: a single body token, not parsed by the MSG grammar, with C++
injected via `queries/injections.scm`. This matches both the reference lexer
(which scans verbatim up to the first `}}`) and how the corpus uses these
blocks (full C++ method bodies, includes, `/* */` comments — none of which are
MSG syntax). The recommendations below preserve this; they only make the body
token more robust, never less opaque.

---

## High priority

### 1. `packet` header does not expose `name` / `extends`

`_packet_header` is the only type header that does **not** alias its name and
base class, unlike `message`, `class`, and `struct`:

```js
// grammar.js — current
_packet_header: ($) =>
  seq("packet", $._qname, optional(seq("extends", $._qname))),
```

Because `_qname` is a hidden rule, the packet's name and base type are inlined
as anonymous tokens. Tools that read `(message name: ... extends: ...)` get
nothing equivalent for `packet`, even though `packet` is one of the most common
top-level definitions in INET (e.g. every `*.msg` under `applications/`,
`linklayer/`, `transportlayer/`).

**Fix** — mirror `_message_header`:

```js
_packet_header: ($) =>
  seq(
    "packet",
    alias($._qname, $.name),
    optional(seq("extends", alias($._qname, $.extends))),
  ),
```

Reference: `msg2.y` `packet_header` (lines 416–430) sets both name and
extends-name, identically to message/class/struct.

### 2. Use tree-sitter *fields*, not just aliased child nodes

No node in `node-types.json` exposes any tree-sitter **field**
(`name:`, `type:`, `value:`, `extends:`, `size:`, `index:`). Everything is an
aliased child, so consumers must walk children positionally and disambiguate by
node type. Field accessors (`node.childForFieldName("name")`) are the idiomatic
way editors/LSPs/`tree-sitter-graph` navigate a tree.

**Fix** — wrap the meaningful children in `field(...)`. Example for the field
rule and message header:

```js
_fieldtypename: ($) =>
  seq(
    optional("abstract"),
    field("type", alias(optional($._fielddatatype), $.type)),
    field("name", alias($._NAME, $.name)),
  ),

_message_header: ($) =>
  seq(
    "message",
    field("name", alias($._qname, $.name)),
    optional(seq("extends", field("extends", alias($._qname, $.extends)))),
  ),
```

Apply the same to `class`/`struct`/`packet`/`enum` headers, `enumfield`
(`name`, `value`), `field` default (`value`), `opt_fieldvector` (`size`), and
property (`name`, `index`, `tag`). This is additive — aliased node types stay,
queries keep working — but it makes the tree far more usable.

### 3. Parse property arguments structurally (`key=value` keys, value lists)

Currently everything inside `@prop(...)` is collapsed into one opaque `tag`
node via a character-class regex:

```js
_prop_parenthesized: ($) =>
  prec.right(seq("(", alias(repeat1($._prop_value), $.tag), ")")),
_prop_value: ($) => choice($._prop_value_parenthesized, /[^\(\)]+/),
```

The reference grammar instead parses a structured property body:
`property_keys → property_key → (name '=' values | values)` with
comma-separated `property_value`s and `;`-separated keys (`msg2.y` 648–703).
That structure is what `msganalyzer`/`msgcompiler` rely on to read e.g.
`@class`, `@enum`, `@getter`, `@sizeGetter`, `@descriptor`, `@implements(a, b)`.

A tool built on the current grammar cannot, without re-lexing the `tag` text:

- split multiple comma-separated values (`@implements(A, B)`),
- read a named key (`key=value`),
- separate multiple `;`-delimited keys.

**Recommendation** — introduce explicit `property_key` / `property_value`
nodes that model `name`, `=`, comma-separated values, and `;` separators, so
the common cases (single value, comma list, `key=value`) are addressable in
queries. Keep a permissive fallback for arbitrary expression-valued properties
(e.g. INET's `@toValue(cValue($.get(),"b"))`).

---

## Medium priority

### 4. String literals inside property values can mis-parse

Property values are matched with the regex `/[^\(\)]+/` plus a recursive
parenthesis rule. A string literal that contains parentheses, commas, or
semicolons is treated as raw text, so its delimiters are interpreted as
structure. This already occurs in the corpus, e.g. INET
`TlvOptions`/dump fields:

```
@toString(".str()");
string rawBin[] @getter("getBinDumpLine") @sizeGetter("getBinDumpNumLines");
```

`".str()"` only parses because its inner parens happen to balance. An
**unbalanced** delimiter inside a string — `@foo("(")` or `@bar("a;b")` — would
produce an `ERROR` node. The reference lexer avoids this with a dedicated
`stringliteral` start-state inside property values (`msg2.lex` 128–137).

**Fix** — make `_prop_value` recognize `$._STRINGCONSTANT` as a token before
the catch-all regex, so quoted text (and its `()`,`,`,`;`) is consumed atomically.

### 5. Property names and indices are under-permissive

The reference `PROPNAME` token is `({L}|{D}|[:.-])+` (`msg2.lex` 109) — it may
contain `.`, `:`, `-`, and may start with a digit. The grammar uses `$._NAME`
(`/[a-zA-Z_][a-zA-Z0-9_]*/`) for both the property name and the `[index]`:

```js
_prop_body: ($) =>
  seq(
    alias($._NAME, $.name),
    optional(seq("[", alias($._NAME, $.index), "]")),
    ...
```

Dotted/dashed property names are uncommon in MSG today, but legal; matching the
reference avoids spurious errors.

**Fix** — give property names/indices their own token matching
`/[A-Za-z0-9_][A-Za-z0-9_:.-]*/`.

### 6. Highlight query: non-standard captures and missing tokens

`queries/highlights.scm` uses ad-hoc capture names (`@value`, `@prop_name`,
`@cpp_body`, `@target`) that don't map to the conventional tree-sitter highlight
groups themes understand (`@keyword`, `@type`, `@property`, `@string`,
`@number`, `@constant`, `@variable`, `@comment`). It also highlights `(name)`
as `@value`, and omits many tokens.

Missing/incorrect:

- Keywords not highlighted: `message`, `namespace`, `abstract`, `const`,
  `unsigned`, `noncobject`, `using`. (Only `class`, `packet`, `import`,
  `struct`, `enum`, `extends`, `cplusplus` are.)
- Primitive type keywords (`int`, `double`, `bool`, `string`, `char`, `short`,
  `long`) are not highlighted as types.
- No highlighting for string/char constants, numeric constants, `true`/`false`,
  field names, enum field names/values, or operators in default values.
- `(name) @value` mislabels every name as a value.

**Fix** — rewrite with standard capture names and cover keywords, types,
literals, and definition names. This is the single biggest win for editor UX
and costs no grammar changes.

### 7. Add the missing query files tools expect

Only `highlights.scm` and `injections.scm` exist. Common consumers also look
for:

- **`tags.scm`** — ctags-style symbol extraction (GitHub code nav, nvim, LSP
  document symbols). Should emit definitions for `message`/`packet`/`class`/
  `struct`/`enum` (and ideally fields/enum constants). High value, low effort.
- **`folds.scm`** — fold type bodies, enum bodies, and `cplusplus` blocks.
- **`indents.scm`** — indentation inside `{ ... }` and `{{ ... }}`.
- **`locals.scm`** — optional; scope/reference resolution for names.

---

## Low priority / cleanup

### 8. `cplusplus` body token: keep opaque, make it robust

The body is matched with `/([^}}]|[}][^}])*/`. Note `[^}}]` is just `[^}]`
(duplicate char in class). The pattern works for typical bodies and faithfully
reproduces the reference limitation of stopping at the first `}}` (`msg2.lex`
140–144), so a literal `}}` inside C++ (e.g. `{{...}}` initializers) terminates
early — same as `opp_msgc`. Keep the body opaque (per project intent and the
C++ injection), but consider simplifying the regex to `/([^}]|}[^}])*/` for
clarity, and add a corpus test for bodies ending in `}` immediately before the
closing `}}`. *(verify)*

### 9. `using` is reserved but tokenized as a name

`using` is a reserved word in the reference lexer (`msg2.lex` 66) even though
the grammar reserves it "for future use". The tree-sitter grammar treats
`using` as an ordinary `NAME`. Harmless today, but reserving it would match the
reference and avoid surprises if it is ever activated.

### 10. `noncobject` + `extends` is over-permissive

```js
class_decl: ($) =>
  seq("class", optional("noncobject"), alias($._qname, $.name),
      optional(seq("extends", alias($._qname, $.extends))), ";"),
```

The reference allows `class noncobject Name;` **without** an `extends` clause
(`msg2.y` 288–294); the combination `class noncobject X extends Y;` is not a
production. Minor — accepting a superset rarely hurts editors, but a stricter
rule matches `opp_msgc`.

### 11. `_body` whitespace artifact

`_body` contains `optional(/\s/)` right after `{`:

```js
_body: ($) => seq("{", optional(/\s/), alias(repeat(...), $.body), "}", optional(";")),
```

Whitespace is already in `extras`, so this looks like a leftover workaround.
Worth removing and re-testing to confirm it isn't masking a conflict. *(verify)*

### 12. Comment model is correct; consider doc-comment distinction

MSG supports only `//` line comments (confirmed: every `/* */` in the INET
corpus is inside a `cplusplus` block, i.e. C++). The current model is correct.
OMNeT++ does treat certain `//` comments as documentation/banner comments
(consumed by `neddoc`); the grammar lumps all `//` into one `comment` node.
Optional enhancement: expose banner/trailing position so doc tools can
associate documentation with the following/preceding definition.

---

## Constructs confirmed working (no change needed)

Verified against the reference grammar and present in the INET corpus:

- Top-level: `namespace name;`, empty `namespace;`, file-level `@property`,
  `import a.b.c;`, forward decls (`struct`/`class`/`message`/`packet`/`enum ...;`),
  `class noncobject X;`, `class X extends Y;`.
- `cplusplus {{ }}`, `cplusplus(target) {{ }}`, inline method bodies as targeted
  blocks (e.g. `ProtocolTag.msg`, `IdentityTag.msg`).
- `enum` with `NAME`, `NAME = value`, negative values (`= -1`), and properties.
- Type bodies for `message`/`packet`/`class`/`struct`, with `extends`.
- Fields: primitive types, `unsigned X`, `const`, pointer `*`, qualified type
  names (`A::B`, e.g. `SharingRegionTagSet::TagBaseRegionTag`), vectors `[]`,
  `[N]`, `[sizefield]`, abstract fields, default values, multiple inline
  properties on one field, and the legacy `@enum(NAME)` inline form.

## Suggested next steps

1. Build the parser (`tree-sitter generate && tree-sitter test`) and run
   `tree-sitter parse` over all of INET's `*.msg` to get an empirical ERROR
   list; this confirms items marked *(verify)* and may surface more.
2. Land #1 (packet header) and #2 (fields) first — small, high impact.
3. Rewrite `highlights.scm` with standard captures and add `tags.scm`.
4. Tackle structured property parsing (#3/#4) as a focused follow-up, with
   corpus regression tests under `test/corpus/`.
