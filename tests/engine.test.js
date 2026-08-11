import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createBlueprint,
  getAnchor,
  getClearance,
  getEcho,
  getSweep,
  objectCenter,
  objectRange,
  validateSchema,
  baseRadii,
} from '../src/core/schema.js';
import {
  anchorSegments,
  applyLinks,
  bandWidthInches,
  compositionGravity,
  dependentsOf,
  geometryMetrics,
  presenceOf,
  restZones,
} from '../src/core/analysis.js';
import { explainObject, shortReason } from '../src/core/explain.js';
import {
  validateBlueprint,
  PROVISIONAL_THRESHOLDS,
  UNIFORM_HALF_ANNULUS_CONCENTRATION,
} from '../src/core/validate.js';
import {
  hydrate,
  setAnchorArc,
  setArcWidth,
  setAuthorNote,
  setExplanationOverride,
  setLinkedPosition,
  setLocked,
  updateProperty,
  commitRevision,
  setBaseProperty,
} from '../src/core/actions.js';

const close = (a, b, tol = 1e-3) =>
  assert.ok(Math.abs(a - b) < tol, `expected ${a} to be within ${tol} of ${b}`);

const fresh = () => createBlueprint({ id: 'bp-test', now: '2026-01-01T00:00:00.000Z' });

/* ================================================================== *
 * The canonical Sprint 1 test composition
 * ================================================================== */

test('default blueprint is the 24-inch 7-9 / sweep / 5 o clock composition', () => {
  const bp = fresh();
  assert.equal(bp.base.diameter_in, 24);

  const anchor = getAnchor(bp);
  close(anchor.start_deg, 210); // 7:00
  close(anchor.arc_deg, 60); // through to 9:00
  close(objectCenter(anchor), 240); // 8:00

  const sweep = getSweep(bp);
  close(sweep.start_deg, 270); // leaves the anchor's 9:00 leading edge
  close(sweep.arc_deg, 135); // clockwise, up over 12, to 1:30

  const echo = getEcho(bp);
  close(objectCenter(echo), 150); // 5:00

  const clearance = getClearance(bp);
  close(objectCenter(clearance), 240); // centred in the anchor
});

test('default blueprint passes its own schema', () => {
  const { ok, errors } = validateSchema(fresh());
  assert.deepEqual(errors, []);
  assert.ok(ok);
});

test('base radii derive correctly for the default form', () => {
  const { rInner, rOuter, rMean, ringWidth } = baseRadii(fresh().base);
  close(rOuter, 12);
  close(rInner, 7);
  close(rMean, 9.5);
  close(ringWidth, 5);
});

/* ================================================================== *
 * Presence, gravity, rest
 * ================================================================== */

test('anchor is the heaviest element in the default composition', () => {
  const bp = fresh();
  const anchorPresence = presenceOf(getAnchor(bp));
  const sweepPresence = presenceOf(getSweep(bp));
  const echoPresence = presenceOf(getEcho(bp));

  close(anchorPresence, 60);
  // 135 deg travel x 0.30 band x 0.775 average taper x 0.6 strength
  close(sweepPresence, 18.833, 0.01);
  close(echoPresence, 10.71);

  assert.ok(anchorPresence > sweepPresence);
  assert.ok(sweepPresence > echoPresence);
});

test('the clearance is a void and carries no visual weight', () => {
  const bp = fresh();
  assert.equal(presenceOf(getClearance(bp)), 0);
});

test('composition gravity measures concentration and direction', () => {
  const bp = fresh();
  const gravity = compositionGravity(bp);

  close(gravity.total, 89.543, 0.01);
  close(gravity.concentration, 0.6488, 0.001);
  // Weight pulled toward the worked left side of the form.
  assert.ok(gravity.deg > 225 && gravity.deg < 290, `gravity at ${gravity.deg}`);
});

test('concentration is bounded by its own definition', () => {
  // 0 = weight spread evenly, 1 = all weight at one point. The uniform
  // half-annulus reference sits between them. It is a shape comparison, not a
  // pass mark — see CONFLICTS.md C-07 (REVISED).
  assert.ok(UNIFORM_HALF_ANNULUS_CONCENTRATION > 0 && UNIFORM_HALF_ANNULUS_CONCENTRATION < 1);
  close(UNIFORM_HALF_ANNULUS_CONCENTRATION, 0.6366, 0.001);

  let bp = fresh();
  bp = updateProperty(bp, 'echo-1', 'visual_weight', 0);
  bp = updateProperty(bp, 'sweep-1', 'arc_deg', 30);
  bp = updateProperty(bp, 'anchor-1', 'arc_deg', 150);
  const concentrated = compositionGravity(bp).concentration;

  assert.ok(concentrated > 0.9, `expected near-total concentration, got ${concentrated}`);
  assert.ok(concentrated <= 1.0001);
});

test('geometry metrics namespace keeps measurement out of the blueprint', () => {
  const bp = fresh();
  const metrics = geometryMetrics(bp);

  assert.equal(metrics.calibration, 'provisional');
  assert.ok(metrics.composition_gravity.concentration > 0);
  close(metrics.rest.total_deg, 131);
  assert.equal(Object.keys(metrics.presence).length, 4);

  // Nothing measured is ever written onto the blueprint.
  assert.equal(bp.geometry_metrics, undefined);
  assert.equal(bp.gravity_intent.value, 'grounded');
  assert.equal('composition_gravity' in bp, false);
});

test('sweep band width is a radial thickness independent of travel', () => {
  const bp = fresh();
  const sweep = getSweep(bp);

  close(sweep.band_width_norm, 0.3);
  close(bandWidthInches(sweep, bp.base), 1.5); // 30% of the 5 in ring

  // Changing how far it travels must not change how thick it is.
  const longer = updateProperty(bp, 'sweep-1', 'arc_deg', 300);
  close(bandWidthInches(getSweep(longer), longer.base), 1.5);
});

test('rest zones are the angular complement of the placed mass', () => {
  const zones = restZones(fresh());
  const total = zones.reduce((sum, z) => sum + z.span, 0);
  close(total, 131);
  assert.equal(zones.length, 2);
});

test('the anchor renders as two sub-sectors around the hardware clearance', () => {
  const segments = anchorSegments(fresh());
  assert.equal(segments.length, 2);
  close(segments[0].span, 19);
  close(segments[1].span, 19);
  // 60 degrees of anchor minus 22 degrees of bow clearance.
  close(segments[0].span + segments[1].span, 38);
});

/* ================================================================== *
 * Dependency reflow — the spec's interaction rule
 * ================================================================== */

test('moving the anchor drags the sweep, echo and clearance with it', () => {
  const before = fresh();
  const after = setAnchorArc(before, 'anchor-1', { startDeg: 240 }); // 7:00 -> 8:00

  close(getSweep(after).start_deg, 300); // leading edge follows
  close(objectCenter(getEcho(after)), 180); // still 90 degrees off the anchor centre
  close(objectCenter(getClearance(after)), 270); // still centred in the anchor

  // The original is untouched: actions are pure.
  close(getSweep(before).start_deg, 270);
});

test('widening the anchor pushes the sweep origin without moving the echo relationship', () => {
  const after = setAnchorArc(fresh(), 'anchor-1', { arcDeg: 90 });
  close(getSweep(after).start_deg, 300); // 210 + 90
  // Echo tracks the anchor CENTRE, which moved from 240 to 255.
  close(objectCenter(getEcho(after)), 165);
});

test('a locked object does not reflow when the anchor moves', () => {
  let bp = setLocked(fresh(), 'sweep-1', true);
  const startBefore = getSweep(bp).start_deg;

  bp = setAnchorArc(bp, 'anchor-1', { startDeg: 300 });

  close(getSweep(bp).start_deg, startBefore);
  // Anchor centre moved to 330; the unlocked echo still holds its -90 offset.
  close(objectCenter(getEcho(bp)), 240);
});

test('unlocking re-derives the offset so nothing jumps', () => {
  let bp = setLocked(fresh(), 'echo-1', true);
  bp = setAnchorArc(bp, 'anchor-1', { startDeg: 300 }); // echo stays at 150
  close(objectCenter(getEcho(bp)), 150);

  bp = setLocked(bp, 'echo-1', false);
  // Still at 150 after unlocking, but now expressed against the new anchor
  // centre of 330. signedDelta returns the half-turn as +180.
  close(objectCenter(getEcho(bp)), 150);
  close(getEcho(bp).link.offset_deg, 180);

  // And it follows again from here.
  bp = setAnchorArc(bp, 'anchor-1', { startDeg: 330 });
  close(objectCenter(getEcho(bp)), 180);
});

test('dragging a linked object re-expresses the link instead of breaking it', () => {
  let bp = setLinkedPosition(fresh(), 'echo-1', 120);
  close(objectCenter(getEcho(bp)), 120);
  close(getEcho(bp).link.offset_deg, -120);

  bp = setAnchorArc(bp, 'anchor-1', { startDeg: 240 });
  close(objectCenter(getEcho(bp)), 150); // new anchor centre 270, minus 120
});

test('a locked object rejects direct drags too', () => {
  const bp = setLocked(fresh(), 'echo-1', true);
  const after = setLinkedPosition(bp, 'echo-1', 20);
  assert.equal(after, bp, 'locked object should be returned unchanged');
});

test('dependentsOf reports what moves when the anchor moves', () => {
  const ids = dependentsOf(fresh(), 'anchor-1').map((o) => o.id).sort();
  assert.deepEqual(ids, ['clearance-1', 'echo-1', 'sweep-1']);
});

test('applyLinks is idempotent', () => {
  const bp = fresh();
  const once = structuredClone(bp);
  applyLinks(once);
  const twice = structuredClone(once);
  applyLinks(twice);
  assert.deepEqual(once, twice);
});

/* ================================================================== *
 * Property editing
 * ================================================================== */

test('property edits clamp to their declared bounds', () => {
  let bp = updateProperty(fresh(), 'echo-1', 'visual_weight', 5);
  close(getEcho(bp).visual_weight, 1);

  bp = updateProperty(bp, 'echo-1', 'visual_weight', -3);
  close(getEcho(bp).visual_weight, 0);

  bp = updateProperty(bp, 'sweep-1', 'arc_deg', 9999);
  close(getSweep(bp).arc_deg, 330);

  bp = updateProperty(bp, 'sweep-1', 'band_width_norm', 4);
  close(getSweep(bp).band_width_norm, 1);
});

test('non-numeric and unknown-option edits are rejected outright', () => {
  const bp = fresh();
  assert.equal(updateProperty(bp, 'echo-1', 'visual_weight', 'heavy'), bp);
  assert.equal(updateProperty(bp, 'sweep-1', 'behavior_type', 'wafting'), bp);
  assert.equal(updateProperty(bp, 'no-such-object', 'arc_deg', 20), bp);
});

test('a valid behaviour type is accepted and re-cites the canon', () => {
  const bp = updateProperty(fresh(), 'sweep-1', 'behavior_type', 'arching');
  assert.equal(getSweep(bp).behavior_type, 'arching');
  const ids = explainObject(bp, getSweep(bp)).canonRules.map((r) => r.id);
  assert.ok(ids.includes('GRN.B03'), 'explanation should cite the arching behaviour rule');
});

test('editing a nested link offset moves the object', () => {
  const bp = updateProperty(fresh(), 'echo-1', 'link.offset_deg', -60);
  close(objectCenter(getEcho(bp)), 180);
});

test('changing the base keeps the ring inside the form', () => {
  const bp = setBaseProperty(fresh(), 'diameter_in', 10);
  assert.ok(bp.base.ring_width_in <= bp.base.diameter_in / 2 - 0.5);
  assert.ok(validateSchema(bp).ok);
});

/* ================================================================== *
 * Explainability
 * ================================================================== */

test('every object answers the spec five questions with canon citations', () => {
  const bp = fresh();
  for (const obj of bp.objects) {
    const explanation = explainObject(bp, obj);
    assert.ok(explanation.what.trim(), `${obj.id} has no "what"`);
    assert.ok(explanation.role.trim(), `${obj.id} has no "role"`);
    assert.ok(explanation.why.trim(), `${obj.id} has no "why"`);
    assert.ok(explanation.canonRules.length > 0, `${obj.id} cites no canon rule`);
    assert.ok(explanation.canonRules.every((r) => r.text), `${obj.id} has an unresolved rule`);
    assert.ok(Array.isArray(explanation.dependents));
  }
});

test('explanations track the geometry rather than going stale', () => {
  const bp = fresh();
  assert.match(explainObject(bp, getAnchor(bp)).why, /7:00 to 9:00/);

  const moved = setAnchorArc(bp, 'anchor-1', { startDeg: 0, arcDeg: 60 });
  const why = explainObject(moved, getAnchor(moved)).why;
  assert.match(why, /12:00 to 2:00/);
  assert.match(why, /upper right/); // centre 30 degrees
});

test('the anchor explanation names the dependents that follow it', () => {
  const bp = fresh();
  const labels = explainObject(bp, getAnchor(bp)).dependents.map((d) => d.id).sort();
  assert.deepEqual(labels, ['clearance-1', 'echo-1', 'sweep-1']);
});

test('an authored override replaces the shown reason but keeps the engine reasoning', () => {
  const bp = setExplanationOverride(fresh(), 'echo-1', 'Client asked for the weight lower.');
  const explanation = explainObject(bp, getEcho(bp));

  assert.equal(explanation.source, 'authored');
  assert.equal(explanation.why, 'Client asked for the weight lower.');
  assert.match(explanation.engineWhy, /counterweights/);

  const cleared = setExplanationOverride(bp, 'echo-1', '   ');
  assert.equal(explainObject(cleared, getEcho(cleared)).source, 'engine');
});

test('author notes are captured for the learning loop', () => {
  const bp = setAuthorNote(fresh(), 'sweep-1', 'Widened it — the gesture was disappearing at 2 ft.');
  assert.match(explainObject(bp, getSweep(bp)).authorNote, /disappearing/);
});

test('shortReason produces a one-line summary for every object', () => {
  const bp = fresh();
  for (const obj of bp.objects) {
    assert.ok(shortReason(bp, obj).length > 10);
  }
});

/* ================================================================== *
 * Validation
 * ================================================================== */

test('the default composition passes every blocking validator and every advisory', () => {
  const report = validateBlueprint(fresh());
  const failures = report.results.filter((r) => r.status === 'fail');
  assert.deepEqual(failures.map((f) => `${f.level}:${f.id} — ${f.detail}`), []);
  assert.ok(report.ok);
  assert.equal(report.counts.errors, 0);
  assert.equal(report.counts.advisories, 0);
});

test('every validator result carries a canon citation and readable detail', () => {
  for (const result of validateBlueprint(fresh()).results) {
    assert.ok(result.canon.length > 0, `${result.id} cites no canon`);
    assert.ok(result.detail.length > 20, `${result.id} has a thin detail line`);
    assert.ok(['error', 'advisory'].includes(result.level));
  }
});

test('ticket §8 blocking validators are exactly the five specified', () => {
  const ids = validateBlueprint(fresh()).errors.map((r) => r.id).sort();
  assert.deepEqual(ids, [
    'echo_smaller_than_anchor',
    'explanations_present',
    'hardware_clearance_unobstructed',
    'schema_valid',
    'single_primary_anchor',
  ]);
});

test('a second primary anchor is a blocking error', () => {
  const bp = fresh();
  bp.objects.push({ ...getAnchor(bp), id: 'anchor-2' });
  const report = validateBlueprint(bp);
  assert.ok(!report.ok);
  const result = report.errors.find((r) => r.id === 'single_primary_anchor');
  assert.equal(result.status, 'fail');
  assert.match(result.detail, /2 primary anchors/);
});

test('an echo that outweighs the anchor is a blocking error', () => {
  const bp = updateProperty(fresh(), 'echo-1', 'visual_weight', 1);
  const heavier = updateProperty(bp, 'echo-1', 'arc_deg', 120);
  const report = validateBlueprint(heavier);

  assert.ok(!report.ok);
  assert.equal(report.errors.find((r) => r.id === 'echo_smaller_than_anchor').status, 'fail');
});

test('an echo approaching parity trips the advisory before the error', () => {
  // presence 34 * 0.7 * w vs anchor 60 -> w = 0.8 gives ~32%, w must go high to rival.
  const bp = updateProperty(updateProperty(fresh(), 'echo-1', 'arc_deg', 90), 'echo-1', 'visual_weight', 0.85);
  const report = validateBlueprint(bp);
  const result = report.advisories.find((r) => r.id === 'echo_not_rivalling');

  assert.ok(report.ok, 'should still be saveable');
  assert.equal(result.status, 'fail');
  assert.equal(result.calibration, 'provisional');
  assert.match(result.detail, /placeholder/);
});

test('a sweep heavier than the anchor trips the dominance advisory the ticket would miss', () => {
  let bp = updateProperty(fresh(), 'sweep-1', 'band_width_norm', 1);
  bp = updateProperty(bp, 'sweep-1', 'strength', 1);
  bp = updateProperty(bp, 'sweep-1', 'arc_deg', 300);

  const report = validateBlueprint(bp);
  assert.equal(report.advisories.find((r) => r.id === 'anchor_dominant').status, 'fail');
  // The ticket's own echo-only check still passes, which is the point.
  assert.equal(report.errors.find((r) => r.id === 'echo_smaller_than_anchor').status, 'pass');
});

test('the echo obstructing the clearance is a blocking error', () => {
  // Drive the echo on top of the clearance at 8 o'clock.
  const bp = setLinkedPosition(fresh(), 'echo-1', 240);
  const report = validateBlueprint(bp);

  assert.ok(!report.ok);
  const result = report.errors.find((r) => r.id === 'hardware_clearance_unobstructed');
  assert.equal(result.status, 'fail');
  assert.match(result.detail, /Secondary echo/);
});

test('the anchor itself never counts as obstructing its own clearance', () => {
  // Widening the anchor keeps the clearance inside it and must stay valid.
  const bp = setAnchorArc(fresh(), 'anchor-1', { arcDeg: 120 });
  const result = validateBlueprint(bp).errors.find((r) => r.id === 'hardware_clearance_unobstructed');
  assert.equal(result.status, 'pass');
});

test('a sweep crossing the clearance at a different depth is not an obstruction', () => {
  let bp = fresh();
  // Push the clearance to the outer edge and the sweep hard to the inner edge.
  bp = updateProperty(bp, 'clearance-1', 'radial_position', 1);
  bp = updateProperty(bp, 'clearance-1', 'radial_extent', 0.25);
  bp = updateProperty(bp, 'sweep-1', 'radial_position', 0);
  bp = updateProperty(bp, 'sweep-1', 'band_width_norm', 0.08);
  bp = updateProperty(bp, 'sweep-1', 'curvature', 0);
  // Make the sweep travel across the clearance angle.
  bp = setLocked(bp, 'sweep-1', true);
  bp.objects.find((o) => o.id === 'sweep-1').start_deg = 200;

  const result = validateBlueprint(bp).errors.find((r) => r.id === 'hardware_clearance_unobstructed');
  assert.equal(result.status, 'pass', result.detail);
});

test('a clearance dragged out of the anchor is an advisory, not a blocker', () => {
  // Offset -60 puts the clearance at 6 o'clock: outside the 7-9 anchor, but in
  // open space that neither the sweep nor the echo reaches.
  const bp = updateProperty(fresh(), 'clearance-1', 'link.offset_deg', -60);
  const report = validateBlueprint(bp);

  assert.ok(report.ok, 'should still save');
  assert.equal(report.errors.find((r) => r.id === 'hardware_clearance_unobstructed').status, 'pass');
  assert.equal(report.advisories.find((r) => r.id === 'clearance_within_anchor').status, 'fail');
});

test('a clearance dragged under the sweep IS a blocking obstruction', () => {
  // Offset +60 puts it at 10 o'clock, directly under the sweep's path.
  const bp = updateProperty(fresh(), 'clearance-1', 'link.offset_deg', 60);
  const report = validateBlueprint(bp);

  assert.ok(!report.ok);
  const result = report.errors.find((r) => r.id === 'hardware_clearance_unobstructed');
  assert.equal(result.status, 'fail');
  assert.match(result.detail, /Primary sweep/);
});

test('a clearance that hollows out the anchor is flagged', () => {
  const bp = updateProperty(fresh(), 'clearance-1', 'arc_deg', 50);
  const result = validateBlueprint(bp).advisories.find((r) => r.id === 'clearance_within_anchor');
  assert.equal(result.status, 'fail');
  assert.match(result.detail, /hollow|two small clusters/i);
});

test('a fattened sweep trips the hedge advisory from GRN-B02', () => {
  const bp = updateProperty(fresh(), 'sweep-1', 'band_width_norm', 0.8);
  const result = validateBlueprint(bp).advisories.find((r) => r.id === 'sweep_is_gesture');
  assert.equal(result.status, 'fail');
  assert.match(result.detail, /gesture, never a hedge/);
  assert.equal(result.calibration, 'provisional');
});

test('a composition with no breathing room is flagged', () => {
  const bp = updateProperty(fresh(), 'sweep-1', 'arc_deg', 300);
  const result = validateBlueprint(bp).advisories.find((r) => r.id === 'rest_zones_present');
  assert.equal(result.status, 'fail');
});

test('a missing explanation is caught', () => {
  const bp = fresh();
  bp.objects.push({
    id: 'mystery-1',
    kind: 'pocket',
    role: 'unexplained_thing',
    label: 'Mystery pocket',
    center_deg: 90,
    arc_deg: 20,
    depth_ratio: 0.5,
    visual_weight: 0.2,
    locked: false,
    visible: true,
    explanation: { source: 'engine', author_note: '', override: null },
  });

  const report = validateBlueprint(bp);
  assert.ok(!report.ok);
  assert.equal(report.errors.find((r) => r.id === 'explanations_present').status, 'fail');
});

test('schema violations surface as a blocking error', () => {
  const bp = fresh();
  bp.objects[0].arc_deg = 'wide';
  const report = validateBlueprint(bp);
  assert.ok(!report.ok);
  assert.match(report.errors.find((r) => r.id === 'schema_valid').detail, /non-numeric/);
});

test('validateSchema rejects a dangling parent link and a duplicate id', () => {
  const dangling = fresh();
  dangling.objects.find((o) => o.id === 'echo-1').link.parent_id = 'ghost';
  assert.match(validateSchema(dangling).errors.join(' '), /links to missing parent/);

  const duplicate = fresh();
  duplicate.objects.push({ ...duplicate.objects[0] });
  assert.match(validateSchema(duplicate).errors.join(' '), /Duplicate object id/);
});

/* ================================================================== *
 * Revisioning and hydration
 * ================================================================== */

test('commitRevision bumps the revision and appends history', () => {
  const bp = commitRevision(fresh(), 'Tightened the sweep.', '2026-02-02T00:00:00.000Z');
  assert.equal(bp.revision, 2);
  assert.equal(bp.updated_at, '2026-02-02T00:00:00.000Z');
  assert.equal(bp.history.at(-1).note, 'Tightened the sweep.');
  assert.equal(bp.history.at(-1).revision, 2);
});

test('hydrate migrates a sparse blueprint and reflows its links', () => {
  const bp = fresh();
  delete bp.view;
  delete bp.gravity_intent;
  delete bp.emotional_profile;
  bp.objects.find((o) => o.id === 'sweep-1').start_deg = 0; // stale position

  const { ok, errors, blueprint } = hydrate(bp);
  assert.deepEqual(errors, []);
  assert.ok(ok);
  assert.ok(blueprint.view, 'view state restored');
  assert.equal(blueprint.gravity_intent.value, 'grounded');
  close(getSweep(blueprint).start_deg, 270, 1e-6); // recomputed from the anchor
});

test('hydrate rejects a file that is not a blueprint', () => {
  const result = hydrate({ hello: 'world' });
  assert.ok(!result.ok);
  assert.equal(result.blueprint, null);
});

test('a full edit-and-reload cycle preserves every transform', () => {
  let bp = fresh();
  bp = setAnchorArc(bp, 'anchor-1', { startDeg: 195, arcDeg: 75 });
  bp = updateProperty(bp, 'sweep-1', 'curvature', -0.4);
  bp = updateProperty(bp, 'sweep-1', 'band_width_norm', 0.22);
  bp = setArcWidth(bp, 'echo-1', 28);
  bp = setLocked(bp, 'echo-1', true);
  bp = setAuthorNote(bp, 'echo-1', 'Held at 5 o clock deliberately.');
  bp = commitRevision(bp, 'Saved.', '2026-03-03T00:00:00.000Z');

  const roundTripped = hydrate(JSON.parse(JSON.stringify(bp))).blueprint;

  assert.deepEqual(roundTripped, bp);
  close(getAnchor(roundTripped).start_deg, 195);
  close(getSweep(roundTripped).curvature, -0.4);
  assert.equal(getEcho(roundTripped).locked, true);
  assert.match(roundTripped.objects.find((o) => o.id === 'echo-1').explanation.author_note, /deliberately/);
  assert.equal(roundTripped.revision, 2);
});

test('objectRange agrees with the stored representation for each object kind', () => {
  const bp = fresh();
  const anchorRange = objectRange(getAnchor(bp));
  close(anchorRange.start, 210);
  close(anchorRange.span, 60);

  const echoRange = objectRange(getEcho(bp));
  close(echoRange.start, 133); // centre 150, width 34
  close(echoRange.span, 34);

  const sweepRange = objectRange(getSweep(bp));
  close(sweepRange.start, 270);
  close(sweepRange.span, 135);
});

/* ================================================================== *
 * Schema 1.0.0 -> 1.1.0 migration (rulings of 2026-08-11)
 * ================================================================== */

test('a 1.0.0 blueprint migrates its gravity field and sweep width', () => {
  // Hand-built 1.0.0 record: composition_gravity.declared, sweep width_deg.
  const legacy = {
    schema_version: '1.0.0',
    engine_version: 'placement-engine/sprint-1',
    id: 'bp-legacy',
    name: 'Legacy blueprint',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    revision: 3,
    lifecycle_status: 'draft',
    emotional_profile: { intent: 'A held breath.', keywords: [] },
    composition_gravity: { declared: 'lifted', note: 'author note' },
    base: { shape: 'circle', diameter_in: 24, ring_width_in: 5, depth_in: 4, visible: true, locked: false },
    objects: [
      { ...createBlueprint({ id: 'x' }).objects[0] },
      { ...createBlueprint({ id: 'x' }).objects[1] },
      {
        ...createBlueprint({ id: 'x' }).objects[2],
        width_deg: 15,
        band_width_norm: undefined,
      },
      { ...createBlueprint({ id: 'x' }).objects[3] },
    ],
    view: { clock_overlay: true, rest_zones: true, gravity_marker: true, snap_deg: 15, zoom: 1, pan_x: 0, pan_y: 0 },
    history: [],
  };
  delete legacy.objects[2].band_width_norm;

  const { ok, errors, blueprint } = hydrate(legacy);
  assert.deepEqual(errors, []);
  assert.ok(ok);

  assert.equal(blueprint.schema_version, '1.1.0');

  // Intent moved to its own field; the old shared field is gone.
  assert.equal(blueprint.gravity_intent.value, 'lifted');
  assert.equal(blueprint.gravity_intent.note, 'author note');
  assert.equal('composition_gravity' in blueprint, false);

  // width_deg is gone, replaced by a true radial band width that reproduces
  // what 1.0.0 actually drew: 15 deg x 9.5 in mean radius = 2.487 in of a 5 in ring.
  const sweep = getSweep(blueprint);
  assert.equal(sweep.width_deg, undefined);
  close(sweep.band_width_norm, 0.4974, 0.001);
  close(bandWidthInches(sweep, blueprint.base), 2.4871, 0.001);

  // The migration records itself.
  assert.match(blueprint.history.at(-1).note, /Migrated 1\.0\.0 to 1\.1\.0/);
});

test('the current schema rejects a resurrected composition_gravity field', () => {
  const bp = fresh();
  bp.composition_gravity = { declared: 'grounded' };
  const { ok, errors } = validateSchema(bp);
  assert.ok(!ok);
  assert.match(errors.join(' '), /Intent is gravity_intent/);
});

test('every validator result declares whether it rests on a calibrated rule', () => {
  for (const result of validateBlueprint(fresh()).results) {
    assert.ok(['structural', 'provisional'].includes(result.calibration),
      `${result.id} has calibration "${result.calibration}"`);
    assert.ok(['pass', 'fail', 'metric'].includes(result.status));
  }
});

test('mass concentration is reported as a measurement, never as a verdict', () => {
  const result = validateBlueprint(fresh()).advisories.find((r) => r.id === 'balance_concentration');

  assert.equal(result.status, 'metric', 'must not claim pass or fail');
  assert.equal(result.calibration, 'provisional');
  // The rejected language must not reappear.
  assert.doesNotMatch(result.detail, /resolved|unresolved|half-moon/i);
  assert.match(result.detail, /No calibrated threshold/);
});

test('provisional thresholds are tagged wherever they decide an outcome', () => {
  const report = validateBlueprint(fresh());
  const provisionalIds = report.results
    .filter((r) => r.calibration === 'provisional')
    .map((r) => r.id)
    .sort();

  // Everything that leans on an invented number or the presence model.
  assert.deepEqual(provisionalIds, [
    'anchor_dominant',
    'balance_concentration',
    'clearance_within_anchor',
    'echo_not_rivalling',
    'echo_smaller_than_anchor',
    'rest_zones_present',
    'sweep_is_gesture',
  ]);

  // Structural checks make no aesthetic claim, so they carry no tag.
  const structural = report.results.filter((r) => r.calibration === 'structural').map((r) => r.id).sort();
  assert.deepEqual(structural, [
    'explanations_present',
    'gravity_matches_intent',
    'hardware_clearance_unobstructed',
    'schema_valid',
    'single_primary_anchor',
  ]);
});

test('PROVISIONAL_THRESHOLDS holds only uncalibrated placeholders', () => {
  // Guard against a threshold quietly reappearing as if it were canon.
  assert.deepEqual(Object.keys(PROVISIONAL_THRESHOLDS).sort(), [
    'echoParityRatio',
    'maxSweepBandNorm',
    'minAnchorMassRatio',
    'minRestDegrees',
    'minRestTotalDegrees',
  ]);
});
