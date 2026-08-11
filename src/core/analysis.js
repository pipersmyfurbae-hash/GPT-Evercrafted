/**
 * Derived analysis over a blueprint: dependency reflow, visual presence,
 * composition gravity, and negative space.
 *
 * Nothing here is stored. Every value is recomputed from the blueprint on each
 * render, so the canvas, inspector and validators can never disagree about the
 * same number.
 */

import {
  normDeg,
  signedDelta,
  clampSpan,
  clamp01,
  polar,
  angleOfPoint,
  complementRanges,
  subtractArc,
  bandWidthToInches,
} from './geometry.js';
import { baseRadii, byId, getAnchor, objectCenter, objectRange } from './schema.js';

/* ------------------------------------------------------------------ *
 * Dependency reflow
 * ------------------------------------------------------------------ */

/**
 * Recompute every linked object's absolute position from its parent.
 *
 * Spec, Interaction Rules: "Moving the anchor triggers dependent recomputation
 * of sweep, nearby pockets, balance, and negative-space relationships."
 *
 * Locked objects are skipped: "A user may lock a component to prevent automatic
 * reflow." Mutates in place — callers pass a working copy.
 */
export function applyLinks(bp) {
  for (const obj of bp.objects) {
    if (!obj.link || obj.locked) continue;

    const parent = byId(bp, obj.link.parent_id);
    if (!parent || parent.id === obj.id) continue;

    const parentRange = objectRange(parent);
    const parentCenter = normDeg(parentRange.start + parentRange.span / 2);
    const offset = obj.link.offset_deg ?? 0;

    switch (obj.link.mode) {
      case 'centered_in_anchor':
      case 'offset_from_anchor':
        obj.center_deg = normDeg(parentCenter + offset);
        break;

      case 'from_anchor_edge': {
        const edge =
          obj.link.edge === 'trailing'
            ? parentRange.start
            : normDeg(parentRange.start + parentRange.span);
        obj.start_deg = normDeg(edge + offset);
        break;
      }

      case 'absolute':
      default:
        break;
    }
  }
  return bp;
}

/**
 * Re-derive an object's link offset from where it currently sits, so that
 * locking then unlocking (or dragging a linked object directly) preserves the
 * relationship without the object jumping.
 */
export function relinkFromCurrent(bp, obj) {
  if (!obj?.link) return;
  const parent = byId(bp, obj.link.parent_id);
  if (!parent || parent.id === obj.id) return;

  const parentRange = objectRange(parent);
  const parentCenter = normDeg(parentRange.start + parentRange.span / 2);

  if (obj.link.mode === 'from_anchor_edge') {
    const edge =
      obj.link.edge === 'trailing'
        ? parentRange.start
        : normDeg(parentRange.start + parentRange.span);
    obj.link.offset_deg = Math.round(signedDelta(edge, obj.start_deg) * 100) / 100;
  } else {
    obj.link.offset_deg = Math.round(signedDelta(parentCenter, obj.center_deg) * 100) / 100;
  }
}

/** Objects that would move if `id` moved. */
export function dependentsOf(bp, id) {
  return bp.objects.filter((o) => o.link?.parent_id === id && o.id !== id);
}

/** The object `id` follows, if any. */
export function parentOf(bp, obj) {
  return obj?.link?.parent_id ? byId(bp, obj.link.parent_id) : null;
}

/* ------------------------------------------------------------------ *
 * Visual presence
 * ------------------------------------------------------------------ */

/**
 * A proxy for how much visual mass an object carries.
 *
 * Pockets:        arc x radial depth x weight
 * Behaviour path: arc x band width x average taper x strength
 * Clearance:      0 — it is a reserved void, not mass.
 *
 * Note the anchor's presence uses its FULL arc rather than arc-minus-clearance.
 * The clearance is reserved *for focal hardware* (bow, ribbon) which is itself
 * focal mass in the finished piece, so subtracting it would understate the
 * anchor and wrongly trip the dominance advisory.
 *
 * PROVISIONAL / UNCALIBRATED. This formula is an engineering model, not a
 * calibrated measure of perceived visual weight. Every comparison built on it
 * inherits that status. EC-GEO-001 / EC-CAL own the calibrated replacement.
 */
export function presenceOf(obj) {
  if (!obj) return 0;

  if (obj.kind === 'pocket') {
    return clampSpan(obj.arc_deg) * Math.max(0, obj.depth_ratio ?? 0) * clamp01(obj.visual_weight ?? 0);
  }

  if (obj.kind === 'behavior_path') {
    const averageTaper = 1 - clamp01(obj.taper ?? 0) / 2;
    return (
      clampSpan(obj.arc_deg) *
      clamp01(obj.band_width_norm ?? 0) *
      averageTaper *
      clamp01(obj.strength ?? 0)
    );
  }

  return 0;
}

/** Radial thickness of a behaviour path's band, in inches. */
export function bandWidthInches(obj, base) {
  return bandWidthToInches(obj.band_width_norm ?? 0, baseRadii(base).ringWidth);
}

/* ------------------------------------------------------------------ *
 * Composition gravity
 * ------------------------------------------------------------------ */

/**
 * Presence-weighted centroid of the composition — the computed reading of
 * EC-COMP-001's "center of visual/emotional gravity".
 *
 * `concentration` is |sum(presence * unit vector)| / sum(presence):
 *   0.00  weight distributed evenly around the form
 *   0.64  a uniform half-annulus — the literal "half-moon" the spec warns about
 *   1.00  all weight at a single point
 *
 * See CONFLICTS.md C-01 (declared vs. computed gravity) and C-07 (threshold).
 */
export function compositionGravity(bp) {
  let total = 0;
  let vx = 0;
  let vy = 0;
  const contributions = [];

  for (const obj of bp.objects) {
    const presence = presenceOf(obj);
    if (presence <= 0) continue;
    const center = objectCenter(obj);
    const unit = polar(1, center);
    vx += unit.x * presence;
    vy += unit.y * presence;
    total += presence;
    contributions.push({ id: obj.id, label: obj.label, presence, center });
  }

  contributions.sort((a, b) => b.presence - a.presence);

  if (total <= 0) {
    return { total: 0, concentration: 0, deg: 0, x: 0, y: 0, contributions };
  }

  const magnitude = Math.hypot(vx, vy);
  return {
    total,
    concentration: magnitude / total,
    deg: magnitude > 1e-9 ? angleOfPoint(vx, vy, 0, 0) : 0,
    // Unit-circle fraction, so the canvas can place the marker at
    // radius = concentration * outer radius.
    x: vx / total,
    y: vy / total,
    contributions,
  };
}

/**
 * Coarse reading of where the computed weight actually sits.
 *
 * Deliberately only four values. EC-COMP-001's declared vocabulary (grounded,
 * lifted, outward, inward, stable, expanding, quiet, energized) is not a
 * directional vocabulary — "quiet" and "expanding" have no angle — so pretending
 * a 2-D vector maps cleanly onto all eight would manufacture false precision.
 * This returns only what the geometry can honestly support.
 */
export function readGravityDirection(gravity) {
  if (gravity.concentration < 0.12) return 'evenly distributed';
  const deg = normDeg(gravity.deg);
  if (deg >= 315 || deg < 45) return 'lifted';
  if (deg >= 135 && deg < 225) return 'grounded';
  return 'lateral';
}

/**
 * Whether a computed reading directly contradicts a declared intent.
 * Only true opposites count — anything else is simply not evidence either way.
 */
export function gravityContradiction(declared, observed) {
  if (declared === 'grounded' && observed === 'lifted') return true;
  if (declared === 'lifted' && observed === 'grounded') return true;
  if (declared === 'stable' && observed !== 'evenly distributed') return false;
  return false;
}

/* ------------------------------------------------------------------ *
 * Negative space
 * ------------------------------------------------------------------ */

/**
 * Angular gaps left by the placed mass — the derived reading of negative space.
 *
 * Read-only in Sprint 1. The ticket does not list negative space as an editable
 * object, but the spec's acceptance criteria and the wireframe's layer list both
 * require it to be visible. See CONFLICTS.md C-06.
 *
 * Computed from the design regardless of layer visibility: hiding a layer
 * changes what is drawn, not what the composition contains.
 */
export function restZones(bp) {
  const covered = bp.objects
    .filter((o) => o.kind === 'pocket' || o.kind === 'behavior_path')
    .map(objectRange);
  return complementRanges(covered).map((range) => ({
    ...range,
    center: normDeg(range.start + range.span / 2),
  }));
}

/* ------------------------------------------------------------------ *
 * Renderable geometry
 * ------------------------------------------------------------------ */

/**
 * The anchor's drawable sub-sectors: its arc with the hardware clearance carved
 * out. Returns one range when the clearance sits at an edge (or is absent), two
 * when it sits inside. See CONFLICTS.md C-03.
 */
export function anchorSegments(bp) {
  const anchor = getAnchor(bp);
  if (!anchor) return [];
  const anchorRange = objectRange(anchor);

  const clearance = bp.objects.find((o) => o.kind === 'clearance' && o.link?.parent_id === anchor.id);
  if (!clearance) return [anchorRange];

  return subtractArc(anchorRange, objectRange(clearance));
}

/** Radial band (inner/outer radius, inches) occupied by a pocket. */
export function pocketRadii(obj, base) {
  const { rInner, rOuter, rMean, ringWidth } = baseRadii(base);
  const half = (ringWidth * Math.max(0, obj.depth_ratio ?? 1)) / 2;
  return {
    rInner: Math.max(0.5, Math.min(rMean - half, rInner)),
    rOuter: Math.max(rMean + half, rOuter),
    // Clamped variant that stays on the form, used for hit areas.
    rInnerClamped: Math.max(0.5, rMean - half),
    rOuterClamped: rMean + half,
  };
}

/** Radial band occupied by the hardware clearance. */
export function clearanceRadii(obj, base) {
  const { rInner, ringWidth } = baseRadii(base);
  const center = rInner + clamp01(obj.radial_position ?? 0.5) * ringWidth;
  const half = (ringWidth * clamp01(obj.radial_extent ?? 0.8)) / 2;
  return { rInner: Math.max(0.5, center - half), rOuter: center + half };
}

/** Resolved inputs for drawing a behaviour path. */
export function sweepGeometry(obj, base) {
  const { rInner, rOuter, ringWidth } = baseRadii(base);
  return {
    startDeg: normDeg(obj.start_deg),
    arcDeg: clampSpan(obj.arc_deg),
    rInner,
    rOuter,
    radialPosition: clamp01(obj.radial_position ?? 0.5),
    curvature: obj.curvature ?? 0,
    thicknessIn: bandWidthToInches(obj.band_width_norm ?? 0, ringWidth),
    taper: clamp01(obj.taper ?? 0),
  };
}

/* ------------------------------------------------------------------ *
 * Measurement namespace
 * ------------------------------------------------------------------ */

/**
 * Everything measured from the geometry, in one place.
 *
 * ARCHITECTURAL RULE: intent and measurement never share a field. Authored
 * intent is persisted on the blueprint (`gravity_intent`, and later
 * `balance_intent`, `density_intent`, `movement_intent`). Measurements live
 * here, are computed on demand, and are never written back to the blueprint —
 * so an authored concept and a measured number can never be mistaken for two
 * versions of the same truth.
 *
 * PROVISIONAL / UNCALIBRATED. These are engineering models, not calibrated
 * measures of what an eye perceives. EC-GEO-001 and the calibration work own
 * the measures that eventually replace them; until then nothing here carries a
 * verdict, only a number.
 */
export function geometryMetrics(bp) {
  const zones = restZones(bp);
  return {
    calibration: 'provisional',
    composition_gravity: compositionGravity(bp),
    rest: {
      zones,
      total_deg: zones.reduce((sum, zone) => sum + zone.span, 0),
      largest_deg: zones.reduce((max, zone) => Math.max(max, zone.span), 0),
    },
    presence: Object.fromEntries(bp.objects.map((obj) => [obj.id, presenceOf(obj)])),
  };
}
