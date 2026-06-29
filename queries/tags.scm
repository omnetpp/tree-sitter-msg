; tags.scm — ctags-style symbol extraction for OMNeT++ MSG
; Emits definitions for the top-level types, enum constants, and fields.

(message name: (name) @name) @definition.class
(packet name: (name) @name) @definition.class
(class name: (name) @name) @definition.class
(struct name: (name) @name) @definition.class

(enum name: (name) @name) @definition.enum

; enum constants (field nodes nested directly in an enum body)
(enum (body (field name: (name) @name))) @definition.constant

; struct/class/message/packet fields
(field name: (name) @name) @definition.field
