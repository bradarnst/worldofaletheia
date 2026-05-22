import type { PublicSpell, PublicSpellPage } from '@adapters/public-spell-api';

export const SPELLS_PAGE_SIZE = 100;

export function slugifySpellType(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export function slugifySpellName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

export function getVisibleSpellKeywords(values: readonly string[] | undefined): string[] {
  if (!values) {
    return [];
  }

  const visible: string[] = [];
  for (const raw of values) {
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }
    if (/^none\.?$/i.test(trimmed)) {
      continue;
    }
    visible.push(trimmed);
  }

  return visible;
}

export function hasSpellKeywords(values: readonly string[] | undefined): boolean {
  return getVisibleSpellKeywords(values).length > 0;
}

export function formatSpellField(value: string | undefined): string {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : '—';
}

export function getSpellListPageHref(page: number): string {
  return page <= 1 ? '/systems/gurps/resources/sorcerer-spells/all' : `/systems/gurps/resources/sorcerer-spells/all/${page}`;
}

export function getSpellModalId(spell: Pick<PublicSpell, 'spell_id' | 'spell_name'>, pageScopedIndex = 0): string {
  const stableId = spell.spell_id.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return stableId ? `spell-modal-${stableId}` : `spell-modal-${pageScopedIndex + 1}-${slugifySpellName(spell.spell_name)}`;
}

export function createEmptySpellPage(page: number, pageSize: number = SPELLS_PAGE_SIZE): PublicSpellPage {
  return {
    items: [],
    total: 0,
    page,
    pageSize,
    totalPages: 0,
    q: '',
    type: '',
    sourceName: '',
    sourceType: '',
  };
}
