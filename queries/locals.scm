; locals.scm — scopes, definitions and references for OMNeT++ MSG

; --- Scopes ---
(msg_file) @local.scope
(message) @local.scope
(packet) @local.scope
(class) @local.scope
(struct) @local.scope
(enum) @local.scope

; --- Definitions ---
(message name: (name) @local.definition.type)
(packet name: (name) @local.definition.type)
(class name: (name) @local.definition.type)
(struct name: (name) @local.definition.type)
(enum name: (name) @local.definition.type)
(field name: (name) @local.definition.field)

; --- References ---
(type) @local.reference
(extends) @local.reference
