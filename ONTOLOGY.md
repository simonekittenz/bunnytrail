# Ontology files

This document describes the current structure of ontology metadata in
Bunnytrail world directories. Any tool, agent, or script that reads or writes
`content_meta/kinds/` or `content_meta/world.md` must conform to this
structure.

## File structure

A folder under `content_meta/kinds/` is treated as an **ontology container**
when it contains `_ontology.yaml` and no `_kind.yaml`. Kind folders nested
inside it become members of that ontology (`Kind.group` is set to the
container folder's name).

A `_ontology.yaml` placed directly at the root of `content_meta/kinds/` (not
inside a subfolder) acts as the **root ontology** — its relations are registered
with bare (unprefixed) ids.

```
content_meta/kinds/
  _ontology.yaml            ← optional root ontology (global / unprefixed relations)
  <ontology-id>/
    _ontology.yaml          ← declares this folder as a named ontology
    <kind-id>/
      _kind.yaml            ← a kind; may declare properties
    <kind-id>/
      ...
  <kind-id>/                ← a kind with no ontology (group: null)
    _kind.yaml
```

One level only. Ontology folders cannot be nested inside other ontology
folders.

## `_ontology.yaml` schema

All fields are optional. An empty file (or absent file) is valid.

```yaml
title: Human-readable display name   # string | omit
description: Short editorial note    # string | omit

relations:
  <slug>:                           # bare slug — engine prepends <ontology-id>/
    outLabel: Label from source     # string, required
    inLabel: Label from target      # string, required
    domain: [kind-id, ...]          # array of kind ids | omit
    codomain: [kind-id, ...]        # array of kind ids | omit
    role: required                  # 'required' | omit — see below
    governedBy: <full-relation-id>  # full prefixed id | omit — see below
```

For the root ontology (`content_meta/kinds/_ontology.yaml`), relation keys are
bare slugs with no prefix applied — they remain bare in the registry too.

When `title` is absent the engine falls back to a title-cased version of the
folder name.

### `role: required`

When set to `required`, every instance of this relation in entity YAML must
carry a `role:` qualifier. Missing role emits a health-page warning.

```yaml
# _ontology.yaml
relations:
  member-of:
    outLabel: Member of
    inLabel: Members
    role: required
    domain: [character]
    codomain: [cultural-group, institution]
```

```yaml
# entity YAML — valid
relations:
  - kind: cultural/member-of
    target: aurethia/people/cultures/shar/herds/the-dawncallers
    role: aurethia/people/cultures/shar/social-structure/runtha

# entity YAML — invalid (missing role → health warning)
relations:
  - kind: cultural/member-of
    target: aurethia/people/cultures/shar/herds/the-dawncallers
```

`role: required` and `governedBy` are independent — either can be set without
the other.

### `governedBy`

When set, any instance of this relation that carries a `role:` qualifier must
have that role entity hold an outgoing relation of the named kind pointing at
**the same target, or at any entity in the target's class chain**.

The class-chain resolution is the key: if `the-dawncallers` has
`class: herd`, then a `role-in → herd` backing edge on the role entity is
sufficient — you don't need a `role-in → the-dawncallers` edge for every
concrete instance.

```yaml
# _ontology.yaml
relations:
  role-in:
    outLabel: Role in
    inLabel: Roles
    domain: [role]
    codomain: [social-structure]

  member-of:
    outLabel: Member of
    inLabel: Members
    role: required
    governedBy: cultural/role-in   # full prefixed id
    domain: [character]
    codomain: [cultural-group, institution]
```

With the above schema, the following is valid because `runtha` has
`cultural/role-in → herd` and `the-dawncallers` has `class: herd`:

```yaml
# runtha (a role entity)
relations:
  - kind: cultural/role-in
    target: aurethia/people/cultures/shar/social-structure/herd

# the-dawncallers (a cultural-group entity)
class: aurethia/people/cultures/shar/social-structure/herd

# old-elfric (a character entity)
relations:
  - kind: cultural/member-of
    target: aurethia/people/cultures/shar/herds/the-dawncallers
    role: aurethia/people/cultures/shar/social-structure/runtha
```

A health warning is emitted when:
- The role entity has no `governedBy`-kind edge to the target or to any entity
  in the target's class chain.

`governedBy` only fires when a `role:` qualifier is present on the instance. It
does not imply `role: required` — set both when every instance must carry a role
AND that role must satisfy the backing-edge constraint.

### Relation id convention

Relation keys in `_ontology.yaml` are bare slugs. The engine prepends the
ontology folder name to form the full id used in the registry and in entity
YAML:

```yaml
# content_meta/kinds/cultural/_ontology.yaml
relations:
  member-of:                  ← authored as bare slug
    outLabel: Member of
    inLabel: Members
    codomain: [cultural-group, institution]
```

The engine registers this as `cultural/member-of`. Entity YAML must use the
full prefixed id:

```yaml
relations:
  - kind: cultural/member-of
    target: some-institution
```

## `_kind.yaml` schema

```yaml
singular: Display name singular      # string | omit
plural: Display name plural          # string | omit
description: Short editorial note    # string | omit
class: <kind-id>                     # string | omit — see below
type: class                          # omit | class — entities of this kind are classes

properties:
  <property-id>:                     # e.g. gender, notation
    label: Display label             # string, required
    values: [value, ...]             # enum of allowed values | omit
```

Properties declared on a kind are valid on that kind and all its descendants
via the kind hierarchy — no `allowedKinds` field is needed or supported.
Entity YAML uses the bare property id:

```yaml
properties:
  gender: woman
```

### `class` constraint on kinds

The `class` field on a `_kind.yaml` declares that every entity of this kind
(or any descendant kind) that carries a `class:` field in its frontmatter must
point to an entity whose own `kind` is the declared kind or a descendant of it.
Entities whose kind has no `class` constraint are not permitted to set `class:`
at all — doing so emits a health-page warning.

```yaml
# content_meta/kinds/natural/character/person/_kind.yaml
singular: Person
class: humanoid   # every person's class: must point to a humanoid-kinded entity
```

The `class:` field on an entity frontmatter is a pointer to a concrete instance
(another entity) that represents the entity's sub-type or natural class — for
example, pointing a person entity at a specific `humanoid` entity that defines
their species. The engine validates three things:

1. The class target must be a known entity (broken-link check).
2. The entity's kind (or an ancestor kind) must declare a `class` constraint.
   Setting `class:` on a kind with no constraint emits a `property-kind-mismatch`
   warning.
3. The class target's own `kind` must be the constrained kind or a descendant.

```yaml
# valid — target is a humanoid-kinded entity
name: Nora Patel
kind: person
class: foundation/nature/mortals/human

# invalid — 'human' kind is not 'place' or a descendant
name: Nora Patel
kind: person
class: aurethia/places/bayurinda   # health warning: kind mismatch
```

The `class` constraint is inherited: if `person` declares `class: humanoid`,
all descendants of `person` (e.g. `creature`, `entity`) inherit that constraint
without needing to redeclare it. A descendant may declare its own `class` to
narrow the constraint further.

The `class` chain on an entity (entity → `class` target → target's `class`
target → …) is also used by the `governedBy` backing-edge check — see
[`governedBy`](#governedby) above.

### `type: class` on kinds

`type: class` makes every entity of the kind (and of descendant kinds) a class
definition, as if each carried `type: class`; an entity's own `type:` still
wins. A class may itself carry `class:`, which makes it a subclass of its
target. The target must be a class, and the chain must not loop. A class page
lists the entities pointing at it under an **Instances** tab, or **Subclasses**
when all of them are classes themselves.

## Multi-kinded entities

An entity may belong to more than one kind. Author `kind` as a list; the
**first entry is the primary kind**.

```yaml
name: Saulam Karat
kind: [temple-complex, city]
```

The loader normalises this to `meta.kind` (the primary, a string — so
single-kind code keeps working) and `meta.kinds` (every kind, primary first,
duplicates removed). Read it with `kindsOf(meta)` from `#lib/types.js`; a
plain `kind: city` yields `['city']`.

Wherever a kind grants something, *any* of the entity's kinds counts:

- **Relations** — `domain`, `codomain` and `qualifierDomain` are satisfied if
  any kind (or an ancestor of it) matches, so the entity can be the source or
  target of relations from both kinds' vocabularies.
- **Properties** — a property declared on any of the kinds (or their ancestors)
  is valid, and its label/unit resolve from it.
- **`class`** — an entity inherits the class constraint of each of its kinds;
  the class target must satisfy all of them.
- **Kind pages, kind counts, collection filter chips, search** — the entity
  appears under each of its kinds, once per kind (never twice under a shared
  ancestor).
- **`eraBounded`** — set on any one of the kinds is enough.
- **Registry check** — each kind in the list must be registered; an
  unregistered one is reported separately.

The primary kind alone drives *singular* presentation: card eyebrows, the
graph node colour, and which group heading the entity sits under inside its
parent. The entity page header shows a chip for every kind.

## `world.md` strictness toggles

`content_meta/world.md` holds two global strictness booleans. Both default to
`false` — strict mode — meaning undeclared relation kinds and property keys
produce health-page warnings.

```yaml
# content_meta/world.md
allowUndefinedRelations: false    # warn on relation kinds not in any _ontology.yaml
allowUndefinedProperties: false   # warn on property keys not in any _kind.yaml
```

Set either to `true` to silence warnings while the schema is being built out.
Neither the relation registry nor the property registry lives in `world.md`.

## Engine API

| Symbol | Type | Notes |
|---|---|---|
| `Ontology` | interface (`src/lib/types.ts`) | `{ id, title: string\|null, description: string\|null, relations: RelationRegistry }` |
| `RelationSchema` | interface (`src/lib/types.ts`) | `{ outLabel, inLabel, domain?, codomain?, role?, governedBy? }` |
| `RelationSchema.role` | `'required' \| undefined` | When `'required'`, every instance must carry a `role:` qualifier |
| `RelationSchema.governedBy` | `string \| undefined` | Full prefixed relation id; role entity must have a backing edge to the target or its class chain |
| `KindMeta.properties` | `Record<string, { label, values? }> \| undefined` | Per-kind property declarations |
| `KindMeta.class` | `string \| undefined` | Kind id that constrains which class entities may be assigned to entities of this kind |
| `PropertySchema` | interface (`src/lib/types.ts`) | `{ label, declaringKind, values? }` — `declaringKind` set by loader |
| `graph.ontologyRegistry()` | `ReadonlyMap<string, Ontology>` | All loaded ontologies |
| `graph.ontology(id)` | `Ontology \| undefined` | Single lookup by folder name |
| `graph.relationRegistry()` | `RelationRegistry` | Merged registry from all ontologies |
| `graph.propertyRegistry()` | `PropertyRegistry` | Merged registry from all kinds |
| `Kind.group` | `string \| null` | Ontology id this kind belongs to, or null |
| `KindLoadResult.relations` | `RelationRegistry` | Merged relation registry |
| `KindLoadResult.properties` | `PropertyRegistry` | Merged property registry |
| `LoadResult.relations` | `RelationRegistry` | Threaded through from `KindLoadResult` |
| `LoadResult.properties` | `PropertyRegistry` | Threaded through from `KindLoadResult` |
| `OntologySection` | interface (`src/lib/routes/kinds/load.ts`) | View-model section on the kinds index page |
| `GraphData.ontologyOf` | `Record<string, string\|null>` | kind id → ontology id, for the graph filter bar |
| `GraphData.ontologyTitles` | `Record<string, string>` | ontology id → display title |

## Replaces

**`_kindgroup.yaml`** — ontology containers were previously declared with a
`_kindgroup.yaml` marker file. Rename any such files to `_ontology.yaml`. The
field set (`title`, `description`) is unchanged; `relations:` is new.

**`relations:` block in `world.md`** — the relation registry previously lived
as a flat `relations:` mapping in `content_meta/world.md`. It has moved into
the `relations:` block of each relevant `_ontology.yaml`. The
`allowUndefinedRelations` boolean remains in `world.md` as a global strictness
toggle; the registry itself does not.

**`properties:` block in `world.md`** — the property registry previously lived
as a `properties:` mapping in `content_meta/world.md` with an `allowedKinds`
field for scoping. It has moved into the `properties:` block of each relevant
`_kind.yaml`. Kind scope is now implicit via the kind hierarchy — `allowedKinds`
is no longer supported. The `allowUndefinedProperties` boolean remains in
`world.md`; the registry itself does not.
