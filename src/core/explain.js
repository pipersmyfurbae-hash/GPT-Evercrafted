/**
 * Explainability engine.
 *
 * The Placement Engine Spec requires that clicking an object answers five
 * questions: What is this? What role does it serve? Why is it here? Which canon
 * rule caused or supports this decision? What downstream elements depend on it?
 *
 * Explanations are GENERATED FROM CURRENT STATE on every read rather than stored
 * as text. A stored sentence saying "spans 7:00 to 9:00" becomes a lie the moment
 * the anchor is dragged, and EC-DOS-001 Principle 1 ("every design decision must
 * be explainable") is not served by a stale explanation.
 *
 * An author may override the "why" text. An override is marked as authored, not
 * canon-derived, per EC-DOS-001 Principle 6: a human edit is not automatically a
 * new rule.
 */

import { formatClock, normDeg } from './geometry.js';
import { getAnchor, objectCenter, objectRange, BEHAVIOR_CANON_REF } from './schema.js';
import { bandWidthInches, dependentsOf, parentOf, presenceOf } from './analysis.js';
import { getRules } from './canon.js';

/** Plain-language sector name for an angle, for readable explanations. */
export function describeSector(deg) {
  const d = normDeg(deg);
  if (d >= 337.5 || d < 22.5) return 'top';
  if (d < 67.5) return 'upper right';
  if (d < 112.5) return 'right';
  if (d < 157.5) return 'lower right';
  if (d < 202.5) return 'bottom';
  if (d < 247.5) return 'lower left';
  if (d < 292.5) return 'left';
  return 'upper left';
}

const BEHAVIOR_PURPOSE = {
  cascading: 'Controlled downward movement.',
  sweeping: 'Carry the eye laterally around the wreath form and connect zones.',
  arching: 'Create upward or outward lift and frame open space.',
  bridging: 'Connect two pockets or movements subtly.',
  nesting: 'Cradle a flower or micro-cluster so it feels held and secure.',
  framing: 'Define the edge or boundary of the visual story.',
};

/** Rounding that degrades to "?" rather than throwing on a malformed field. */
const round = (n, places = 1) => {
  const value = Number(n);
  return Number.isFinite(value) ? Number(value.toFixed(places)) : '?';
};

/* ------------------------------------------------------------------ *
 * Per-role explanation builders
 * ------------------------------------------------------------------ */

function explainAnchor(bp, obj) {
  const range = objectRange(obj);
  const center = objectCenter(obj);
  const presence = presenceOf(obj);

  const others = bp.objects
    .filter((o) => o.id !== obj.id && o.kind !== 'clearance')
    .map((o) => ({ label: o.label, presence: presenceOf(o) }))
    .sort((a, b) => b.presence - a.presence);

  const rival = others[0];
  const dominanceLine = rival
    ? `Its visual presence is ${round(presence)} against ${rival.label.toLowerCase()} at ${round(rival.presence)}, so the anchor still reads as the dominant mass.`
    : `Its visual presence is ${round(presence)}.`;

  return {
    what: 'A reserved emotional focal zone — the primary anchor pocket of this composition.',
    role: 'The dominant visual mass, and the point where the eye enters the design.',
    why:
      `The anchor spans ${formatClock(range.start)} to ${formatClock(range.start + range.span)} ` +
      `(${round(range.span)}°), centred at ${formatClock(center)} on the ${describeSector(center)} of the form. ` +
      `EC-COMP-001 requires every design to establish a clear emotional anchor and treats it as the beginning ` +
      `of the eye path, not the entire story — so it is placed first and everything else is positioned in ` +
      `relation to it. ${dominanceLine}`,
    canon: ['COMP.L1', 'COMP.L2', 'SPEC.ANCHOR', 'SPEC.ANCHOR.ONE', 'SPEC.DOMINANT'],
  };
}

function explainClearance(bp, obj) {
  const anchor = parentOf(bp, obj) ?? getAnchor(bp);
  const range = objectRange(obj);
  const anchorRange = anchor ? objectRange(anchor) : null;
  const remaining = anchorRange ? anchorRange.span - range.span : 0;

  return {
    what: `A reserved void carved out of the anchor, held clear for ${obj.purpose ?? 'hardware'}.`,
    role: 'Keeps physical hardware from competing with botanical mass — or from being buried by it.',
    why:
      `Centred at ${formatClock(objectCenter(obj))} and ${round(range.span)}° wide, cut out of the ` +
      `${anchorRange ? round(anchorRange.span) : '?'}° anchor arc, leaving ${round(remaining)}° of anchor mass ` +
      `split either side of it. The spec reserves hardware clearance as its own step immediately after the ` +
      `anchor, and the anchor's own definition notes it "may also require clearance for ribbon, bow, or other ` +
      `focal hardware". It carries no visual weight of its own: it is space held open, not mass placed.`,
    canon: ['SPEC.HARDWARE', 'SPEC.ANCHOR', 'COMP.L5'],
  };
}

function explainSweep(bp, obj) {
  const range = objectRange(obj);
  const anchor = parentOf(bp, obj) ?? getAnchor(bp);
  const thicknessIn = bandWidthInches(obj, bp.base);
  const fraction = obj.band_width_norm ?? 0;
  const behaviorRule = BEHAVIOR_CANON_REF[obj.behavior_type] ?? 'GRN.B02';

  const origin = anchor
    ? `begins at ${formatClock(range.start)}, the anchor's ${obj.link?.edge === 'trailing' ? 'trailing' : 'leading'} edge`
    : `begins at ${formatClock(range.start)}`;

  const taperNote = obj.taper > 0.02
    ? ` It narrows to ${round((1 - obj.taper) * 100, 0)}% of its starting width along the travel, so it reads as a gesture leaving the anchor rather than a band wrapped around the form.`
    : '';

  return {
    what: `A greenery behaviour path set to "${obj.behavior_type}".`,
    role: BEHAVIOR_PURPOSE[obj.behavior_type] ?? 'Carry movement through the composition.',
    why:
      `The path ${origin}, and travels ${round(range.span)}° clockwise to ${formatClock(range.start + range.span)} ` +
      `across the ${describeSector(objectCenter(obj))} of the form. EC-GRN-001 establishes greenery architecture ` +
      `before floral placement — this path is the movement florals will later reinforce, not decoration in its ` +
      `own right. Its band is ${round(thicknessIn, 2)} in thick across the ring — ${round(fraction * 100, 0)}% ` +
      `of the base band width — while travelling ${round(range.span)}° around it.${taperNote}`,
    canon: ['GRN.L1', 'GRN.L2', 'GRN.L7', behaviorRule, 'SPEC.SWEEP', 'COMP.L3'],
  };
}

function explainEcho(bp, obj) {
  const anchor = parentOf(bp, obj) ?? getAnchor(bp);
  const center = objectCenter(obj);
  const presence = presenceOf(obj);
  const anchorPresence = anchor ? presenceOf(anchor) : 0;
  const ratio = anchorPresence > 0 ? presence / anchorPresence : 0;

  const separation = Math.abs(obj.link?.offset_deg ?? 0);
  const mirrorNote =
    separation > 150 && separation < 210
      ? ' Note that at roughly 180° from the anchor this is currently sitting as a mirror rather than an echo, which the spec asks it not to be.'
      : ' It sits away from the anchor rather than opposite it, so the repetition reads as an echo rather than a mirror.';

  return {
    what: 'A secondary echo pocket — a lighter answer to the anchor.',
    role: 'Balances the anchor without becoming a second focal area.',
    why:
      `Placed at ${formatClock(center)} on the ${describeSector(center)} of the form, ` +
      `${round(separation)}° from the anchor centre at ${anchor ? formatClock(objectCenter(anchor)) : '?'}. ` +
      `It carries ${round(presence)} of visual presence against the anchor's ${round(anchorPresence)} — ` +
      `${round(ratio * 100, 0)}% — so it counterweights the dominant mass without rivalling it. ` +
      `It may repeat the focal colour and species at lower weight to create cohesion.${mirrorNote}`,
    canon: ['SPEC.ECHO', 'SPEC.BALANCE', 'SPEC.DOMINANT', 'COMP.L10', 'COMP.BALANCE'],
  };
}

const BUILDERS = {
  primary_anchor: explainAnchor,
  hardware_clearance: explainClearance,
  primary_sweep: explainSweep,
  secondary_echo: explainEcho,
};

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/**
 * Full explainability record for one object — the spec's five questions, plus
 * the author's optional "why I changed this" note.
 */
export function explainObject(bp, obj) {
  if (!obj) return null;

  const builder = BUILDERS[obj.role];
  const generated = builder
    ? builder(bp, obj)
    : {
        what: obj.label ?? obj.role,
        role: 'No generated role description for this object type yet.',
        why: 'This object was not produced by a Sprint 1 generator, so no reasoning was recorded.',
        canon: [],
      };

  const override = obj.explanation?.override;
  const isOverridden = typeof override === 'string' && override.trim().length > 0;

  const parent = parentOf(bp, obj);
  const dependents = dependentsOf(bp, obj.id);

  return {
    id: obj.id,
    label: obj.label,
    what: generated.what,
    role: generated.role,
    why: isOverridden ? override.trim() : generated.why,
    // Kept alongside an override so the engine's reasoning is never destroyed by
    // an edit — EC-DOS-001 Principle 6.
    engineWhy: generated.why,
    source: isOverridden ? 'authored' : 'engine',
    canonRules: getRules(generated.canon),
    dependsOn: [
      { id: 'base', label: `Wreath base (${bp.base.diameter_in} in)` },
      ...(parent ? [{ id: parent.id, label: parent.label, relationship: describeLink(obj) }] : []),
    ],
    dependents: dependents.map((d) => ({
      id: d.id,
      label: d.label,
      relationship: describeLink(d),
    })),
    authorNote: obj.explanation?.author_note ?? '',
  };
}

/** Human-readable description of an object's link to its parent. */
export function describeLink(obj) {
  if (!obj?.link) return 'Positioned absolutely.';
  const offset = obj.link.offset_deg ?? 0;
  const magnitude = Math.abs(round(offset));
  const direction = offset === 0 ? '' : offset > 0 ? ' clockwise' : ' counter-clockwise';

  switch (obj.link.mode) {
    case 'centered_in_anchor':
      return offset === 0
        ? 'Centred in the anchor.'
        : `Offset ${magnitude}°${direction} from the anchor centre.`;
    case 'offset_from_anchor':
      return `Held ${magnitude}°${direction} from the anchor centre.`;
    case 'from_anchor_edge':
      return offset === 0
        ? `Starts at the anchor's ${obj.link.edge ?? 'leading'} edge.`
        : `Starts ${magnitude}°${direction} of the anchor's ${obj.link.edge ?? 'leading'} edge.`;
    default:
      return 'Positioned absolutely.';
  }
}

/**
 * Short one-line reason, for the layers panel and canvas tooltips.
 * The spec's own worked example is an echo sentence of roughly this shape.
 */
export function shortReason(bp, obj) {
  switch (obj.role) {
    case 'primary_anchor':
      return `Dominant focal mass at ${formatClock(objectCenter(obj))}; the eye enters here.`;
    case 'hardware_clearance':
      return `Space held open for ${obj.purpose ?? 'hardware'} inside the anchor.`;
    case 'primary_sweep':
      return `Carries movement ${Math.round(objectRange(obj).span)}° from the anchor.`;
    case 'secondary_echo': {
      const anchor = getAnchor(bp);
      const ratio = anchor ? presenceOf(obj) / (presenceOf(anchor) || 1) : 0;
      return `Counterweight at ${formatClock(objectCenter(obj))}, ${Math.round(ratio * 100)}% of anchor weight.`;
    }
    default:
      return obj.label ?? obj.role;
  }
}

