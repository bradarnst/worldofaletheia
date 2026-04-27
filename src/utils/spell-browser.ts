export interface SpellRecord {
  spell_name: string;
  spell_type: string;
  keywords?: string;
  full_cost: string;
  casting_roll: string;
  range: string;
  duration: string;
  description: string;
  statistics: string;
}

export interface PaginatedSpellResult {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalSpells: number;
  spells: SpellRecord[];
}

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

export function hasSpellKeywords(value: string | undefined): boolean {
  return Boolean(value?.trim() && !/^none\.?$/i.test(value.trim()));
}

export function formatSpellField(value: string | undefined): string {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : '—';
}

export function sortSpellsByName(spells: readonly SpellRecord[]): SpellRecord[] {
  return [...spells].sort((left, right) => left.spell_name.localeCompare(right.spell_name));
}

export function paginateSpells(spells: readonly SpellRecord[], page: number, pageSize = SPELLS_PAGE_SIZE): PaginatedSpellResult {
  const totalSpells = spells.length;
  const totalPages = Math.max(1, Math.ceil(totalSpells / pageSize));
  const currentPage = Math.min(Math.max(Math.floor(page), 1), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  return {
    currentPage,
    pageSize,
    totalPages,
    totalSpells,
    spells: spells.slice(startIndex, endIndex),
  };
}

export function getSpellListPageHref(page: number): string {
  return page <= 1 ? '/systems/gurps/resources/sorcerer-spells/all' : `/systems/gurps/resources/sorcerer-spells/all/${page}`;
}

export function getSpellModalId(spell: SpellRecord, pageScopedIndex: number): string {
  return `spell-modal-${pageScopedIndex + 1}-${slugifySpellName(spell.spell_name)}`;
}
