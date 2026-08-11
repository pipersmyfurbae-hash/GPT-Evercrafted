# Sprint 1 — Canon / Ticket Conflict Register

Status: open — awaiting creative-director ruling
Raised by: Sprint 1 implementation pass
Sources compared: `EC-DOS-001`, `EC-COMP-001`, `EC-GRN-001`,
`Evercrafted_Placement_Engine_Spec_v1.0`, `Evercrafted_Placement_Engine_UI_Wireframe_v1.0`,
`Evercrafted_Placement_Engine_Sprint1_Build_Ticket`.

Every entry below is a place where the Sprint 1 build ticket contradicts, under-specifies,
or silently drops something the canon or spec requires. Each one has a **provisional
resolution** that was implemented so the sprint could ship, chosen wherever possible to
satisfy *both* readings rather than pick a winner — per `EC-DOS-001` Core Principle 4,
"Preserve optionality as long as possible."

None of these resolutions are canon. Each names the exact file and constant to change if
the ruling goes the other way.

---

## C-01 — Composition gravity is sequenced differently in two canon documents

**Conflict.** `EC-COMP-001` Construction Sequence establishes composition gravity at **step 4**,
after the anchor (1), visual path (2), and rest points (3). The Placement Engine Spec's Engine
Sequence establishes it at **step 3**, *before* the anchor is reserved (4).

So in the Composition Canon gravity is an **outcome** of placement; in the Placement Engine Spec
it is an **input** to placement. These cannot both drive the data model.

**Why it matters.** It decides whether composition gravity is an authored field the engine
honours, or a computed readout the engine reports.

**Provisional resolution.** Both, held separately and never silently reconciled:

- `composition_gravity.declared` — an authored intent value from the `EC-COMP-001` vocabulary
  (grounded / lifted / outward / inward / stable / expanding / quiet / energized).
- A **computed** gravity vector — the presence-weighted centroid of the placed objects, drawn
  live on the canvas as a gold crosshair.

Sprint 1 does not enforce one against the other. The blueprint inspector shows both, and notes
when the computed direction disagrees with the declared intent. Whichever way the ruling goes,
one of the two becomes authoritative and the other becomes advisory — no data is lost either way.

**Change point.** `src/core/analysis.js` → `compositionGravity()`; declared vocabulary in
`src/core/schema.js` → `GRAVITY_MODES`.

---

## C-02 — Hardware clearance: anchor property, or first-class object?

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

**Conflict.** Spec, Primary Sweep: "It is a narrow guiding gesture rather than a continuous heavy
band. Initial visual width target: approximately 15° as a starting test value, adjustable."

Width is a *thickness*; degrees are an *angle*. The two do not compose without a stated radius.

It cannot mean arc **length**, because that contradicts the same paragraph ("travels upward and
around the wreath") and `EC-GRN-001` GRN-B02 ("Long directional movement following the circular
form"). A 15°-long sweep is not a sweep.

**Provisional resolution.** `width_deg` is read as **band thickness measured as arc-degrees at the
ring's mean radius**, converted to inches for display:

```
thickness_in = (width_deg × π / 180) × mean_radius_in
```

On the default 24" form with a 5" ring (mean radius 9.5"), 15° ≈ **2.49"** of band. That is a
credible narrow guiding gesture on a 24" wreath, which is the reading that makes the spec's number
land somewhere sensible. The inspector shows **both units** and links back to this entry, so the
interpretation is visible to the person using the tool rather than buried in code.

**Change point.** `src/core/geometry.js` → `widthDegToInches()`. Single function, single formula.

---

## C-05 — Sweep travel direction is a selectable parameter that nothing defines

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

**Conflict.** Ticket §8 checks that the **echo** is smaller than the anchor. The spec's Acceptance
Criteria require that the **anchor remains visually dominant** — full stop. Nothing in the ticket
stops the *sweep* from out-massing the anchor, which would break `EC-COMP-001` Law 1 (a clear
emotional anchor) while passing every ticketed validator.

The spec also requires "Behavior paths do not create contradictory motion," "Negative space remains
intentional," and warns in the Balance Rule against an unresolved "half-moon" effect. None of these
appear in Ticket §8.

**Provisional resolution.** Two visually distinct validator tiers:

- **Errors** — exactly the five from Ticket §8. These and only these block.
- **Advisories** — spec-derived, non-blocking, in a separate group: anchor dominance vs. *all*
  other objects, echo-approaching-parity, half-moon concentration, rest-zone presence, and
  sweep-is-a-gesture-not-a-hedge (GRN-B02).

Nothing new blocks a save that the ticket said should be saveable.

**Half-moon threshold derivation.** Concentration is `|Σ presence·û| / Σ presence`, which is 0 for
radially balanced weight and 1 for a single point mass. A uniform half-annulus — a literal half-moon
— evaluates to 2/π ≈ **0.637**, so that is the advisory threshold. The canonical default composition
sits at **0.58**: asymmetric, as intended, but resolved. Not arbitrary.

**Change point.** `src/core/validate.js` → `ADVISORY_THRESHOLDS`.

---

## C-08 — Spec property names mix clock notation and degrees across sibling objects

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
