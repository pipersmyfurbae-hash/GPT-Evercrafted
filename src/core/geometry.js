/**
 * Geometry primitives for the Evercrafted Placement Engine.
 *
 * ANGLE CONVENTION (used everywhere in this codebase):
 *   - Angles are degrees, measured CLOCKWISE from 12 o'clock.
 *   - 12 o'clock = 0deg, 3 o'clock = 90deg, 6 o'clock = 180deg, 9 o'clock = 270deg.
 *   - Screen projection is x = cx + r*sin(t), y = cy - r*cos(t), so increasing
 *     degrees move clockwise on screen, matching the direction a clock hand travels.
 *   - Degrees are the ONLY stored unit. Clock notation is a display/input format.
 *     See CONFLICTS.md C-08.
 *
 * This module is pure: no DOM, no state. It is unit tested directly.
 */

export const DEG_PER_HOUR = 30;
const EPS = 1e-9;

/* ------------------------------------------------------------------ *
 * Angle normalisation
 * ------------------------------------------------------------------ */

/** Normalise any angle into [0, 360). */
export function normDeg(deg) {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

/** Smallest signed rotation from `a` to `b`, in (-180, 180]. */
export function signedDelta(a, b) {
  let d = normDeg(b) - normDeg(a);
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/* ------------------------------------------------------------------ *
 * Clock notation <-> degrees
 * ------------------------------------------------------------------ */

/** Clock hour (may be fractional, e.g. 7.5) -> degrees clockwise from 12. */
export function clockToDeg(hour) {
  return normDeg(hour * DEG_PER_HOUR);
}

/** Degrees -> clock hour in (0, 12], so 0deg reads as 12 o'clock rather than 0. */
export function degToClock(deg) {
  const h = normDeg(deg) / DEG_PER_HOUR;
  return h === 0 ? 12 : h;
}

/** Degrees -> "7:30" style label, rounded to the nearest minute. */
export function formatClock(deg) {
  const raw = normDeg(deg) / DEG_PER_HOUR;
  let hours = Math.floor(raw);
  let minutes = Math.round((raw - hours) * 60);
  if (minutes === 60) {
    minutes = 0;
    hours += 1;
  }
  if (hours === 0 || hours === 12) hours = 12;
  else hours = hours % 12;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Parse "7", "7:30", "7.5" into degrees. Returns null when unparseable so
 * callers can reject the edit rather than silently writing NaN into a blueprint.
 */
export function parseClock(text) {
  if (typeof text === 'number' && Number.isFinite(text)) return clockToDeg(text);
  if (typeof text !== 'string') return null;
  const s = text.trim();
  if (!s) return null;

  const colon = s.match(/^(\d{1,2})\s*:\s*(\d{1,2})$/);
  if (colon) {
    const h = Number(colon[1]);
    const m = Number(colon[2]);
    if (h > 12 || m > 59) return null;
    return clockToDeg(h + m / 60);
  }

  const decimal = s.match(/^(\d{1,2}(?:\.\d+)?)$/);
  if (decimal) {
    const h = Number(decimal[1]);
    if (h > 12) return null;
    return clockToDeg(h);
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Arc ranges
 *
 * A range is { start, span }: begins at `start` degrees and extends `span`
 * degrees CLOCKWISE. span is always in [0, 360].
 * ------------------------------------------------------------------ */

export function clampSpan(span) {
  if (!Number.isFinite(span) || span <= 0) return 0;
  return Math.min(span, 360);
}

/** End angle of a range. */
export function rangeEnd(range) {
  return normDeg(range.start + range.span);
}

/** Build a range from a centre angle and a total width. */
export function rangeFromCenter(centerDeg, spanDeg) {
  const span = clampSpan(spanDeg);
  return { start: normDeg(centerDeg - span / 2), span };
}

/** Is `deg` inside `range` (inclusive of both edges)? */
export function angleInRange(deg, range) {
  if (range.span >= 360) return true;
  if (range.span <= 0) return false;
  const rel = normDeg(deg - range.start);
  return rel <= range.span + EPS;
}

/** Is `inner` entirely contained by `outer`? */
export function rangeContains(outer, inner) {
  if (outer.span >= 360) return true;
  if (inner.span <= 0) return angleInRange(inner.start, outer);
  const relStart = normDeg(inner.start - outer.start);
  return relStart + inner.span <= outer.span + EPS;
}

/** Degrees of overlap between two ranges. */
export function rangeOverlap(a, b) {
  if (a.span <= 0 || b.span <= 0) return 0;
  if (a.span >= 360) return b.span;
  if (b.span >= 360) return a.span;

  // Work in a frame where a.start = 0; b then occupies [rel, rel + b.span],
  // and its wrapped copy [rel - 360, rel + b.span - 360].
  const rel = normDeg(b.start - a.start);
  let total = 0;
  for (const bStart of [rel, rel - 360]) {
    const lo = Math.max(0, bStart);
    const hi = Math.min(a.span, bStart + b.span);
    if (hi > lo) total += hi - lo;
  }
  return total;
}

/**
 * Subtract `hole` from `range`, returning 0, 1 or 2 surviving ranges.
 *
 * This is what carves the hardware clearance out of the anchor mass so the
 * anchor renders as two sub-sectors either side of the bow. See CONFLICTS.md C-03.
 */
export function subtractArc(range, hole) {
  if (!range || range.span <= 0) return [];
  if (!hole || hole.span <= 0) return [{ ...range }];
  if (hole.span >= 360) return [];

  const rel = normDeg(hole.start - range.start);
  // Both the hole and its wrapped copy can bite into [0, range.span].
  const cuts = [
    [rel, rel + hole.span],
    [rel - 360, rel + hole.span - 360],
  ];

  let segments = [[0, range.span]];
  for (const [holeLo, holeHi] of cuts) {
    const next = [];
    for (const [lo, hi] of segments) {
      if (holeHi <= lo + EPS || holeLo >= hi - EPS) {
        next.push([lo, hi]);
        continue;
      }
      if (holeLo > lo + EPS) next.push([lo, Math.min(holeLo, hi)]);
      if (holeHi < hi - EPS) next.push([Math.max(holeHi, lo), hi]);
    }
    segments = next;
  }

  return segments
    .filter(([lo, hi]) => hi - lo > EPS)
    .map(([lo, hi]) => ({ start: normDeg(range.start + lo), span: hi - lo }));
}

/** Subtract several holes in turn. */
export function subtractArcs(range, holes) {
  let result = [{ ...range }];
  for (const hole of holes) {
    result = result.flatMap((seg) => subtractArc(seg, hole));
  }
  return result;
}

/** Merge overlapping/adjacent ranges into a minimal covering set. */
export function mergeRanges(ranges) {
  const live = ranges.filter((r) => r && r.span > EPS);
  if (!live.length) return [];
  if (live.some((r) => r.span >= 360 - EPS)) return [{ start: 0, span: 360 }];

  // Split every range at the 0/360 seam so plain interval merging works.
  const flat = [];
  for (const r of live) {
    const start = normDeg(r.start);
    const end = start + r.span;
    if (end <= 360 + EPS) {
      flat.push([start, Math.min(end, 360)]);
    } else {
      flat.push([start, 360]);
      flat.push([0, end - 360]);
    }
  }
  flat.sort((a, b) => a[0] - b[0]);

  const merged = [];
  for (const [lo, hi] of flat) {
    const last = merged[merged.length - 1];
    if (last && lo <= last[1] + EPS) last[1] = Math.max(last[1], hi);
    else merged.push([lo, hi]);
  }

  // Re-join across the seam if the set wraps.
  if (
    merged.length > 1 &&
    merged[0][0] <= EPS &&
    merged[merged.length - 1][1] >= 360 - EPS
  ) {
    const first = merged.shift();
    const last = merged[merged.length - 1];
    last[1] += first[1];
  }

  if (merged.length === 1 && merged[0][1] - merged[0][0] >= 360 - EPS) {
    return [{ start: 0, span: 360 }];
  }
  return merged.map(([lo, hi]) => ({ start: normDeg(lo), span: hi - lo }));
}

/** The complement of a set of ranges on the full circle. */
export function complementRanges(ranges) {
  const covered = mergeRanges(ranges);
  if (!covered.length) return [{ start: 0, span: 360 }];
  if (covered.length === 1 && covered[0].span >= 360 - EPS) return [];

  const gaps = [];
  for (let i = 0; i < covered.length; i += 1) {
    const current = covered[i];
    const next = covered[(i + 1) % covered.length];
    const gapStart = rangeEnd(current);
    const gapSpan = normDeg(next.start - gapStart);
    if (gapSpan > EPS) gaps.push({ start: gapStart, span: gapSpan });
  }
  return gaps;
}

/* ------------------------------------------------------------------ *
 * Cartesian projection and SVG path building
 * ------------------------------------------------------------------ */

/** Polar -> cartesian using the clock convention above. */
export function polar(radius, deg, cx = 0, cy = 0) {
  const rad = (normDeg(deg) * Math.PI) / 180;
  return { x: cx + radius * Math.sin(rad), y: cy - radius * Math.cos(rad) };
}

function fmt(n) {
  return Number(n.toFixed(4));
}

/**
 * SVG path for an annulus sector (a band of ring between two radii, spanning
 * an arc clockwise). Used for the anchor and echo masses.
 *
 * SVG sweep-flag=1 draws clockwise on screen in a y-down coordinate system,
 * which matches our clockwise-positive convention.
 */
export function annulusSectorPath(rInner, rOuter, range, cx = 0, cy = 0) {
  const span = clampSpan(range.span);
  if (span <= 0) return '';

  // A full ring cannot be drawn as one arc command; emit two half-rings.
  if (span >= 360 - EPS) {
    const halfA = annulusSectorPath(rInner, rOuter, { start: range.start, span: 180 }, cx, cy);
    const halfB = annulusSectorPath(
      rInner,
      rOuter,
      { start: normDeg(range.start + 180), span: 180 },
      cx,
      cy,
    );
    return `${halfA} ${halfB}`;
  }

  const start = normDeg(range.start);
  const end = normDeg(start + span);
  const large = span > 180 ? 1 : 0;

  const o1 = polar(rOuter, start, cx, cy);
  const o2 = polar(rOuter, end, cx, cy);
  const i2 = polar(rInner, end, cx, cy);
  const i1 = polar(rInner, start, cx, cy);

  return [
    `M ${fmt(o1.x)} ${fmt(o1.y)}`,
    `A ${fmt(rOuter)} ${fmt(rOuter)} 0 ${large} 1 ${fmt(o2.x)} ${fmt(o2.y)}`,
    `L ${fmt(i2.x)} ${fmt(i2.y)}`,
    `A ${fmt(rInner)} ${fmt(rInner)} 0 ${large} 0 ${fmt(i1.x)} ${fmt(i1.y)}`,
    'Z',
  ].join(' ');
}

/**
 * Radial thickness of a behaviour path's band, in inches.
 *
 * `band_width_norm` is the fraction of the wreath base's usable radial width the
 * band occupies: 0.3 means the band is 30% as thick as the ring is wide. Because
 * it is normalised, a gesture keeps its proportion when the form is resized.
 *
 * This measures ACROSS the ring. Travel around the ring is `arc_deg`, and the
 * two never mix. See CONFLICTS.md C-04.
 */
export function bandWidthToInches(bandWidthNorm, ringWidthIn) {
  return clamp01(bandWidthNorm) * Math.max(0, ringWidthIn);
}

export function inchesToBandWidth(inches, ringWidthIn) {
  if (ringWidthIn <= 0) return 0;
  return clamp01(Math.max(0, inches) / ringWidthIn);
}

/**
 * Compatibility shim for schema 1.0.0 only.
 *
 * 1.0.0 stored the sweep width as `width_deg` and converted it with
 * `arc_degrees x mean_radius` — an arc length ALONG the ring, wrongly used as
 * thickness ACROSS it. That interpretation was rejected (CONFLICTS.md C-04,
 * REVISED). This reproduces the old arithmetic so blueprints saved under 1.0.0
 * migrate to the band-width model looking exactly as their author left them.
 *
 * Migration only. Never call this from live geometry.
 */
export function legacyWidthDegToInches(widthDeg, meanRadiusIn) {
  return (Math.max(0, widthDeg) * Math.PI) / 180 * meanRadiusIn;
}

/**
 * SVG path for a tapering ribbon following the ring — the primary sweep.
 *
 * The centreline sits at `radialPosition` across the ring band and bows
 * outward/inward by `curvature`, peaking at the midpoint of the path. Width
 * tapers from full at the origin to (1 - taper) at the far end, because
 * EC-GRN-001 GRN-B02 requires a thin readable gesture, "never a hedge of greenery".
 */
export function sweepRibbonPath(opts, cx = 0, cy = 0) {
  const {
    startDeg,
    arcDeg,
    rInner,
    rOuter,
    radialPosition = 0.5,
    curvature = 0,
    thicknessIn,
    taper = 0,
    samples = 96,
  } = opts;

  const span = clampSpan(arcDeg);
  if (span <= 0 || thicknessIn <= 0) return '';

  const ringWidth = rOuter - rInner;
  const baseRadius = rInner + clamp01(radialPosition) * ringWidth;
  // Bow amplitude is capped so extreme curvature cannot push the band off the form.
  const bowAmplitude = ringWidth * 0.5;
  const taperAmount = clamp01(taper);

  const outer = [];
  const inner = [];
  const count = Math.max(8, Math.round(samples));

  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    const deg = startDeg + span * t;
    const bow = curvature * bowAmplitude * Math.sin(Math.PI * t);
    const halfWidth = (thicknessIn * (1 - taperAmount * t)) / 2;

    let radius = baseRadius + bow;
    // Keep the band inside the form even under extreme curvature/width.
    radius = Math.min(Math.max(radius, rInner + halfWidth), rOuter - halfWidth);

    outer.push(polar(radius + halfWidth, deg, cx, cy));
    inner.push(polar(radius - halfWidth, deg, cx, cy));
  }

  const parts = [`M ${fmt(outer[0].x)} ${fmt(outer[0].y)}`];
  for (let i = 1; i < outer.length; i += 1) parts.push(`L ${fmt(outer[i].x)} ${fmt(outer[i].y)}`);
  for (let i = inner.length - 1; i >= 0; i -= 1) parts.push(`L ${fmt(inner[i].x)} ${fmt(inner[i].y)}`);
  parts.push('Z');
  return parts.join(' ');
}

/** Centreline of the sweep, for drag handles and midpoint markers. */
export function sweepCenterline(opts, cx = 0, cy = 0) {
  const {
    startDeg,
    arcDeg,
    rInner,
    rOuter,
    radialPosition = 0.5,
    curvature = 0,
    samples = 48,
  } = opts;

  const span = clampSpan(arcDeg);
  const ringWidth = rOuter - rInner;
  const baseRadius = rInner + clamp01(radialPosition) * ringWidth;
  const bowAmplitude = ringWidth * 0.5;
  const points = [];
  const count = Math.max(4, Math.round(samples));

  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    const deg = startDeg + span * t;
    const radius = baseRadius + curvature * bowAmplitude * Math.sin(Math.PI * t);
    points.push({ ...polar(radius, deg, cx, cy), deg, radius, t });
  }
  return points;
}

/** Radius of the sweep centreline at parameter t along the path. */
export function sweepRadiusAt(opts, t) {
  const { rInner, rOuter, radialPosition = 0.5, curvature = 0 } = opts;
  const ringWidth = rOuter - rInner;
  const baseRadius = rInner + clamp01(radialPosition) * ringWidth;
  return baseRadius + curvature * ringWidth * 0.5 * Math.sin(Math.PI * t);
}

export function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Angle of a point relative to a centre, in the clock convention. */
export function angleOfPoint(x, y, cx = 0, cy = 0) {
  return normDeg((Math.atan2(x - cx, cy - y) * 180) / Math.PI);
}

export function radiusOfPoint(x, y, cx = 0, cy = 0) {
  return Math.hypot(x - cx, y - cy);
}

/** Snap an angle to the nearest increment (used for shift-drag). */
export function snapDeg(deg, increment) {
  if (!increment || increment <= 0) return normDeg(deg);
  return normDeg(Math.round(deg / increment) * increment);
}
