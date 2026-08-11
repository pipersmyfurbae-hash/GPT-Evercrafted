/**
 * Validation.
 *
 * Two tiers, deliberately kept apart. See CONFLICTS.md C-07.
 *
 *   ERRORS    — exactly the five validators listed in Sprint 1 ticket §8.
 *               These and only these block.
 *
 *   ADVISORIES — derived from the spec's Acceptance Criteria and the canon, which
 *               ask for more than the ticket does. Non-blocking, so nothing new
 *               prevents a save the ticket said should succeed.
 */

import {
  angleInRange,
  clampSpan,
  normDeg,
  rangeContains,
  rangeOverlap,
  sweepRadiusAt,
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
  bandFraction,
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

export const ADVISORY_THRESHOLDS = {
  /** Echo presence above this fraction of the anchor starts rivalling it. */
  echoParityRatio: 0.7,
  /**
   * A uniform half-annulus — a literal "half-moon" — has concentration 2/pi.
   * The spec's Balance Rule warns against exactly that silhouette.
   */
  halfMoonConcentration: 2 / Math.PI,
  /** A rest zone narrower than this does not read as a pause. */
  minRestDegrees: 20,
  /** Total degrees of the form that should remain unworked. */
  minRestTotalDegrees: 45,
  /** Above this fraction of the ring width a sweep stops being a gesture. */
  maxSweepBandFraction: 0.6,
  /** Anchor mass left after the clearance is carved out. */
  minAnchorMassRatio: 0.4,
};

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
  return { id, level, status, title, detail, canon: [], objects: [], ...extras };
}

const pass = (id, level, title, detail, extras) => result(id, level, 'pass', title, detail, extras);
const fail = (id, level, title, detail, extras) => result(id, level, 'fail', title, detail, extras);

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
  const meta = {
    canon: ['SPEC.ECHO', 'SPEC.DOMINANT'],
    objects: [echo?.id, anchor?.id].filter(Boolean),
  };

  if (!anchor || !echo) {
    return pass('echo_smaller_than_anchor', 'error', 'Echo vs anchor',
      'No anchor/echo pair to compare.', meta);
  }

  const anchorPresence = presenceOf(anchor, bp.base);
  const echoPresence = presenceOf(echo, bp.base);
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
  const meta = { canon: ['SPEC.DOMINANT', 'COMP.L1'], objects: anchor ? [anchor.id] : [] };
  if (!anchor) {
    return pass('anchor_dominant', 'advisory', 'Anchor dominance', 'No anchor to assess.', meta);
  }

  const anchorPresence = presenceOf(anchor, bp.base);
  const rivals = bp.objects
    .filter((o) => o.id !== anchor.id && o.kind !== 'clearance')
    .map((o) => ({ obj: o, presence: presenceOf(o, bp.base) }))
    .filter((entry) => entry.presence >= anchorPresence);

  if (!rivals.length) {
    const next = bp.objects
      .filter((o) => o.id !== anchor.id && o.kind !== 'clearance')
      .map((o) => presenceOf(o, bp.base))
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
  const meta = { canon: ['SPEC.ECHO', 'SPEC.DOMINANT'], objects: [echo?.id].filter(Boolean) };
  if (!anchor || !echo) {
    return pass('echo_not_rivalling', 'advisory', 'Echo weight', 'No anchor/echo pair to compare.', meta);
  }

  const ratio = presenceOf(echo, bp.base) / (presenceOf(anchor, bp.base) || 1);
  const limit = ADVISORY_THRESHOLDS.echoParityRatio;

  if (ratio <= limit) {
    return pass('echo_not_rivalling', 'advisory', 'Echo reads as an echo',
      `Echo carries ${round(ratio * 100, 0)}% of the anchor's presence, below the ${round(limit * 100, 0)}% parity threshold.`, meta);
  }
  return fail('echo_not_rivalling', 'advisory', 'Echo is approaching parity',
    `Echo carries ${round(ratio * 100, 0)}% of the anchor's presence. Past roughly ${round(limit * 100, 0)}% it stops reading as an echo and starts reading as a second focal area.`, meta);
}

/** Spec Balance Rule: avoid an unresolved "half-moon". */
function balanceConcentration(bp) {
  const gravity = compositionGravity(bp);
  const limit = ADVISORY_THRESHOLDS.halfMoonConcentration;
  const meta = { canon: ['SPEC.BALANCE', 'COMP.BALANCE', 'COMP.GRAVITY'], objects: [] };

  const detail =
    `Visual weight concentration is ${round(gravity.concentration, 2)} toward the ` +
    `${gravity.concentration < 0.12 ? 'centre' : describeSector(gravity.deg)} ` +
    `(a uniform half-moon reads ${round(limit, 2)}).`;

  if (gravity.concentration <= limit) {
    return pass('balance_concentration', 'advisory', 'Weight is asymmetric but resolved', detail, meta);
  }
  return fail('balance_concentration', 'advisory', 'Unresolved half-moon',
    `${detail} Mass is bunched into one side of the form. The spec allows asymmetry but asks for balanced visual weight unless a half-moon formula was deliberately chosen.`, meta);
}

/** EC-COMP-001 L4/L5 and spec: "Negative space remains intentional." */
function restZonesPresent(bp) {
  const zones = restZones(bp);
  const meaningful = zones.filter((z) => z.span >= ADVISORY_THRESHOLDS.minRestDegrees);
  const total = zones.reduce((sum, z) => sum + z.span, 0);
  const meta = { canon: ['COMP.L4', 'COMP.L5', 'COMP.L12', 'SPEC.NEGSPACE'], objects: [] };

  if (meaningful.length && total >= ADVISORY_THRESHOLDS.minRestTotalDegrees) {
    return pass('rest_zones_present', 'advisory', 'The composition breathes',
      `${round(total)}° of the form is left unworked across ${zones.length} rest ${zones.length === 1 ? 'zone' : 'zones'}, the largest ${round(Math.max(...zones.map((z) => z.span)))}°.`, meta);
  }
  return fail('rest_zones_present', 'advisory', 'Not enough rest',
    `Only ${round(total)}° of the form is left unworked${meaningful.length ? '' : `, with no single gap reaching ${ADVISORY_THRESHOLDS.minRestDegrees}°`}. EC-COMP-001 treats negative space as an active design element, and a design is not complete merely because every area is filled.`, meta);
}

/** EC-GRN-001 GRN-B02: "Thin, readable gesture; never a hedge of greenery." */
function sweepIsGesture(bp) {
  const sweep = getSweep(bp);
  const meta = { canon: ['GRN.B02', 'GRN.L7', 'SPEC.SWEEP'], objects: sweep ? [sweep.id] : [] };
  if (!sweep) {
    return pass('sweep_is_gesture', 'advisory', 'Sweep width', 'No behaviour path to assess.', meta);
  }

  const fraction = bandFraction(sweep, bp.base);
  const { rMean } = baseRadii(bp.base);
  const inches = (sweep.width_deg * Math.PI / 180) * rMean;
  const limit = ADVISORY_THRESHOLDS.maxSweepBandFraction;

  if (fraction <= limit) {
    return pass('sweep_is_gesture', 'advisory', 'Sweep reads as a gesture',
      `Band is ${round(inches, 2)} in, ${round(fraction * 100, 0)}% of the ring width.`, meta);
  }
  return fail('sweep_is_gesture', 'advisory', 'Sweep is thickening into a band',
    `Band is ${round(inches, 2)} in, ${round(fraction * 100, 0)}% of the ring width — past the ${round(limit * 100, 0)}% point it stops being a guiding gesture and becomes a hedge of greenery.`, meta);
}

/** Wireframe: the clearance belongs inside the anchor zone. */
function clearanceWithinAnchor(bp) {
  const anchor = getAnchor(bp);
  const clearance = getClearance(bp);
  const meta = { canon: ['SPEC.HARDWARE', 'SPEC.ANCHOR'], objects: [clearance?.id].filter(Boolean) };
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
  if (remainingRatio < ADVISORY_THRESHOLDS.minAnchorMassRatio) {
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

  return {
    ok: failedErrors.length === 0,
    errors,
    advisories,
    results: [...errors, ...advisories],
    counts: {
      errors: failedErrors.length,
      advisories: failedAdvisories.length,
      passed: [...errors, ...advisories].filter((r) => r.status === 'pass').length,
    },
  };
}
