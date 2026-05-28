import { describe, expect, it } from 'vitest';
import {
  addSpellListId,
  getSavedSpellCount,
  isSpellSaved,
  normalizeSpellListIds,
  readSpellListIds,
  removeSpellListId,
  sortSavedSpellsByStoredOrder,
  SPELL_LIST_STORAGE_KEY,
  toggleSpellListId,
  writeSpellListIds,
  type SpellListStorageLike,
} from './spell-list-storage';

class MemoryStorage implements SpellListStorageLike {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

class ThrowingSetStorage extends MemoryStorage {
  override setItem(): void {
    throw new Error('set blocked');
  }
}

class ThrowingGetStorage extends MemoryStorage {
  override getItem(): string | null {
    throw new Error('get blocked');
  }
}

describe('spell-list-storage', () => {
  it('returns an empty list when storage is missing', () => {
    expect(readSpellListIds(null)).toEqual([]);
  });

  it('returns an empty list for malformed JSON', () => {
    const storage = new MemoryStorage();
    storage.setItem(SPELL_LIST_STORAGE_KEY, '{bad json');

    expect(readSpellListIds(storage)).toEqual([]);
  });

  it('returns an empty list for non-array JSON', () => {
    const storage = new MemoryStorage();
    storage.setItem(SPELL_LIST_STORAGE_KEY, JSON.stringify({ ids: ['spell-1'] }));

    expect(readSpellListIds(storage)).toEqual([]);
  });

  it('normalizes mixed invalid entries and deduplicates while preserving order', () => {
    expect(normalizeSpellListIds([' spell-1 ', '', 'spell-2', 'spell-1', 42, null, 'spell-3'])).toEqual([
      'spell-1',
      'spell-2',
      'spell-3',
    ]);
  });

  it('writes normalized ids and removes the key when empty', () => {
    const storage = new MemoryStorage();

    expect(writeSpellListIds([' spell-1 ', 'spell-2', 'spell-1'], storage)).toEqual(['spell-1', 'spell-2']);
    expect(storage.getItem(SPELL_LIST_STORAGE_KEY)).toBe(JSON.stringify(['spell-1', 'spell-2']));

    expect(writeSpellListIds([], storage)).toEqual([]);
    expect(storage.getItem(SPELL_LIST_STORAGE_KEY)).toBeNull();
  });

  it('adds ids idempotently', () => {
    const storage = new MemoryStorage();

    expect(addSpellListId('spell-1', storage)).toEqual(['spell-1']);
    expect(addSpellListId('spell-1', storage)).toEqual(['spell-1']);
    expect(addSpellListId(' spell-2 ', storage)).toEqual(['spell-1', 'spell-2']);
    expect(readSpellListIds(storage)).toEqual(['spell-1', 'spell-2']);
  });

  it('removes ids idempotently', () => {
    const storage = new MemoryStorage();
    writeSpellListIds(['spell-1', 'spell-2'], storage);

    expect(removeSpellListId('spell-1', storage)).toEqual(['spell-2']);
    expect(removeSpellListId('spell-1', storage)).toEqual(['spell-2']);
    expect(readSpellListIds(storage)).toEqual(['spell-2']);
  });

  it('toggles ids based on current saved state', () => {
    const storage = new MemoryStorage();

    expect(toggleSpellListId('spell-1', storage)).toEqual(['spell-1']);
    expect(toggleSpellListId('spell-1', storage)).toEqual([]);
  });

  it('fails softly when reads throw', () => {
    expect(readSpellListIds(new ThrowingGetStorage())).toEqual([]);
    expect(getSavedSpellCount(new ThrowingGetStorage())).toBe(0);
    expect(isSpellSaved('spell-1', new ThrowingGetStorage())).toBe(false);
  });

  it('returns the intended next state when writes throw', () => {
    const storage = new ThrowingSetStorage();

    expect(addSpellListId('spell-1', storage)).toEqual(['spell-1']);
    expect(removeSpellListId('spell-1', storage)).toEqual([]);
    expect(writeSpellListIds(['spell-2'], storage)).toEqual(['spell-2']);
  });

  it('sorts resolved saved spells by the stored id order', () => {
    const sorted = sortSavedSpellsByStoredOrder([
      { spell_id: 'spell-2', spell_name: 'B', spell_types: [], keywords: [], archmagisters_counsel: '', source_lineage: { source_spell_name: '', source_spell_types: [] }, full_cost: '', casting_roll: '', range: '', duration: '', description: '', statistics: '' },
      { spell_id: 'spell-1', spell_name: 'A', spell_types: [], keywords: [], archmagisters_counsel: '', source_lineage: { source_spell_name: '', source_spell_types: [] }, full_cost: '', casting_roll: '', range: '', duration: '', description: '', statistics: '' },
    ], ['spell-1', 'spell-2']);

    expect(sorted.map((spell) => spell.spell_id)).toEqual(['spell-1', 'spell-2']);
  });
});
