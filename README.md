# Evercrafted Placement Engine — Sprint 1

**Composition Canvas Foundation.** An interactive wreath blueprint canvas where a creator can
define, edit, save, and reload the first Evercrafted placement skeleton.

> Architecture before decoration. Blueprint before render. Explainability over magic.

---

## Run it

```bash
npm start          # serves at http://127.0.0.1:4173
npm test           # 101 tests, zero dependencies
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

**[`CONFLICTS.md`](./CONFLICTS.md)** — ten places where the Sprint 1 build ticket contradicted,
under-specified, or silently dropped something the canon or spec requires. **All ten were ruled on
2026-08-11**: eight accepted as implemented, two revised. The file is permanent architectural
memory — entries stay after they are ruled, so a later sprint sees the decision rather than
rediscovering the ambiguity.

The two revisions changed the model:

| | Conflict | Ruling |
|---|---|---|
| C-04 | The sweep's "≈15°" width names no axis | **REVISED.** The Sprint 1 reading converted an arc length *along* the ring and used it as thickness *across* it — perpendicular axes. Replaced by `band_width_norm`, a true radial thickness. |
| C-07 | The ticket's validators are narrower than the spec's acceptance criteria | **PARTIALLY REVISED.** Tiers kept; the invented numeric thresholds lost their authority. A threshold is a calibration value, not an aesthetic guess. |

And one principle generalised out of C-01:

> **Intent and measurement never share a field.** Authored intent is persisted (`gravity_intent`);
> measured geometry is computed on demand under `geometry_metrics` and never written back. Not
> `x.declared` / `x.computed` — different names, different homes, different lifetimes.

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

| Object | Position | Band / arc | Presence |
|---|---|---|---|
| Primary anchor | 7:00 → 9:00 | 60° arc | 60.0 |
| Hardware clearance | centred 8:00 | 22° arc | reserved void |
| Primary sweep | 9:00 → 1:30 | 135° travel, 1.5 in thick | 18.8 |
| Secondary echo | 5:00 | 34° arc | 10.7 |

131° of the form is left as rest, in two zones of 88° and 43°. Mass concentration measures **0.65**
— reported as a measurement, not a verdict. No calibrated threshold for "resolved" exists yet, and
the engine does not pretend otherwise.

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

**Every result declares its own basis.** A `calibration` field marks each one `structural`
(counting, containment, schema, geometric overlap — nothing to calibrate) or `provisional` (rests on
an invented threshold, or on the uncalibrated visual-presence model). Provisional results are
visibly tagged in the UI. A third status, `metric`, reports a measured number with *no verdict*,
because no calibrated predicate exists for it — mass concentration is the current example.

Every uncalibrated number lives in `PROVISIONAL_THRESHOLDS`. When EC-GEO-001 / EC-CAL supply
calibrated predicates, those constants get deleted, not tuned.

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
