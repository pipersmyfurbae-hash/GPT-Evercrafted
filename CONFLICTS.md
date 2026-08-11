# Canon / Ticket Conflict Register

Permanent record. This file is architectural memory, not review notes — entries stay after they
are ruled on, so a future sprint can see what was decided and why rather than rediscovering the
ambiguity.

**Status: all ten items ruled on 2026-08-11 by the creative director.**
8 ACCEPTED as implemented · 1 REVISED (C-04) · 1 REVISED (C-07).

| Entry | Status | Ruled | Owning canon |
| --- | --- | --- | --- |
| C-01 Gravity sequencing | **ACCEPTED** (naming refined) | 2026-08-11 | EC-COMP-001 + this register's architectural principle |
| C-02 Hardware clearance object | **ACCEPTED** | 2026-08-11 | Placement Engine Spec v1.0 |
| C-03 Clearance as void | **ACCEPTED** | 2026-08-11 | Placement Engine Spec v1.0 |
| C-04 Sweep width | **REVISED** — provisional reading rejected | 2026-08-11 | EC-GEO-001 (geometry) |
| C-05 Sweep direction | **ACCEPTED** | 2026-08-11 | Placement Engine Spec v1.0 |
| C-06 Persisted omissions | **ACCEPTED** with forward caveat | 2026-08-11 | EC-GEO-001 (silence zones) |
| C-07 Validator tiers | **PARTIALLY REVISED** — tiers kept, thresholds demoted | 2026-08-11 | EC-GEO-001 / EC-CAL (calibration) |
| C-08 Degrees stored, clock displayed | **ACCEPTED** | 2026-08-11 | Placement Engine Spec v1.0 |
| C-09 Lock the sweep too | **ACCEPTED** | 2026-08-11 | Placement Engine Spec v1.0 |
| C-10 Author reason capture | **ACCEPTED** (wording strengthened) | 2026-08-11 | EC-DOS-001 Principle 6 |

Raised by: Sprint 1 implementation pass
Sources compared: `EC-DOS-001`, `EC-COMP-001`, `EC-GRN-001`,
`Evercrafted_Placement_Engine_Spec_v1.0`, `Evercrafted_Placement_Engine_UI_Wireframe_v1.0`,
`Evercrafted_Placement_Engine_Sprint1_Build_Ticket`.

Every entry below is a place where the Sprint 1 build ticket contradicts, under-specifies,
or silently drops something the canon or spec requires. Each carries the resolution that was
implemented, the ruling it received, and the file that owns it now.

---

## C-01 — Composition gravity is sequenced differently in two canon documents

> **ACCEPTED 2026-08-11**, with a naming refinement: the authored field is now
> `gravity_intent`, and the measurement lives in the `geometry_metrics` namespace. See the
> architectural principle at the foot of this file.

**Conflict.** `EC-COMP-001` Construction Sequence establishes composition gravity at **step 4**,
after the anchor (1), visual path (2), and rest points (3). The Placement Engine Spec's Engine
Sequence establishes it at **step 3**, *before* the anchor is reserved (4).

So in the Composition Canon gravity is an **outcome** of placement; in the Placement Engine Spec
it is an **input** to placement. These cannot both drive the data model.

**Why it matters.** It decides whether composition gravity is an authored field the engine
honours, or a computed readout the engine reports.

**Resolution as ruled.** Both, held separately and never silently reconciled — under names that
make it impossible to confuse them:

- **`gravity_intent`** — authored upstream, persisted on the blueprint. A value from the
  `EC-COMP-001` vocabulary (grounded / lifted / outward / inward / stable / expanding / quiet /
  energized), plus a free-text note.
- **`geometry_metrics.composition_gravity`** — *measured* from the placed geometry. Computed on
  demand, never written back to the blueprint, drawn live on the canvas as a gold crosshair.

The engine reports both and reconciles neither. It flags only a direct contradiction (declared
"grounded" while the mass measures lifted, or the reverse); anything else is not evidence either
way, because most of the vocabulary is non-directional — "quiet" and "expanding" have no angle.

**Where it lives.** `gravity_intent` in `src/core/schema.js`; the measurement in
`src/core/analysis.js` → `geometryMetrics()`. The vocabulary is `GRAVITY_INTENTS`.

---

## C-02 — Hardware clearance: anchor property, or first-class object?

> **ACCEPTED 2026-08-11.** First-class object linked to the anchor. It behaves as an anchor
> property in the editor while keeping its own lock, visibility, explanation and identity.

**Conflict.** Four sources, two answers.

| Source | Treats clearance as |
| --- | --- |
| Ticket §2 (Primary Anchor Editor) | a property of the anchor |
| Spec, Anchor Pocket Object | a property of the anchor (`hardware_clearance`) |
| Ticket §5 (Blueprint Data Model) | its own persisted top-level item |
| Spec, Core Blueprint Objects + Engine Sequence step 5 | its own object, reserved in its own step |
| UI Wireframe, left panel | its own layer, with its own show/hide and lock/unlock |

**Why it matters.** A property cannot have its own lock state, its own visibility toggle, or its
own explanation record — but the wireframe and the spec's explainability rule both require all three.

**Provisional resolution.** First-class object (`kind: "clearance"`) with its own id, lock,
visibility, and explanation, **linked to the anchor as its parent** and surfaced inside the anchor's
inspector as a child row. Reads as a property from the anchor editor, behaves as an object
everywhere else.

**Change point.** `src/core/schema.js` → `createClearance()`, and the `link.parent_id` field.

---

## C-03 — "Hardware clearance not obstructed" is unsatisfiable as literally written

> **ACCEPTED 2026-08-11.** The clearance is reserved *inside* the anchor architecture, so it
> subtracts usable anchor volume rather than counting the anchor as an obstruction. Only
> unrelated mass intruding into the reserved volume is obstruction.

**Conflict.** The wireframe places the clearance *inside* the anchor: "Clear space for bow/ribbon
**within anchor zone**." The anchor therefore contains the clearance angularly by construction.
Ticket §8 then requires a validator: "hardware clearance not obstructed."

If the anchor counts as an obstruction, **the canonical default composition fails its own validator
the moment it loads** — the 7–9 anchor necessarily overlaps a clearance placed within it.

**Why it matters.** This is the difference between a validator that is always red and one that
means something.

**Provisional resolution.** The clearance is modelled as a **void carved out of the anchor**, not a
region sitting on top of it. The anchor renders as up to two sub-sectors either side of the
clearance (`subtractArc()` in geometry). The anchor is therefore never an obstruction of the space
it contains.

"Obstructed" is then read literally — *another object's mass is in the reserved volume*:

- **Blocking** (ticket §8): the **sweep** or **echo** intrudes. Intrusion requires overlap in
  **both** angle and depth, so a sweep passing over the clearance at a different radial band is
  correctly not flagged.
- **Advisory** (wireframe-derived, non-blocking): the clearance has drifted outside the anchor arc,
  or has hollowed the anchor out so far that it no longer reads as one dominant mass. These are
  composition judgements rather than obstructions, and a director may want either deliberately —
  so they report without blocking a save.

This makes the default composition valid and the validator load-bearing.

**Change point.** `src/core/validate.js` → `hardwareClearanceUnobstructed` (blocking) and
`clearanceWithinAnchor` (advisory).

---

## C-04 — Sweep "width ≈ 15°" does not name an axis

> **REVISED 2026-08-11. The Sprint 1 interpretation was rejected and has been replaced.**
> Owning canon: EC-GEO-001 (geometry).

**Conflict.** Spec, Primary Sweep: "It is a narrow guiding gesture rather than a continuous heavy
band. Initial visual width target: approximately 15° as a starting test value, adjustable."

Width is a *thickness*; degrees are an *angle*. The two do not compose without a stated radius.

**The rejected reading (schema 1.0.0).** Sprint 1 read the 15° as band thickness measured as
arc-degrees at the ring's mean radius, and converted it with:

```
thickness_in = arc_degrees × mean_radius        // 15° → 2.49 in
```

**Why that was wrong.** That formula computes an **arc length** — a distance measured *tangentially,
along* the ring — and the renderer then used the result as **radial** thickness *across* the ring.
Those are perpendicular axes. The output is in inches, which is why the error looked plausible, but
the quantity being measured was never a thickness. The tell: an arc length scales with radius, so
the "thickness" of a sweep would have changed when the wreath got bigger even though the ring stayed
the same width.

**Resolution as ruled.** Thickness and travel are separate quantities with separate fields, and they
never mix:

| Field | Meaning |
| --- | --- |
| `start_deg` | where the path starts |
| `arc_deg` | how far it travels **around** the form |
| `band_width_norm` | how thick it is **across** the ring, as a fraction of the base band width |
| `curvature` | radial deviation of the centreline |
| `taper` | width reduction along the path |

with

```
band_width_in = band_width_norm × base_band_width_in
```

Normalising the thickness means a gesture keeps its proportion when the form is resized, which is
the behaviour a gesture should have.

The default is `band_width_norm = 0.3` — 1.5 in of a 5 in ring on the 24 in test form. That is a
narrow guiding band, as GRN-B02 requires.

**`taper` was approved and kept.** It is not scope creep: it is the geometric implementation of
GRN-B02's "thin, readable gesture; never a hedge".

**Migration.** Schema bumped to **1.1.0**. Blueprints saved under 1.0.0 replay the old arithmetic
once, in `migrate()`, so they reopen looking exactly as their author left them — 15° becomes
`band_width_norm ≈ 0.497`. The old formula survives only as `legacyWidthDegToInches()`, which is
documented as migration-only and is never called from live geometry.

**Where it lives.** `src/core/geometry.js` → `bandWidthToInches()`; `DEFAULTS.sweep` in
`src/core/schema.js`.


---

## C-05 — Sweep travel direction is a selectable parameter that nothing defines

> **ACCEPTED 2026-08-11.** Degrees clockwise from 12, direction carried by `start_deg` +
> `arc_deg`. The 9 -> 12 -> 1:30 default is clockwise on a clock face and therefore coherent.

**Conflict.** Spec: the sweep "travels upward and around the wreath **in the selected design
direction**." No source says where that selection comes from, what the default is, or what selects
it. Ticket §3 says only "adjustable start/end."

**Provisional resolution.** Direction is carried implicitly by `start_deg` + `arc_deg`, with
clockwise as positive. The canonical default runs **clockwise from the anchor's 9 o'clock leading
edge, up over 12, to ~1:30** (135° of travel).

This is the only reading that satisfies "upward" from a 7–9 anchor: from the left side of the form,
clockwise *is* the upward direction. Counter-clockwise from 7 o'clock would travel down and across
the bottom, which no source describes.

Flagged as **inferred**, not specified.

**Change point.** `src/core/schema.js` → `DEFAULTS.sweep`.

---

## C-06 — Ticket drops three things the spec and wireframe both require

> **ACCEPTED 2026-08-11**, with a forward caveat: deriving negative space read-only is right
> for Sprint 1, but the protected/canonical **silence zones** defined by EC-GEO must later become
> explicit constraint objects rather than merely the complement of occupied arcs. Tracked as
> future work, not a Sprint 1 change.

**Conflict.** Ticket §5 persists: base, anchor, hardware clearance, sweep, echo, object positions,
dimensions, dependencies, explanations, version metadata.

The spec's Core Blueprint Objects list additionally includes **emotional profile**, **composition
gravity**, and **negative-space zones**. The spec's Acceptance Criteria require "Negative space
remains intentional." The wireframe's left panel lists **Negative space** as a layer.

Ticket §9 (Out of Scope) does **not** exclude any of the three — they appear to have been dropped
by omission rather than by decision.

**Provisional resolution.** Split by cost:

- `emotional_profile` and `composition_gravity.declared` — **persisted** as small authored-intent
  fields. They are produced upstream of Sprint 1 in the `EC-DOS-001` pipeline, they cost nothing to
  carry, and dropping them would lose data the pipeline already has.
- Negative space — **derived and read-only.** Computed as the angular complement of the anchor,
  sweep, and echo, drawn as a toggleable overlay with each rest gap labelled in degrees.

No negative-space *editor* was built. This is visualization of the three objects Sprint 1 already
owns, not a fourth editable object type — kept deliberately on the safe side of the scope line.

**Change point.** `src/core/analysis.js` → `restZones()`.

---

## C-07 — The ticket's validator set is narrower than the spec's acceptance criteria

> **PARTIALLY REVISED 2026-08-11.** The tier structure was approved and kept. The invented numeric
> thresholds were **stripped of authority**: a threshold is a calibration value, not an aesthetic
> guess. Owning canon: EC-GEO-001 / EC-CAL.

**Conflict.** Ticket §8 checks that the **echo** is smaller than the anchor. The spec's Acceptance
Criteria require that the **anchor remains visually dominant** — full stop. Nothing in the ticket
stops the *sweep* from out-massing the anchor, which would break `EC-COMP-001` Law 1 (a clear
emotional anchor) while passing every ticketed validator.

**Resolution as ruled — structure kept.** Two tiers:

- **Errors** — exactly the five from Ticket §8. These and only these block.
- **Advisories** — spec-derived, non-blocking, in a separate group.

Nothing new blocks a save that the ticket said should be saveable.

**Resolution as ruled — authority removed from the numbers.** Sprint 1 shipped several invented
thresholds (`echoParityRatio = 0.7`, a `2/π` half-moon concentration, rest-zone minimums, a
sweep-band ceiling). Those were reasonable engineering placeholders, but they were presented as
verdicts. They now carry no authority:

1. Every uncalibrated numeric threshold lives in **`PROVISIONAL_THRESHOLDS`**, under a comment
   stating that none is canon and that EC-GEO-001 / EC-CAL own the replacements. When calibrated
   predicates land, these constants are **deleted, not tuned**.
2. Every validator result carries a **`calibration`** field — `structural` (counting, containment,
   schema, geometric overlap; nothing to calibrate) or `provisional` (rests on an invented
   threshold, or on the uncalibrated visual-presence model). The UI renders a **PROVISIONAL** tag
   on the latter.
3. Results gained a third status, **`metric`** — a number was measured and *no verdict was reached*,
   because no calibrated predicate exists for it.

**The half-moon specifically.** Mass concentration is now a **metric**, not a pass/fail. The engine
reports the measurement and the scale it sits on, and stops. It no longer says a composition is
"resolved" because it falls under 0.637.

`2/π` survives only as `UNIFORM_HALF_ANNULUS_CONCENTRATION`, a published *shape* reference giving
the number a sense of scale — explicitly documented as not a threshold.

**A worked demonstration of why this ruling matters.** The C-04 correction changed the sweep's
default presence, which moved the default composition's concentration from **0.58 to 0.65** — from
one side of the old 0.637 "threshold" to the other. The design did not change. Only a unit
interpretation did. Under the old code the engine would have flipped from "asymmetric but resolved"
to "unresolved half-moon" and told the director a falsehood with full confidence. That is precisely
the failure the calibration discipline exists to prevent.

**Note on the presence model itself.** `presenceOf()` — arc × depth × weight — is also an
uncalibrated engineering model, not a measure of perceived visual weight. Every comparison built on
it inherits `provisional`, including the ticket-required `echo_smaller_than_anchor`, which still
blocks because the ticket requires it but is tagged so its basis is visible.

### Refinement, ruled 2026-08-11 — two independent axes

A result has **two kinds of authority**, and collapsing them into one field made a legitimate
combination look like a contradiction.

| Axis | Field | Values |
| --- | --- | --- |
| **Enforcement authority** — what a failure costs | `enforcement` | `blocking` · `advisory` · `metric` |
| **Measurement confidence** — how far the basis can be trusted | `confidence` | `structural` · `provisional` · `calibrated` |

They vary independently. `echo_smaller_than_anchor` is legitimately **blocking + provisional**: it
blocks because the Sprint 1 contract explicitly requires the comparison, *not* because
`presenceOf()` has been shown to be perceptually correct.

Every result therefore also carries **`enforcement_reason`** — a sentence saying why it holds the
authority it holds. So the question "if it is provisional, why does it block?" is answered by the
model rather than by whoever remembers the conversation. Nothing carries `calibrated` yet; that
value exists so EC-GEO-001 / EC-CAL have somewhere to land.

**Where it lives.** `src/core/validate.js` → `ENFORCEMENT`, `CONFIDENCE`,
`PROVISIONAL_THRESHOLDS`, `UNIFORM_HALF_ANNULUS_CONCENTRATION`, and the `enforcement`,
`confidence` and `enforcement_reason` fields on every result.


---

## C-08 — Spec property names mix clock notation and degrees across sibling objects

> **ACCEPTED 2026-08-11.** Persist degrees only. Clock notation is UI.

**Conflict.** Pocket objects in the spec use `clock_start` / `clock_end` / `clock_center`. Behavior
Path objects use `start_angle` / `end_angle`. Same circle, two unit systems, no stated conversion.

Storing both representations of the same value in a persisted blueprint invites drift — the two
disagree after any rounding, and nothing says which wins.

**Provisional resolution.** **Degrees are the only stored unit** (`start_deg`, `arc_deg`,
`center_deg`), clockwise-positive from 12 o'clock. Clock notation is a presentation and input
format only: the inspector displays `7:00` and accepts `7:00` typed back, converting at the edge.

This is a deliberate deviation from the spec's literal property names, taken to keep one source of
truth per value. If the ruling is that persisted files must carry `clock_*` keys, they can be
emitted at the serialization boundary without touching the model.

**Change point.** `src/core/geometry.js` → `clockToDeg()` / `formatClock()`;
`src/io/persistence.js` if literal spec key names become a requirement.

---

## C-09 — Lock/unlock is granted to the anchor and echo but not the sweep

> **ACCEPTED 2026-08-11.** All reflowable components need lock semantics, the sweep most of all.

**Conflict.** Ticket §2 and §4 both list lock/unlock. Ticket §3 (Primary Sweep) does not.

But the wireframe states every layer can be "shown/hidden and locked/unlocked," and the spec's
Interaction Rules say "A user may lock a component to prevent automatic reflow" — which matters
*most* for the sweep, because the sweep is the object that reflows when the anchor moves. A sweep
that cannot be locked is the one object whose lock the spec's own sentence is about.

**Provisional resolution.** All four objects lockable. Locking freezes an object at its current
absolute angles; unlocking re-derives its offset from where it currently sits, so nothing jumps on
either transition.

**Change point.** `src/core/analysis.js` → `applyLinks()`.

---

## C-10 — "Why I changed this" capture is required by the spec, absent from the ticket

> **ACCEPTED 2026-08-11.** `author_note` stays separate from the engine explanation. That
> distinction feeds the learning loop without converting every tweak into doctrine.

**Conflict.** Spec, Interaction Rules: "Manual changes should be captured with an optional 'why I
changed this' field for the learning system." `EC-DOS-001` Core Principle 6: "A human edit is not
automatically a new rule. The system must capture why the edit improved the design before the canon
changes." Ticket §6 asks only for "explanation"; Ticket §5 persists "explanations."

Without the capture field, the learning loop in `EC-DOS-001` has no input from Sprint 1 — the
signal the canon calls valuable ("*why* the move improved balance, hierarchy, breathing room") is
never recorded.

**Provisional resolution.** Every object carries an optional `author_note`. Engine explanations
regenerate live from current state so they never go stale; if an author overwrites one it is marked
**authored** rather than canon-derived, so a human edit is visibly not a canon change.

**Change point.** `src/core/explain.js` → `explainObject()` and the `explanation.source` field.

---

## Checked and found consistent

Recorded so these are not re-litigated later:

- **Echo at 5 o'clock against an anchor at 7–9 is 90° of separation, not 180°.** Consistent with
  the spec's "Repetition should function as an echo, not a mirror." A naive reading would put the
  echo opposite the anchor; the spec's number is deliberate and was kept.
- **"Exactly one primary anchor"** (spec) and "one primary anchor" (ticket §8) agree. The objects
  collection is modelled as an **array** rather than fixed named slots specifically so this
  validator can fail — and so the ticket's Developer Note ("the architecture must remain flexible
  enough for later composition formulas") is structurally honoured rather than just intended.
- **Ticket §9 Out of Scope** is fully respected: no inventory matching, no species selection, no
  production rendering, no marketplace, no memory parsing, no canon learning, no multi-anchor
  formulas. The echo's focal-repeat field is a free-text placeholder wired to nothing, exactly as
  Ticket §4 specifies.

---

## Architectural principle — intent and measurement never share a field

Ruled 2026-08-11, generalised from C-01.

An authored concept and a measured number are **not two versions of the same truth**, and a data
model that stores them as two keys on one object quietly asserts that they are. So:

| Authored intent (persisted) | Measured geometry (computed, never stored) |
| --- | --- |
| `gravity_intent` | `geometry_metrics.composition_gravity` |
| `balance_intent` | measured balance |
| `density_intent` | measured occupancy |
| `movement_intent` | measured behaviour paths |

Not `x.declared` / `x.computed`. Different names, different homes, different lifetimes: intent is
written by a person and saved; measurement is derived on demand and thrown away.

Two consequences the engine now enforces:

- Nothing under `geometry_metrics` is ever written back onto a blueprint. A saved file contains
  intent and geometry, never conclusions about them.
- The schema **rejects** a resurrected `composition_gravity` field, so the old shared-field shape
  cannot creep back in through a hand-edited file.

## Defaults are allowed to be provisional

Ruled 2026-08-11.

A default is a starting value a designer immediately edits. It is not a rule anything is measured
against, so it may be provisional without becoming a validator. But it must not be mistaken for
canon, so `src/core/schema.js` records **`DEFAULT_PROVENANCE`**: which default numbers came from the
spec, and which were engineering choices made to let the sprint's test composition read well.

`band_width_norm: 0.30` is the clearest case. The *geometry* it now expresses is correct — radial
thickness, per C-04. The number 0.30 itself has not been earned, and nothing validates against it.

## Forward work this register hands on

- **C-06 caveat.** Negative space is derived read-only, which is right for Sprint 1. EC-GEO's
  protected/canonical **silence zones** must later become explicit constraint objects, not merely
  the complement of occupied arcs.
- **C-07 caveat.** Every `PROVISIONAL_THRESHOLDS` entry is awaiting a calibrated predicate from
  EC-GEO-001 / EC-CAL. They are placeholders with an expiry date, not settled values. When a
  calibrated predicate arrives, the result's `confidence` moves to `calibrated` and the placeholder
  constant is deleted rather than tuned.
- **Provisional defaults.** `DEFAULT_PROVENANCE` marks which starting values are engineering
  choices. EC-GEO/EC-CAL may supply calibrated starting values; until then they stay as defaults and
  never become validators.

## Sprint 1 status

**ACCEPTED as the Sprint 1 baseline, 2026-08-11.** Schema 1.1.0 accepted. `band_width_norm` kept.
`taper` kept. Intent/measurement separation is a canonical architectural principle. Provisional
thresholds survive only as visibly provisional diagnostics. `presenceOf()` is a provisional
measurement basis: permitted to support ticket-mandated blocking checks, not permitted to make
perceptual truth claims.

The next engineering work comes from **EC-GEO-001 / EC-CAL**, not from further invention inside
Sprint 1 — so the canvas waits for measured rules rather than quietly growing a second canon inside
its own source.
