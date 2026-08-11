# Evercrafted Placement Engine — Sprint 1

**Composition Canvas Foundation.** An interactive wreath blueprint canvas where a creator can
define, edit, save, and reload the first Evercrafted placement skeleton.

> Architecture before decoration. Blueprint before render. Explainability over magic.

---

## Run it

```bash
npm start          # serves at http://127.0.0.1:4173
npm test           # 91 tests, zero dependencies
```

No build step, no dependencies. `npm start` runs a ~60-line static server from the Node standard
library, which exists only because ES modules will not load over `file://`.

To walk the ticket's Definition of Done in a real browser:

```bash
npm i -D playwright && npx playwright install chromium
node tools/verify-dod.mjs      # with npm start running in another terminal
```

Playwright is not a project dependency — `npm test` stays dependency-free.

---

## Read this first

**[`CONFLICTS.md`](./CONFLICTS.md)** — ten places where the Sprint 1 build ticket contradicts,
under-specifies, or silently drops something the canon or spec requires. Each has a provisional
resolution chosen to satisfy *both* readings where possible, and each names the exact file and
constant to change if the ruling goes the other way. **None of those resolutions are canon.** They
are awaiting a creative-director decision.

The three that most affect the data model:

| | Conflict | Held as |
|---|---|---|
| C-01 | Composition gravity is sequenced *before* the anchor in the engine spec and *after* it in the composition canon | Both — an authored `declared` value and a live computed vector, never reconciled silently |
| C-02 | Hardware clearance is a property of the anchor in two sources and its own object in three | First-class object linked to the anchor, surfaced as a child in the anchor's inspector |
| C-04 | The sweep's "≈15°" width names no axis — degrees are an angle, width is a distance | Band thickness measured as arc-degrees at the ring's mean radius, shown in inches too |

---

## What Sprint 1 covers

Everything in the ticket's scope, and nothing past it.

- **Canvas** — circular 24 in base, toggleable clock overlay, zoom, pan, layer rendering
- **Primary anchor** — the 7–9 o'clock arc, with adjustable start/end, depth, visual weight,
  hardware clearance, and lock
- **Primary sweep** — an editable path leaving the anchor, with adjustable travel, curvature,
  width, taper, and a narrow guiding band by default
- **Secondary echo** — near 5 o'clock, lighter than the anchor, related to it by offset, with a
  placeholder field for the repeated focal colour/species
- **Blueprint data model** — base, anchor, clearance, sweep, echo, positions, dimensions,
  dependencies, explanations, version metadata
- **Inspector** — editable properties, explainability, dependency information
- **Save / load** — create, save, reload, retaining every transform and all metadata
- **Validation** — the ticket's five blocking validators, plus seven non-blocking advisories
  derived from the spec's acceptance criteria

**Deliberately not built** (ticket §9): inventory matching, floral species selection, production
rendering, marketplace, memory parsing, canon learning, multi-anchor formulas. The echo's
focal-repeat field is free text wired to nothing, exactly as the ticket specifies.

---

## How it is put together

```
src/
  core/        DOM-free, pure, directly unit tested
    geometry.js   clock ↔ angle ↔ cartesian, arc algebra, SVG path building
    schema.js     blueprint model, defaults, property specs, schema validation
    canon.js      citable rule registry — every rule carries its actual text
    analysis.js   dependency reflow, visual presence, composition gravity, rest zones
    explain.js    the spec's five explainability questions, generated live
    validate.js   five blocking validators + seven advisories
    actions.js    pure blueprint transforms
    store.js      minimal observable
  io/
    persistence.js  localStorage library + JSON file export/import
  ui/            DOM only — no design logic lives here
    canvas.js      SVG scene, drag editing, zoom/pan
    layers.js  inspector.js  report.js  toolbar.js  dom.js
```

Four decisions worth knowing about:

**`objects` is an array, not fixed slots.** The ticket's Developer Note requires the architecture to
stay flexible for later composition formulas, and "exactly one primary anchor" is not a testable
validator if the model can only ever hold one.

**Nothing derived is stored.** Presence, gravity, rest zones, and validation are recomputed from the
blueprint on every render, so the canvas, inspector, and report cannot disagree about a number.

**Explanations are generated, never stored.** A saved sentence reading "spans 7:00 to 9:00" becomes
a lie the moment the anchor is dragged. An author *may* override the text — an override is marked
**authored** rather than canon-derived, and the engine's own reasoning is kept beside it.

**Degrees are the only stored angular unit**, clockwise from 12 o'clock. Clock notation is a display
and input format. See CONFLICTS.md C-08.

---

## The canonical test composition

The default blueprint is the spec's 24-inch test composition, and it passes every validator clean:

| Object | Position | Presence |
|---|---|---|
| Primary anchor | 7:00 → 9:00 (60°) | 60.0 |
| Hardware clearance | centred 8:00, 22° wide | reserved void |
| Primary sweep | 9:00 → 1:30 (135° clockwise) | 31.2 |
| Secondary echo | 5:00, 34° wide | 10.7 |

131° of the form is left as rest, in two zones of 88° and 43°. Visual weight concentration is
**0.58**, against a half-moon threshold of 2/π ≈ **0.637** — asymmetric, as intended, but resolved.

The ticket's Developer Note is taken seriously: these clock positions are the first canonical test
composition, not design law. Every one of them is an editable property with no special-casing
anywhere in the engine.

---

## Validation, in two tiers

**Blocking** — exactly the five from ticket §8. Nothing else prevents a save.

1. one primary anchor · 2. echo smaller than anchor · 3. hardware clearance not obstructed ·
4. required explanation exists · 5. saved blueprint schema is valid

**Advisory** — non-blocking, derived from the spec's acceptance criteria, which ask for more than
the ticket does. The clearest example: the ticket only compares the *echo* to the anchor, so a
**sweep** that out-masses the anchor breaks EC-COMP-001 Law 1 while passing every ticketed
validator. That is an advisory, not a silent pass.

Advisories cover anchor dominance against all objects, echo-approaching-parity, half-moon
concentration, rest-zone presence, sweep-is-a-gesture-not-a-hedge (GRN-B02), clearance containment,
and declared-vs-computed gravity.

---

## Keyboard

| | |
|---|---|
| drag object / handles | move and resize |
| <kbd>shift</kbd> + drag | snap to half-hours |
| scroll · drag empty space | zoom · pan |
| <kbd>0</kbd> · double-click | reset the view |
| <kbd>←</kbd> <kbd>→</kbd> | nudge the selection 1° (5° with <kbd>shift</kbd>) |
| <kbd>c</kbd> <kbd>r</kbd> <kbd>g</kbd> | clock · rest zones · gravity marker |
| <kbd>l</kbd> | lock/unlock the selection |
| <kbd>⌘/ctrl</kbd> + <kbd>s</kbd> | save |

---

## Canon sources

`handoff/` holds the design system this build follows, unpacked from the handoff package so the
rules stay greppable and quotable from code:

`EC-DOS-001` Design Operating System · `EC-COMP-001` Composition Canon ·
`EC-GRN-001` Greenery Architecture Canon · Placement Engine Spec v1.0 · UI Wireframe v1.0 ·
Sprint 1 Build Ticket

`src/core/canon.js` carries the verbatim text of every rule the engine cites, so the inspector shows
the actual rule rather than a bare reference.
