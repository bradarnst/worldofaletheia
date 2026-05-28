import { getSpellByIdForBrowser, isPublicSpellApiError, type PublicSpell } from '@adapters/public-spell-api';
import {
  readSpellListIds,
  sortSavedSpellsByStoredOrder,
  toggleSpellListId,
  writeSpellListIds,
} from '@utils/spell-list-storage';

interface InitializeSpellListClientOptions {
  mode?: 'browse' | 'list';
}

type SpellFetchResult =
  | { kind: 'spell'; spell: PublicSpell }
  | { kind: 'missing'; spellId: string }
  | { kind: 'unavailable'; spellId: string; message: string };

const SPELL_TOGGLE_SELECTOR = '[data-spell-list-toggle]';
const SPELL_COUNT_SELECTOR = '[data-spell-list-count]';
const SPELL_LIST_ROOT_SELECTOR = '[data-saved-spell-list-root]';
const SPELL_PRINT_SELECTOR = '[data-spell-list-print]';
const SPELL_LIST_LINK_SELECTOR = '[data-spell-list-link]';

let isInitialized = false;
let currentMode: 'browse' | 'list' = 'browse';
let savedSpellListRenderSequence = 0;
const resolvedSpellCache = new Map<string, SpellFetchResult>();

function updateToggleButtons(savedIds: readonly string[]): void {
  const savedSet = new Set(savedIds);

  document.querySelectorAll<HTMLButtonElement>(SPELL_TOGGLE_SELECTOR).forEach((button) => {
    const spellId = button.dataset.spellId?.trim() ?? '';
    const isSaved = spellId !== '' && savedSet.has(spellId);
    const addLabel = button.dataset.addLabel?.trim() || 'Add to Spell List';
    const removeLabel = button.dataset.removeLabel?.trim() || 'Remove from Spell List';

    button.setAttribute('aria-pressed', String(isSaved));
    button.dataset.saved = isSaved ? 'true' : 'false';
    button.classList.toggle('ui-button--primary', isSaved);
    button.classList.toggle('ui-button--secondary', !isSaved);
    button.textContent = isSaved ? removeLabel : addLabel;
  });
}

function updateSavedCount(savedIds: readonly string[]): void {
  const count = savedIds.length;

  document.querySelectorAll<HTMLElement>(SPELL_COUNT_SELECTOR).forEach((element) => {
    element.textContent = String(count);
  });

  document.querySelectorAll<HTMLElement>(SPELL_LIST_LINK_SELECTOR).forEach((element) => {
    element.dataset.empty = count === 0 ? 'true' : 'false';
  });
}

function syncSavedState(savedIds: readonly string[]): void {
  updateToggleButtons(savedIds);
  updateSavedCount(savedIds);
}

function createTextElement<K extends keyof HTMLElementTagNameMap>(tagName: K, className: string, text: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function createSpellToggleButton(spellId: string, className = 'ui-button ui-button--secondary ui-button--sm'): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.dataset.spellListToggle = 'true';
  button.dataset.spellId = spellId;
  button.dataset.addLabel = 'Add to Spell List';
  button.dataset.removeLabel = 'Remove from Spell List';
  button.setAttribute('aria-pressed', 'false');
  button.textContent = 'Add to Spell List';
  return button;
}

function createSpellCard(spell: PublicSpell): HTMLElement {
  const article = document.createElement('article');
  article.className = 'spell-print-card ui-surface ui-surface--glass rounded-[1.5rem] p-6';

  const header = document.createElement('div');
  header.className = 'mb-5 flex flex-col gap-4 border-b border-base-300 pb-4 md:flex-row md:items-start md:justify-between';

  const headingGroup = document.createElement('div');
  headingGroup.append(
    createTextElement('h2', 'text-2xl font-bold text-ink-950', spell.spell_name),
    createTextElement('p', 'mt-2 text-sm text-ink-700', spell.spell_types.join(', ')),
    createTextElement('p', 'mt-2 text-lg font-semibold text-primary', spell.full_cost || '—'),
  );

  const actionGroup = document.createElement('div');
  actionGroup.className = 'print:hidden';
  actionGroup.append(createSpellToggleButton(spell.spell_id));

  header.append(headingGroup, actionGroup);

  const facts = document.createElement('section');
  facts.className = 'mb-5 grid gap-4 md:grid-cols-3';
  facts.append(
    createFactBlock('Casting Roll', spell.casting_roll),
    createFactBlock('Range', spell.range),
    createFactBlock('Duration', spell.duration),
  );

  const description = createSectionBlock('Description', spell.description);
  const statistics = createSectionBlock('Statistics', spell.statistics, 'whitespace-pre-wrap font-mono text-sm leading-relaxed text-ink-700');
  const counsel = createSectionBlock("Archmagister's Counsel", spell.archmagisters_counsel);

  const sourceGrid = document.createElement('section');
  sourceGrid.className = 'grid gap-4 md:grid-cols-2';
  sourceGrid.append(
    createFactBlock('Source Spell', spell.source_lineage.source_spell_name),
    createFactBlock('Source Spell Types', spell.source_lineage.source_spell_types.join(', ')),
  );

  article.append(header, facts, description, statistics, counsel, sourceGrid);
  return article;
}

function createFactBlock(label: string, value: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.append(
    createTextElement('p', 'mb-1 text-sm font-semibold uppercase tracking-[0.16em] text-ink-700', label),
    createTextElement('p', 'text-base text-ink-800', value.trim() || '—'),
  );
  return wrapper;
}

function createSectionBlock(label: string, value: string, valueClassName = 'text-base leading-relaxed text-ink-800'): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mb-5';
  section.append(
    createTextElement('p', 'mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-ink-700', label),
    createTextElement('p', valueClassName, value.trim() || '—'),
  );
  return section;
}

function setHidden(element: Element | null, hidden: boolean): void {
  if (!element) {
    return;
  }

  if (hidden) {
    element.setAttribute('hidden', 'hidden');
  } else {
    element.removeAttribute('hidden');
  }
}

async function fetchSpellResult(spellId: string): Promise<SpellFetchResult> {
  const cached = resolvedSpellCache.get(spellId);
  if (cached) {
    return cached;
  }

  try {
    const spell = await getSpellByIdForBrowser(spellId);
    const result: SpellFetchResult = { kind: 'spell', spell };
    resolvedSpellCache.set(spellId, result);
    return result;
  } catch (error) {
    if (isPublicSpellApiError(error)) {
      const result: SpellFetchResult = error.status === 400 || error.status === 404
        ? { kind: 'missing', spellId }
        : { kind: 'unavailable', spellId, message: error.message };
      if (result.kind !== 'unavailable') {
        resolvedSpellCache.set(spellId, result);
      }
      return result;
    }

    const result: SpellFetchResult = {
      kind: 'unavailable',
      spellId,
      message: 'Saved spell details are temporarily unavailable.',
    };
    return result;
  }
}

async function renderSavedSpellList(savedIds: readonly string[]): Promise<void> {
  const renderSequence = ++savedSpellListRenderSequence;
  const root = document.querySelector<HTMLElement>(SPELL_LIST_ROOT_SELECTOR);
  if (!root) {
    return;
  }

  const loading = root.querySelector<HTMLElement>('[data-saved-spell-list-loading]');
  const empty = root.querySelector<HTMLElement>('[data-saved-spell-list-empty]');
  const items = root.querySelector<HTMLElement>('[data-saved-spell-list-items]');
  const stale = root.querySelector<HTMLElement>('[data-saved-spell-list-stale]');
  const unavailable = root.querySelector<HTMLElement>('[data-saved-spell-list-unavailable]');

  if (!items) {
    return;
  }

  items.replaceChildren();
  stale?.replaceChildren();
  unavailable?.replaceChildren();

  if (savedIds.length === 0) {
    setHidden(loading, true);
    setHidden(empty, false);
    setHidden(stale, true);
    setHidden(unavailable, true);
    return;
  }

  setHidden(loading, false);
  setHidden(empty, true);
  setHidden(stale, true);
  setHidden(unavailable, true);

  const results = await Promise.all(savedIds.map((spellId) => fetchSpellResult(spellId)));
  if (renderSequence !== savedSpellListRenderSequence) {
    return;
  }

  const spells = sortSavedSpellsByStoredOrder(
    results.filter((result): result is Extract<SpellFetchResult, { kind: 'spell' }> => result.kind === 'spell').map((result) => result.spell),
    savedIds,
  );
  const staleIds = results.filter((result): result is Extract<SpellFetchResult, { kind: 'missing' }> => result.kind === 'missing').map((result) => result.spellId);
  const unavailableResults = results.filter((result): result is Extract<SpellFetchResult, { kind: 'unavailable' }> => result.kind === 'unavailable');

  if (spells.length > 0) {
    items.replaceChildren(...spells.map((spell) => createSpellCard(spell)));
  }

  if (staleIds.length > 0 && stale) {
    const note = createTextElement('p', 'text-sm text-ink-800', `Some saved spell IDs no longer resolve in the public dataset: ${staleIds.join(', ')}.`);
    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'ui-button ui-button--secondary ui-button--sm mt-4';
    clearButton.textContent = 'Remove Missing Entries';
    clearButton.addEventListener('click', () => {
      const retainedIds = readSpellListIds().filter((spellId) => !staleIds.includes(spellId));
      writeSpellListIds(retainedIds);
      syncSavedState(retainedIds);
      void renderSavedSpellList(retainedIds);
    });
    stale.replaceChildren(note, clearButton);
    setHidden(stale, false);
  }

  if (unavailableResults.length > 0 && unavailable) {
    unavailable.replaceChildren(
      createTextElement('p', 'text-sm text-ink-800', unavailableResults[0]?.message || 'Saved spell details are temporarily unavailable.'),
    );
    setHidden(unavailable, false);
  }

  setHidden(loading, true);
  setHidden(empty, spells.length > 0 || staleIds.length > 0 || unavailableResults.length > 0);
  syncSavedState(savedIds);
}

function handleDocumentClick(event: Event): void {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const toggleButton = target.closest<HTMLButtonElement>(SPELL_TOGGLE_SELECTOR);
  if (toggleButton) {
    const savedIds = toggleSpellListId(toggleButton.dataset.spellId ?? '');
    syncSavedState(savedIds);
    if (currentMode === 'list') {
      void renderSavedSpellList(savedIds);
    }
    return;
  }

  const printButton = target.closest<HTMLButtonElement>(SPELL_PRINT_SELECTOR);
  if (printButton) {
    window.print();
  }
}

export function initializeSpellListClient({ mode = 'browse' }: InitializeSpellListClientOptions = {}): void {
  currentMode = mode;

  const sync = (): void => {
    const savedIds = readSpellListIds();
    syncSavedState(savedIds);
    if (mode === 'list') {
      void renderSavedSpellList(savedIds);
    }
  };

  if (!isInitialized) {
    document.addEventListener('click', handleDocumentClick);
    isInitialized = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sync, { once: true });
  } else {
    sync();
  }
}
