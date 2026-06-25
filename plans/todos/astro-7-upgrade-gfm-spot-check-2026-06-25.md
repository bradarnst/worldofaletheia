# Astro 7 Upgrade — GFM Spot-Check

Created: 2026-06-25

Astro 7 replaces remark/rehype with Sätteri. The lockfile no longer includes `remark-gfm`, `remark-smartypants`, or related micromark packages.

## Check List

- [ ] Tables render correctly across all four themes
- [ ] Task lists (`- [ ]` / `- [x]`) render correctly
- [ ] Strikethrough (`~~text~~`) renders correctly
- [ ] Autolinks render correctly
- [ ] Smartypants (curly quotes, em-dashes, etc.) render correctly
- [ ] Heading IDs and wikilinks still work
- [ ] Verify via `pnpm dev` and `pnpm preview` before production deploy