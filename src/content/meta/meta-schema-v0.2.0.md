---
title: Meta Schema for Articles
layer: using
collection: meta
type: structure
status: draft
secret: false
permissions: public
author: Brad
modified: 2026-02-20T16:48:47+01:00
created: 2026-02-12T16:40:23+01:00
---
# Aletheia Content Schema (v0.2.0)

## Core Principles

-   Collection = Super-type (defined by folder)
-   Type = Entity class within collection
-   Subtype = Enumerated refinement of type
-   Tags = Freeform classification
-   Layer = canon | using | campaign

## Required Frontmatter (ALL files)

- title:
- layer:
- collection: 
- type: 
- status: (draft | review | publish | archive)
- secret: (true|false)
- permissions: 
- author: 
- created: (YYYY-MM-DD)
- modified: (YYYY-MM-DD)

Optional: - subtype - tags - aliases - summary

Type values should be chosen from enumerations defined per collection. Eventually, these values will be finalized and then it will change to values *must* be chosen... 
Subtype values are currently wide open as we are not sure what we will need for subtypes. It is likely that this will eventually change to a should be chosen...
