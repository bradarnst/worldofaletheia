# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root for domain glossary language.
- **`plans/adrs/`** for Architecture Decision Records that touch the area being worked on.
- **`AGENTS.md`** at the repo root for repository-specific operating rules.

If one of these files does not exist, proceed silently. Do not create glossary or ADR files preemptively; create them only when terms or decisions are actually resolved.

## File structure

This is a single-context repo:

```text
/
├── CONTEXT.md
├── AGENTS.md
├── plans/
│   └── adrs/
│       ├── 0001-obsidian-first-content-architecture.md
│       └── ...
└── src/
```

## Use the glossary's vocabulary

When output names a domain concept in an issue title, refactor proposal, hypothesis, or test name, use the term as defined in `CONTEXT.md`. Do not drift to synonyms the glossary explicitly avoids.

If the concept is missing from the glossary, treat that as a signal: either reconsider the language or note the gap for `/domain-modeling`.

## Flag ADR conflicts

If output contradicts an existing ADR, surface it explicitly rather than silently overriding it.
