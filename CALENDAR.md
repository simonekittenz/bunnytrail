# Custom Calendar System

Bunnytrail supports world-defined calendar systems. Calendars are
declared in `content_meta/world.md` and referenced from timeline
entries. The engine handles parsing, sorting, and display; the world
author controls every date format and naming convention.

## Declaring a calendar

Calendars live under `customCalendars` in `content_meta/world.md`:

```yaml
---
customCalendars:
  default: revelant          # calendar id used when no calendar is stated
  calendars:
    revelant:
      name: The Revelant Calendar
      units:
        - unit: eve
          irregular:
            - { ref: 1, values: 88 }
            - { ref: 2, values: 120 }
            - { ref: 6, values: null }   # open-ended current Eve
        - { unit: year }
        - { unit: circle, per: 9 }
        - { unit: arc,    per: 3 }
        - { unit: day,    per: 21 }
      input: E-Y-C-A-D
      display: "{E:ordinal} Eve, Year {Y} — {C:ordinal} Circle {A:mapped}, Day {D}"
      tokens:
        E: { numeral: ordinal }
        C: { numeral: ordinal }
        A: { numeral: mapped, values: [Low, Rising, Returning] }
---
```

### `units`

Ordered big → small. The first unit is the largest (typically the
era or epoch). Each entry:

| field       | type                   | meaning                                                   |
|-------------|------------------------|-----------------------------------------------------------|
| `unit`      | string                 | lowercase identifier used in labels                       |
| `per`       | integer                | how many of this unit fit in one parent unit              |
| `irregular` | list of segment entries | when the parent's capacity varies per instance (see below) |

The top unit has no `per`. A unit whose size is governed by an
`irregular` parent also omits `per`.

### `irregular`

Attach an `irregular` list to any unit whose instances have
**different numbers of child units**. Each list entry:

| field    | type              | meaning                                               |
|----------|-------------------|-------------------------------------------------------|
| `ref`    | integer           | 1-based instance number (must be contiguous from 1)   |
| `values` | integer or `null` | how many child units this instance contains; `null` = open-ended |

The last entry may have `values: null` to mark the current,
still-running instance (no upper bound on the child unit).

The `irregular` table is **load-bearing**: changing a past entry's
`values` shifts every absolute-day sort key after it. Add entries in
order and only amend closed ones when lore is retconned.

Any level of the hierarchy may be irregular — not only the top unit.
The engine handles the first irregular unit in the chain; nested
irregular units are reserved for future support.

### `input`

A separator-joined string of uppercase token letters matching the
`units` order. Example: `E-Y-C-A-D` for five units. This defines
what each position in a date tuple means.

---

## Authoring dates in frontmatter

Inside a `_time.md` file:

```yaml
---
date:
  calendar: revelant
  value: [6, 143, 5, 2, 12]   # Eve 6, Year 143, Circle 5, Arc 2, Day 12
---
```

Or as a shorthand string:

```yaml
date: "6-143-5-2-12"
```

When no `calendar` key is given the world's `default` calendar is
used. When `BUNNYTRAIL_WORLD_DIR` has no `customCalendars` the date
is treated as a plain integer year.

### Partial dates

You may omit trailing units. `[6, 143]` means "somewhere in Year
143 of the Sixth Eve". The engine pads missing units with `1` for
sorting (so the entry appears at the start of its period) and renders
only the tokens that were provided.

```yaml
value: [6]          # eve-precision only
value: [6, 143]     # eve + year
value: [6, 143, 5]  # eve + year + circle
```

---

## Display templates

### `display`

The fallback template, used when no precision-keyed entry matches:

```yaml
display: "{E:ordinal} Eve, Year {Y} — {C:ordinal} Circle {A:mapped}, Day {D}"
```

Tokens use the format `{LETTER}` or `{LETTER:hint}`. Literal text
(spaces, punctuation, unit names) passes through unchanged. Tokens
for unspecified units render as an empty string.

### `displayByPrecision`

Optional map from the number of provided units to a display template.
Each entry is either a plain string (both variants use it) or an
object with separate `heading` and `display` keys:

```yaml
displayByPrecision:
  1: "{E:ordinal} Eve"                          # plain string
  2:
    heading: "{E:ordinal} Eve, Year {Y}"
    display: "Year {Y} of the {E:ordinal} Eve"
  5:
    heading: "{E:ordinal} Eve, Year {Y} — {C:ordinal} Circle {A:mapped}, Day {D}"
    display: "Year {Y}, {C:ordinal} Circle {A:mapped}, Day {D}"
```

**Resolution order** for a date with N units:

1. `displayByPrecision[N].heading` (or `.display`) if an object entry exists
2. The other key in the same object entry, if the requested variant is absent
3. `displayByPrecision[N]` if it is a plain string
4. Top-level `display`

### Variants

`formatCalendarDate` accepts a `variant` argument:

| variant     | used for                                              |
|-------------|-------------------------------------------------------|
| `'display'` | timeline list labels, nav strip labels (default)      |
| `'heading'` | dot-page `<h1>`, breadcrumbs, anywhere a title is set |

On the dot page, the `display` variant is shown as a small-caps
dateline below the summary — but only when it differs from the
heading label. If both variants produce the same string the dateline
is suppressed.

---

## Token numerals

Tokens render their integer value in one of five modes. Set the mode
in the `tokens` block or override it per-template with an inline hint.

| numeral          | example (value 5) | notes                                      |
|------------------|-------------------|--------------------------------------------|
| `cardinal`       | `5`               | default when no `tokens` entry exists      |
| `ordinal`        | `Fifth`           | English word ordinals up to 30, then numeric |
| `ordinal-short`  | `5th`             | numeric ordinal suffix (`1st`, `2nd`, …)   |
| `roman`          | `V`               | uppercase Roman numerals                   |
| `mapped`         | `Rising`          | 1-based lookup into a `values` list        |

### Inline hints

A hint in the template overrides the `tokens` def for that one
substitution:

```
{E:ordinal}        → Fifth   (word)
{E:ordinal-short}  → 5th     (numeric suffix)
{E:roman}          → V
{E:cardinal}       → 5
{A:mapped}         → Rising  (uses default values list)
{A:mapped.short}   → A       (uses the named mapping "short")
```

### `tokens` block

Only declare tokens that need non-cardinal rendering. Cardinal tokens
need no entry.

```yaml
tokens:
  E: { numeral: ordinal }
  C: { numeral: ordinal }
  A:
    numeral: mapped                         # default for bare {A}
    values: [Low, Rising, Returning]        # used by {A} and {A:mapped}
    mappings:
      short: [L, A, R]                      # used by {A:mapped.short}
      label: [The Low Eve, The Rising Eve, The Returning Eve]
```

`values` is the default mapped list, used by `{A}` (when `numeral:
mapped`) and `{A:mapped}`. Named mappings are referenced as
`{A:mapped.name}`. When a named mapping is requested but not found,
the engine falls back to `values`; when `values` is also absent it
falls back to the cardinal integer.

---

## Sorting

Dates are sorted by an **absolute-day** integer computed at load time.

For a calendar where the top unit is irregular (e.g. eves with
different year counts):

```
absoluteChild = Σ(values of all prior segments) + (childValue − 1)
absoluteDay   = absoluteChild × D_per_child
              + (unit2 − 1) × D_per_unit2
              + …
```

For a fully regular calendar (all units have fixed `per`):

```
absoluteDay = (unit0 − 1) × size0
            + (unit1 − 1) × size1
            + …
```

where `size_n` is derived from the `units[].per` chain bottom-up.

Partial dates pad missing units with `1` before folding, so a
year-precision entry sorts to the very start of that year.

Entries on different calendars within the same timeline are sorted
independently by their own calendar's fold. Cross-calendar sort
normalisation is not currently supported.

### Undated entries

A mythological or otherwise undated sequence has an order but no dates.
A dot with a numeric `rank:` and **no** `year:` or `date:` is *undated*:

```yaml
# thallic-ages/_time.md
type: line
name: Mythological Ages of the Thallic Tradition
rankDisplay: roman        # arabic (default) | roman | none

# thallic-ages/6-great-reunion/_time.md
type: dot
name: Great Reunion       # an undated entry's title; falls back to the folder name
rank: 6
status: prophesied        # optional free-form chip: present, prophesied, …
summary: A future reconciliation anticipated in certain prophetic traditions.
```

- Undated entries sort **after** dated ones, ascending by `rank`
  (`compareTimelineEntries` in `types.ts`); folder names don't matter.
- The list shows the `name` where a date would be, with the rank glyph
  per the line's `rankDisplay`. `status` renders as a chip with a
  `data-status` hook for theming.
- They never count towards a timeline's year or date range, and they
  carry no calendar. Don't mix them into a calendared line.
- A non-numeric folder with no `year`, `date` or `rank` is still skipped.
- `rank:` on a nested `type: period` line orders sibling sub-timelines
  (ranked first, the rest in folder order).

### Dots as entities

A dot that declares a `kind:` is **also an entity**, with the dot's path as
its id. It takes everything an entity does: `relations`, `tags`, `aliases`,
`era`, `properties`, a multi-kind list, backlinks, kind pages, search, the
graph, and relation-schema validation. A dot without `kind:` stays a plain
dot (so existing timelines are unaffected).

```yaml
# bajurindan-ages/the-drowning/_time.md
type: dot
kind: event
name: The Drowning
rank: 3
era: mythic
relations:
  - kind: temporal/happened-on
    target: aurethia/places/in-the-void/aureth-system/bayurinda
  - kind: temporal/occurred-in
    target: aurethia/history/timelines/bajurindan-ages/age-of-kush
```

- The timeline-only keys (`type`, `year`, `date`, `calendar`, `target`,
  `rankDisplay`) stay on the timeline and never reach the entity. `rank` and
  `status` are shared.
- The dot's URL renders the full entity page with the previous · current ·
  next strip above it (`TimelineDotNav.svelte`). For an undated dot the strip
  shows its rank glyph, since the name is already the heading.
- Name the folder after the slug (`the-drowning`, not `3-the-drowning`) so
  `[[the-drowning]]` resolves like any entity; `rank` carries the order.
- Slug wikilinks stay cluster-scoped, as for any entity. A dot whose path
  is already an entity is reported and skipped.

---

## Multiple calendars

A world may define as many calendars as it needs. Each timeline entry
declares which calendar its date belongs to:

```yaml
date:
  calendar: old-reckoning
  value: [3, 44, 2]
```

Calendar inheritance on timelines (dot `_time.md` → line `_time.md`
→ world default) means you can set `calendar: revelant` once on the
line and omit it from every dot.
