import type { PublicSpell, PublicSpellPage } from '@adapters/public-spell-api';

export const SPELLS_PAGE_SIZE = 100;

export interface SpellSearchFilters {
  q: string;
  name: string;
  type: string;
  sourceName: string;
  sourceType: string;
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

export function getSpellSearchFilters(searchParams: URLSearchParams): SpellSearchFilters {
  return {
    q: searchParams.get('q')?.trim() ?? '',
    name: searchParams.get('name')?.trim() ?? '',
    type: searchParams.get('type')?.trim() ?? '',
    sourceName: searchParams.get('sourceName')?.trim() ?? '',
    sourceType: searchParams.get('sourceType')?.trim() ?? '',
  };
}

export function hasSpellSearchFilters(filters: SpellSearchFilters): boolean {
  return [filters.q, filters.name, filters.type, filters.sourceName, filters.sourceType].some((value) => value !== '');
}

export function getSpellListPageHref(page: number, filters?: Partial<SpellSearchFilters>): string {
  const pathname = page <= 1
    ? '/systems/gurps/resources/sorcerer-spells/all'
    : `/systems/gurps/resources/sorcerer-spells/all/${page}`;

  if (!filters) {
    return pathname;
  }

  const searchParams = new URLSearchParams();

  const normalizedFilters: SpellSearchFilters = {
    q: filters.q?.trim() ?? '',
    name: filters.name?.trim() ?? '',
    type: filters.type?.trim() ?? '',
    sourceName: filters.sourceName?.trim() ?? '',
    sourceType: filters.sourceType?.trim() ?? '',
  };

  if (normalizedFilters.q) searchParams.set('q', normalizedFilters.q);
  if (normalizedFilters.name) searchParams.set('name', normalizedFilters.name);
  if (normalizedFilters.type) searchParams.set('type', normalizedFilters.type);
  if (normalizedFilters.sourceName) searchParams.set('sourceName', normalizedFilters.sourceName);
  if (normalizedFilters.sourceType) searchParams.set('sourceType', normalizedFilters.sourceType);

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
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
    name: '',
    type: '',
    sourceName: '',
    sourceType: '',
  };
}
