# Runbook: Sorcerer Spell Data Refresh

Use this when you have a better full-source JSON file for the GURPS sorcerer spell data and want to replace the checked-in dataset.

## What this updates

- `src/data/spells/spells-raw.json`
- `src/data/spells/spell-types.json`

The refresh script:

- validates the source file shape
- trims string fields
- preserves spell text/content
- regenerates the type list from `spell_type`
- warns about empty display fields and duplicate names

## Source file requirements

The input file must be valid JSON with this top-level shape:

```json
{
  "metadata": {},
  "spells": [
    {
      "spell_name": "...",
      "spell_type": "..."
    }
  ]
}
```

The script tolerates missing display fields such as `description`, `statistics`, or `casting_roll`, but it will warn when they are empty.

## Refresh workflow

From the project root:

### 1) Validate the new source without writing files

```bash
node scripts/generate-spell-data.mjs /absolute/path/to/full-sorcery-spells.json --validate-only
```

Review the warning summary.

### 2) Replace the checked-in spell files

```bash
node scripts/generate-spell-data.mjs /absolute/path/to/full-sorcery-spells.json
```

This overwrites:

- `src/data/spells/spells-raw.json`
- `src/data/spells/spell-types.json`

### 3) Verify the site still builds

```bash
pnpm build
```

## Safe rerun behavior

Yes — if you get better source data later, you can rerun the same script again.

Expected rerun behavior:

- latest source file replaces the current checked-in spell dataset
- spell types are regenerated from the new data
- warnings may go down or up depending on source quality
- spell pages automatically pick up the refreshed data on the next build

## Interpreting warnings

Typical warnings are non-fatal:

- empty `description`
- empty `statistics`
- empty `casting_roll`
- duplicate spell names

These warnings do not block the spell pages from rendering. Empty display fields show as `—` in the UI.

## After refresh

Spot-check these pages:

- `/systems/gurps/resources/sorcerer-spells`
- `/systems/gurps/resources/sorcerer-spells/all`
- `/systems/gurps/resources/sorcerer-spells/adventurer-spells`

If the dataset is much larger, also spot-check paginated list pages such as:

- `/systems/gurps/resources/sorcerer-spells/all/2`
