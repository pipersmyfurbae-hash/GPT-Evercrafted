/**
 * Validation.
 *
 * Two tiers of authority and three kinds of result. See CONFLICTS.md C-07.
 *
 * TIERS
 *   error    — exactly the five validators listed in Sprint 1 ticket §8.
 *              These and only these block.
 *   advisory — derived from the spec's Acceptance Criteria and the canon, which
 *              ask for more than the ticket does. Never blocks.
 *
 * STATUS
 *   pass / fail — a predicate was evaluated and returned a verdict.
 *   metric      — a number was measured and NO verdict was reached, because no
 *                 calibrated predicate exists for it yet.
 *
 * CALIBRATION — the honesty field.
 *   structural  — counting, containment, schema, geometric overlap. No aesthetic
 *                 judgement is being made, so there is nothing to calibrate.
 *   provisional — depends on an invented numeric threshold, or on the
 *                 uncalibrated visual-presence model. Reported, tagged, and
 *                 never presented as law.
 *
 * A threshold is a calibration value, not an aesthetic guess. Nothing in
 * PROVISIONAL_THRESHOLDS has been calibrated against real designs, so no result
 * that depends on one may state a conclusion as fact. EC-GEO-001 / EC-CAL own
 * the calibrated predicates that will replace them.
 */

import {
  angleInRange,
  clampSpan,
  normDeg,
  rangeContains,
  rangeOverlap,
  sweepRadiusAt,
  clamp01,
} from './geometry.js';
import {
  allByRole,
  baseRadii,
  getAnchor,
  getClearance,
  getEcho,
  getSweep,
  objectCenter,
  objectRange,
  validateSchema,
} from './schema.js';
import {
  bandWidthInches,
  clearanceRadii,
  compositionGravity,
  gravityContradiction,
  pocketRadii,
  presenceOf,
  readGravityDirection,
  restZones,
  sweepGeometry,
} from './analysis.js';
import { describeSector, explainObject } from './explain.js';

/**
 * PROVISIONAL / UNCALIBRATED THRESHOLDS.
 *
 * Every number below is an engineering placeholder chosen to get Sprint 1
 * moving. None has been calibrated against real designs, and none is canon.
 * Results that depend on them are tagged `calibration: 'provisional'` and the
 * UI marks them, so a placeholder can never be mistaken for a design law.
 *
 * EC-GEO-001 / EC-CAL own the calibrated predicates that replace these. When
 * they land, these constants are deleted rather than adjusted.
 */
export const PROVISIONAL_THRESHOLDS = {
  /** Echo presence above this fraction of the anchor is called "approaching parity". */
  echoParityRatio: 0.7,
  /** Below this a rest gap is not counted as a pause. */
  minRestDegrees: 20,
  /** Total degrees of the form expected to remain unworked. */
  minRestTotalDegrees: 45,
  /** Above this band width a sweep is called a hedge rather than a gesture. */
  maxSweepBandNorm: 0.6,
  /** Anchor mass expected to survive the clearance being carved out. */
  minAnchorMassRatio: 0.4,
};

/**
 * Reference value for the mass-concentration READOUT only. A uniform
 * half-annulus evaluates to 2/pi.
 *
 * This is a geometric fact about a shape. It is NOT a threshold: nothing has
 * established that a composition below it is "resolved" or above it is not, and
 * the engine must not say so. It is published purely to give the measured
 * number a sense of scale. See CONFLICTS.md C-07 (REVISED).
 */
export const UNIFORM_HALF_ANNULUS_CONCENTRATION = 2 / Math.PI;

/**
 * Rounding that survives malformed input.
 *
 * Validators run against blueprints that may be hand-edited or corrupt — that is
 * precisely when the schema validator needs to report. A validator that throws on
 * a bad field takes the whole report down with it and tells the user nothing.
 */
const round = (n, places = 1) => {
  const value = Number(n);
  return Number.isFinite(value) ? Number(value.toFixed(places)) : '?';
};

function result(id, level, status, title, detail, extras = {}) {
  return {
    id,
    level,
    status,
    title,
    detail,
    canon: [],
    objects: [],
    calibration: 'structural',
    ...extras,
  };
}

const pass = (id, level, title, detail, extras) => result(id, level, 'pass', title, detail, extras);
const fail = (id, level, title, detail, extras) => result(id, level, 'fail', title, detail, extras);

/** A measured number with no verdict attached, because none has been earned. */
const metric = (id, level, title, detail, extras) =>
  result(id, level, 'metric', title, detail, { calibration: 'provisional', ...extras });

/** Marks a result as resting on an uncalibrated threshold or model. */
const provisional = (extras = {}) => ({ ...extras, calibration: 'provisional' });

/* ================================================================== *
 * Blocking validators — Sprint 1 ticket §8
 * ================================================================== */

/** §8.1 — one primary anchor. */
function singlePrimaryAnchor(bp) {
  const anchors = allByRole(bp, 'primary_anchor');
  const meta = { canon: ['SPEC.ANCHOR.ONE', 'COMP.L1'], objects: anchors.map((a) => a.id) };

  if (anchors.length === 1) {
    return pass('single_primary_anchor', 'error', 'One primary anchor',
      'Exactly one primary anchor is present.', meta);
  }
  if (anchors.length === 0) {
    return fail('single_primary_anchor', 'error', 'No primary anchor',
      'The composition has no primary anchor. EC-COMP-001 requires every design to establish a clear emotional anchor.', meta);
  }
  return fail('single_primary_anchor', 'error', 'Multiple primary anchors',
    `${anchors.length} primary anchors are present. The spec allows exactly one unless a later canon defines a multi-anchor formula — which Sprint 1 explicitly does not build.`, meta);
}

/** §8.2 — echo smaller than anchor. */
function echoSmallerThanAnchor(bp) {
  const anchor = getAnchor(bp);
  const echo = getEcho(bp);
  // Ticket-required, so it blocks — but the comparison rides on the
  // uncalibrated presence model, so it is tagged accordingly.
  const meta = provisional({
    canon: ['SPEC.ECHO', 'SPEC.DOMINANT'],
    objects: [echo?.id, anchor?.id].filter(Boolean),
  });

  if (!anchor || !echo) {
    return pass('echo_smaller_than_anchor', 'error', 'Echo vs anchor',
      'No anchor/echo pair to compare.', meta);
  }

  const anchorPresence = presenceOf(anchor);
  const echoPresence = presenceOf(echo);
  const ratio = anchorPresence > 0 ? echoPresence / anchorPresence : Infinity;

  const sizeNote =
    clampSpan(echo.arc_deg) > clampSpan(anchor.arc_deg)
      ? ` The echo's arc (${round(echo.arc_deg)}°) is also wider than the anchor's (${round(anchor.arc_deg)}°).`
      : '';

  if (echoPresence < anchorPresence) {
    return pass('echo_smaller_than_anchor', 'error', 'Echo lighter than anchor',
      `Echo presence ${round(echoPresence)} against anchor ${round(anchorPresence)} — ${round(ratio * 100, 0)}% of the anchor.${sizeNote}`, meta);
  }

  return fail('echo_smaller_than_anchor', 'error', 'Echo is not smaller than the anchor',
    `Echo presence ${round(echoPresence)} meets or exceeds the anchor's ${round(anchorPresence)}. The spec requires the echo to be visibly lighter and smaller — an echo, not a second focal point.${sizeNote}`, meta);
}

/**
 * §8.3 — hardware clearance not obstructed.
 *
 * "Obstructed" is read as: another object's MASS intrudes into the reserved
 * volume. The anchor is not an obstruction — the clearance is carved out of it
 * by construction, so counting the anchor would make this validator fail on the
 * canonical default composition. See CONFLICTS.md C-03.
 *
 * Both angular and radial overlap must be present to count as an intrusion: a
 * sweep passing over the clearance angularly but at a different depth is not
 * obstructing it.
 */
function hardwareClearanceUnobstructed(bp) {
  const clearance = getClearance(bp);
  const meta = { canon: ['SPEC.HARDWARE'], objects: clearance ? [clearance.id] : [] };

  if (!clearance) {
    return pass('hardware_clearance_unobstructed', 'error', 'Hardware clearance',
      'No hardware clearance is reserved in this blueprint.', meta);
  }

  const clearRange = objectRange(clearance);
  const clearRadii = clearanceRadii(clearance, bp.base);
  const intruders = [];

  for (const obj of bp.objects) {
    if (obj.id === clearance.id || obj.kind === 'clearance') continue;
    if (obj.role === 'primary_anchor') continue; // the clearance lives inside it

    if (obj.kind === 'pocket') {
      const overlapDeg = rangeOverlap(objectRange(obj), clearRange);
      if (overlapDeg <= 0.01) continue;
      const radii = pocketRadii(obj, bp.base);
      const radialOverlap =
        Math.min(radii.rOuterClamped, clearRadii.rOuter) - Math.max(radii.rInnerClamped, clearRadii.rInner);
      if (radialOverlap > 0.01) {
        intruders.push({ obj, detail: `${round(overlapDeg)}° of angular overlap and ${round(radialOverlap, 2)} in of depth overlap` });
      }
      continue;
    }

    if (obj.kind === 'behavior_path') {
      const geom = sweepGeometry(obj, bp.base);
      const samples = 180;
      let worstDeg = 0;
      let worstRadial = 0;

      for (let i = 0; i <= samples; i += 1) {
        const t = i / samples;
        const deg = normDeg(geom.startDeg + geom.arcDeg * t);
        if (!angleInRange(deg, clearRange)) continue;

        const half = (geom.thicknessIn * (1 - geom.taper * t)) / 2;
        const radius = sweepRadiusAt(geom, t);
        const lo = radius - half;
        const hi = radius + half;
        const radialOverlap = Math.min(hi, clearRadii.rOuter) - Math.max(lo, clearRadii.rInner);
        if (radialOverlap > worstRadial) worstRadial = radialOverlap;
        worstDeg += geom.arcDeg / samples;
      }

      if (worstRadial > 0.01) {
        intruders.push({ obj, detail: `${round(worstDeg)}° of its path crosses the clearance, overlapping ${round(worstRadial, 2)} in of its depth` });
      }
    }
  }

  if (!intruders.length) {
    return pass('hardware_clearance_unobstructed', 'error', 'Hardware clearance is clear',
      `The ${round(clearRange.span)}° reserved for ${clearance.purpose ?? 'hardware'} is not intruded on by any other object.`, meta);
  }

  return fail('hardware_clearance_unobstructed', 'error', 'Hardware clearance is obstructed',
    intruders.map(({ obj, detail }) => `${obj.label}: ${detail}.`).join(' '),
    { ...meta, objects: [clearance.id, ...intruders.map((i) => i.obj.id)] });
}

/** §8.4 — required explanation exists. */
function explanationsPresent(bp) {
  const meta = { canon: ['DOS.P1', 'SPEC.EXPLAIN'], objects: [] };
  const missing = [];

  for (const obj of bp.objects) {
    const explanation = explainObject(bp, obj);
    const incomplete =
      !explanation ||
      !explanation.what?.trim() ||
      !explanation.role?.trim() ||
      !explanation.why?.trim() ||
      explanation.canonRules.length === 0;
    if (incomplete) missing.push(obj);
  }

  if (!missing.length) {
    return pass('explanations_present', 'error', 'Every object explains itself',
      `All ${bp.objects.length} objects answer what they are, the role they serve, why they are there, and which canon rule supports them.`, meta);
  }

  return fail('explanations_present', 'error', 'Objects without an explanation',
    `${missing.map((o) => o.label ?? o.id).join(', ')} cannot produce a complete explanation. EC-DOS-001 requires every design decision to be explainable.`,
    { ...meta, objects: missing.map((o) => o.id) });
}

/** §8.5 — saved blueprint schema is valid. */
function schemaValid(bp) {
  const meta = { canon: ['SPEC.PERSIST'], objects: [] };
  const { ok, errors } = validateSchema(bp);
  if (ok) {
    return pass('schema_valid', 'error', 'Schema is valid',
      `Blueprint conforms to schema ${bp.schema_version}.`, meta);
  }
  return fail('schema_valid', 'error', 'Schema is invalid', errors.join(' '), meta);
}

/* ================================================================== *
 * Advisories — spec Acceptance Criteria and canon, non-blocking
 * ================================================================== */

/** Spec: "Anchor remains visually dominant" — against everything, not just the echo. */
function anchorDominant(bp) {
  const anchor = getAnchor(bp);
  const meta = provisional({ canon: ['SPEC.DOMINANT', 'COMP.L1'], objects: anchor ? [anchor.id] : [] });
  if (!anchor) {
    return pass('anchor_dominant', 'advisory', 'Anchor dominance', 'No anchor to assess.', meta);
  }

  const anchorPresence = presenceOf(anchor);
  const rivals = bp.objects
    .filter((o) => o.id !== anchor.id && o.kind !== 'clearance')
    .map((o) => ({ obj: o, presence: presenceOf(o) }))
    .filter((entry) => entry.presence >= anchorPresence);

  if (!rivals.length) {
    const next = bp.objects
      .filter((o) => o.id !== anchor.id && o.kind !== 'clearance')
      .map((o) => presenceOf(o))
      .sort((a, b) => b - a)[0] ?? 0;
    return pass('anchor_dominant', 'advisory', 'Anchor is dominant',
      `Anchor presence ${round(anchorPresence)} leads the next heaviest element at ${round(next)}.`, meta);
  }

  return fail('anchor_dominant', 'advisory', 'Anchor is not the dominant mass',
    `${rivals.map((r) => `${r.obj.label} carries ${round(r.presence)}`).join('; ')}, against the anchor's ${round(anchorPresence)}. The ticket's own validators only compare the echo, so this would otherwise pass unnoticed.`,
    { ...meta, objects: [anchor.id, ...rivals.map((r) => r.obj.id)] });
}

/** Spec: "Secondary echo never rivals anchor weight." */
function echoNotRivalling(bp) {
  const anchor = getAnchor(bp);
  const echo = getEcho(bp);
  const meta = provisional({ canon: ['SPEC.ECHO', 'SPEC.DOMINANT'], objects: [echo?.id].filter(Boolean) });
  if (!anchor || !echo) {
    return pass('echo_not_rivalling', 'advisory', 'Echo weight', 'No anchor/echo pair to compare.', meta);
  }

  const ratio = presenceOf(echo) / (presenceOf(anchor) || 1);
  const limit = PROVISIONAL_THRESHOLDS.echoParityRatio;

  if (ratio <= limit) {
    return pass('echo_not_rivalling', 'advisory', 'Echo is well below the anchor',
      `Echo carries ${round(ratio * 100, 0)}% of the anchor's presence, under the provisional ${round(limit * 100, 0)}% mark.`, meta);
  }
  return fail('echo_not_rivalling', 'advisory', 'Echo is approaching the anchor',
    `Echo carries ${round(ratio * 100, 0)}% of the anchor's presence, over the provisional ${round(limit * 100, 0)}% mark. That figure is an engineering placeholder, not a calibrated point at which an echo stops reading as an echo.`, meta);
}

/**
 * Mass concentration — REPORTED, NOT JUDGED.
 *
 * The spec's Balance Rule warns against an unresolved "half-moon", but nothing
 * has established the number at which a composition crosses that line. Sprint 1
 * originally used 2/pi as a pass/fail threshold; that was an engineering guess
 * dressed as a verdict and the ruling on CONFLICTS.md C-07 removed it.
 *
 * So this reports the measurement and the scale reference, and stops. Saying
 * "0.58 is resolved because it is under 0.637" is a conclusion the engine has
 * not earned. EC-GEO-001 owns the calibrated predicate.
 */
function balanceConcentration(bp) {
  const gravity = compositionGravity(bp);
  const where = gravity.concentration < 0.12 ? 'the centre' : describeSector(gravity.deg);

  return metric('balance_concentration', 'advisory', 'Mass concentration',
    `${round(gravity.concentration, 2)} toward ${where}, on a scale where 0 is weight spread evenly around the form and 1 is all weight at a single point. For reference, a uniform half-annulus measures ${round(UNIFORM_HALF_ANNULUS_CONCENTRATION, 2)} — a shape comparison, not a pass mark. No calibrated threshold has been established for this measure.`,
    { canon: ['SPEC.BALANCE', 'COMP.BALANCE', 'COMP.GRAVITY'], objects: [] });
}

/** EC-COMP-001 L4/L5 and spec: "Negative space remains intentional." */
function restZonesPresent(bp) {
  const zones = restZones(bp);
  const meaningful = zones.filter((z) => z.span >= PROVISIONAL_THRESHOLDS.minRestDegrees);
  const total = zones.reduce((sum, z) => sum + z.span, 0);
  const meta = provisional({ canon: ['COMP.L4', 'COMP.L5', 'COMP.L12', 'SPEC.NEGSPACE'], objects: [] });

  if (meaningful.length && total >= PROVISIONAL_THRESHOLDS.minRestTotalDegrees) {
    return pass('rest_zones_present', 'advisory', 'The composition breathes',
      `${round(total)}° of the form is left unworked across ${zones.length} rest ${zones.length === 1 ? 'zone' : 'zones'}, the largest ${round(Math.max(...zones.map((z) => z.span)))}°.`, meta);
  }
  return fail('rest_zones_present', 'advisory', 'Little rest left',
    `Only ${round(total)}° of the form is left unworked${meaningful.length ? '' : `, with no single gap reaching the provisional ${PROVISIONAL_THRESHOLDS.minRestDegrees}° minimum`}. EC-COMP-001 treats negative space as an active design element, and a design is not complete merely because every area is filled. The degree figures are placeholders, not calibrated minimums.`, meta);
}

/** EC-GRN-001 GRN-B02: "Thin, readable gesture; never a hedge of greenery." */
function sweepIsGesture(bp) {
  const sweep = getSweep(bp);
  const meta = provisional({ canon: ['GRN.B02', 'GRN.L7', 'SPEC.SWEEP'], objects: sweep ? [sweep.id] : [] });
  if (!sweep) {
    return pass('sweep_is_gesture', 'advisory', 'Sweep width', 'No behaviour path to assess.', meta);
  }

  const fraction = clamp01(sweep.band_width_norm ?? 0);
  const inches = bandWidthInches(sweep, bp.base);
  const limit = PROVISIONAL_THRESHOLDS.maxSweepBandNorm;

  if (fraction <= limit) {
    return pass('sweep_is_gesture', 'advisory', 'Sweep reads as a gesture',
      `Band is ${round(inches, 2)} in across the ring, ${round(fraction * 100, 0)}% of its width.`, meta);
  }
  return fail('sweep_is_gesture', 'advisory', 'Sweep is thickening into a band',
    `Band is ${round(inches, 2)} in across the ring, ${round(fraction * 100, 0)}% of its width — over the provisional ${round(limit * 100, 0)}% mark, past which GRN-B02's "gesture, never a hedge" is at risk. The mark itself is a placeholder.`, meta);
}

/** Wireframe: the clearance belongs inside the anchor zone. */
function clearanceWithinAnchor(bp) {
  const anchor = getAnchor(bp);
  const clearance = getClearance(bp);
  const meta = provisional({ canon: ['SPEC.HARDWARE', 'SPEC.ANCHOR'], objects: [clearance?.id].filter(Boolean) });
  if (!anchor || !clearance) {
    return pass('clearance_within_anchor', 'advisory', 'Clearance placement', 'No anchor/clearance pair to assess.', meta);
  }

  const anchorRange = objectRange(anchor);
  const clearRange = objectRange(clearance);

  if (!rangeContains(anchorRange, clearRange)) {
    return fail('clearance_within_anchor', 'advisory', 'Clearance has left the anchor zone',
      `The clearance at ${round(objectCenter(clearance))}° is no longer fully inside the ${round(anchorRange.span)}° anchor arc. The wireframe places bow/ribbon clearance within the anchor zone so hardware and focal mass read as one gesture.`, meta);
  }

  const remainingRatio = (anchorRange.span - clearRange.span) / anchorRange.span;
  if (remainingRatio < PROVISIONAL_THRESHOLDS.minAnchorMassRatio) {
    return fail('clearance_within_anchor', 'advisory', 'Clearance has hollowed out the anchor',
      `Only ${round(remainingRatio * 100, 0)}% of the anchor arc still carries mass. The anchor stops reading as one dominant mass and starts reading as two small clusters.`, meta);
  }

  return pass('clearance_within_anchor', 'advisory', 'Clearance sits within the anchor',
    `${round(clearRange.span)}° reserved inside the ${round(anchorRange.span)}° anchor, leaving ${round(remainingRatio * 100, 0)}% of the arc as mass.`, meta);
}

/**
 * Declared composition gravity vs. what the drawing actually does.
 *
 * Reports rather than enforces: the two canon documents disagree on whether
 * gravity is an input to placement or an outcome of it (CONFLICTS.md C-01), so
 * neither reading is treated as authoritative here. Only a direct contradiction
 * is flagged — the declared vocabulary is largely non-directional, and a
 * mismatch between "quiet" and "lateral" is not evidence of anything.
 */
function gravityMatchesIntent(bp) {
  const gravity = compositionGravity(bp);
  const declared = bp.composition_gravity?.declared;
  const observed = readGravityDirection(gravity);
  const where = gravity.concentration < 0.12 ? 'the centre' : describeSector(gravity.deg);
  const meta = { canon: ['COMP.GRAVITY'], objects: [] };

  if (!declared) {
    return pass('gravity_matches_intent', 'advisory', 'Composition gravity',
      `Weight reads ${observed}, toward ${where}. No intent declared.`, meta);
  }

  if (gravityContradiction(declared, observed)) {
    return fail('gravity_matches_intent', 'advisory', 'Gravity contradicts declared intent',
      `Declared "${declared}", but the placed weight reads ${observed}, toward ${where}. Neither is authoritative in Sprint 1 — see CONFLICTS.md C-01 — so this is reported, not enforced.`, meta);
  }

  return pass('gravity_matches_intent', 'advisory', 'Composition gravity',
    `Declared "${declared}"; the placed weight reads ${observed}, toward ${where}.`, meta);
}

/* ================================================================== *
 * Runner
 * ================================================================== */

const ERROR_VALIDATORS = [
  singlePrimaryAnchor,
  echoSmallerThanAnchor,
  hardwareClearanceUnobstructed,
  explanationsPresent,
  schemaValid,
];

const ADVISORY_VALIDATORS = [
  anchorDominant,
  echoNotRivalling,
  balanceConcentration,
  restZonesPresent,
  sweepIsGesture,
  clearanceWithinAnchor,
  gravityMatchesIntent,
];

/**
 * Run one validator without letting it take the report down with it.
 *
 * A blueprint bad enough to crash a validator is a blueprint whose report the
 * user most needs to see — losing every other result to one exception would hide
 * the schema error that explains the crash.
 */
function runValidator(fn, bp, level) {
  try {
    return fn(bp);
  } catch (error) {
    return fail(fn.name || 'validator', level, 'Validator could not run',
      `This check threw while inspecting the blueprint: ${error.message}. That usually means a malformed field — see the schema result.`,
      { canon: ['DOS.P1'], objects: [] });
  }
}

/**
 * Run every validator. `ok` reflects blocking errors only — advisories never
 * prevent a save.
 */
export function validateBlueprint(bp) {
  const errors = ERROR_VALIDATORS.map((fn) => runValidator(fn, bp, 'error'));
  const advisories = ADVISORY_VALIDATORS.map((fn) => runValidator(fn, bp, 'advisory'));
  const failedErrors = errors.filter((r) => r.status === 'fail');
  const failedAdvisories = advisories.filter((r) => r.status === 'fail');

  const all = [...errors, ...advisories];
  return {
    ok: failedErrors.length === 0,
    errors,
    advisories,
    results: all,
    counts: {
      errors: failedErrors.length,
      advisories: failedAdvisories.length,
      passed: all.filter((r) => r.status === 'pass').length,
      // Measurements without a calibrated predicate. Not passes, not failures.
      metrics: all.filter((r) => r.status === 'metric').length,
      provisional: all.filter((r) => r.calibration === 'provisional').length,
    },
  };
}
