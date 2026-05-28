import type { PublicSpell } from '@adapters/public-spell-api';

export const SPELL_LIST_STORAGE_KEY = 'woa:sorcerer-spell-list:v1';

export interface SpellListStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getDefaultStorage(): SpellListStorageLike | null {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
    return null;
  }

  return globalThis.localStorage;
}

export function normalizeSpellListId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

export function normalizeSpellListIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalizedIds: string[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    const normalizedId = normalizeSpellListId(entry);
    if (!normalizedId || seen.has(normalizedId)) {
      continue;
    }

    seen.add(normalizedId);
    normalizedIds.push(normalizedId);
  }

  return normalizedIds;
}

export function readSpellListIds(storage: SpellListStorageLike | null = getDefaultStorage()): string[] {
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(SPELL_LIST_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    return normalizeSpellListIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeSpellListIds(ids: readonly string[], storage: SpellListStorageLike | null = getDefaultStorage()): string[] {
  const normalizedIds = normalizeSpellListIds(ids);

  if (!storage) {
    return normalizedIds;
  }

  try {
    if (normalizedIds.length === 0) {
      storage.removeItem(SPELL_LIST_STORAGE_KEY);
      return normalizedIds;
    }

    storage.setItem(SPELL_LIST_STORAGE_KEY, JSON.stringify(normalizedIds));
  } catch {
    return normalizedIds;
  }

  return normalizedIds;
}

export function addSpellListId(spellId: unknown, storage: SpellListStorageLike | null = getDefaultStorage()): string[] {
  const normalizedId = normalizeSpellListId(spellId);
  if (!normalizedId) {
    return readSpellListIds(storage);
  }

  const currentIds = readSpellListIds(storage);
  if (currentIds.includes(normalizedId)) {
    return currentIds;
  }

  return writeSpellListIds([...currentIds, normalizedId], storage);
}

export function removeSpellListId(spellId: unknown, storage: SpellListStorageLike | null = getDefaultStorage()): string[] {
  const normalizedId = normalizeSpellListId(spellId);
  if (!normalizedId) {
    return readSpellListIds(storage);
  }

  const currentIds = readSpellListIds(storage);
  if (!currentIds.includes(normalizedId)) {
    return currentIds;
  }

  return writeSpellListIds(currentIds.filter((id) => id !== normalizedId), storage);
}

export function toggleSpellListId(spellId: unknown, storage: SpellListStorageLike | null = getDefaultStorage()): string[] {
  const normalizedId = normalizeSpellListId(spellId);
  if (!normalizedId) {
    return readSpellListIds(storage);
  }

  return readSpellListIds(storage).includes(normalizedId)
    ? removeSpellListId(normalizedId, storage)
    : addSpellListId(normalizedId, storage);
}

export function isSpellSaved(spellId: unknown, storage: SpellListStorageLike | null = getDefaultStorage()): boolean {
  const normalizedId = normalizeSpellListId(spellId);
  return normalizedId ? readSpellListIds(storage).includes(normalizedId) : false;
}

export function getSavedSpellCount(storage: SpellListStorageLike | null = getDefaultStorage()): number {
  return readSpellListIds(storage).length;
}

export function sortSavedSpellsByStoredOrder(spells: readonly PublicSpell[], savedIds: readonly string[]): PublicSpell[] {
  const order = new Map<string, number>();
  savedIds.forEach((id, index) => {
    order.set(id, index);
  });

  return [...spells].sort((first, second) => {
    const firstIndex = order.get(first.spell_id) ?? Number.MAX_SAFE_INTEGER;
    const secondIndex = order.get(second.spell_id) ?? Number.MAX_SAFE_INTEGER;
    return firstIndex - secondIndex || first.spell_name.localeCompare(second.spell_name, undefined, { sensitivity: 'base' });
  });
}
