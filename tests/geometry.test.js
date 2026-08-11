import test from 'node:test';
import assert from 'node:assert/strict';

import {
  angleInRange,
  annulusSectorPath,
  clockToDeg,
  complementRanges,
  degToClock,
  formatClock,
  inchesToWidthDeg,
  mergeRanges,
  normDeg,
  parseClock,
  polar,
  angleOfPoint,
  rangeContains,
  rangeFromCenter,
  rangeOverlap,
  signedDelta,
  snapDeg,
  subtractArc,
  subtractArcs,
  sweepRibbonPath,
  widthDegToInches,
} from '../src/core/geometry.js';

const close = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) < tol, `expected ${a} to be within ${tol} of ${b}`);

test('normDeg wraps into [0, 360)', () => {
  close(normDeg(0), 0);
  close(normDeg(360), 0);
  close(normDeg(-90), 270);
  close(normDeg(725), 5);
});

test('signedDelta returns the shortest rotation', () => {
  close(signedDelta(0, 90), 90);
  close(signedDelta(0, 270), -90);
  close(signedDelta(350, 10), 20);
  close(signedDelta(10, 350), -20);
  // The canonical anchor-to-echo relationship: 8 o'clock -> 5 o'clock.
  close(signedDelta(240, 150), -90);
});

test('clock notation maps onto the clockwise-from-12 convention', () => {
  close(clockToDeg(12), 0);
  close(clockToDeg(3), 90);
  close(clockToDeg(6), 180);
  close(clockToDeg(9), 270);
  close(clockToDeg(7), 210);
  close(degToClock(270), 9);
  close(degToClock(0), 12);
  assert.equal(formatClock(210), '7:00');
  assert.equal(formatClock(225), '7:30');
  assert.equal(formatClock(0), '12:00');
  assert.equal(formatClock(150), '5:00');
  assert.equal(formatClock(45), '1:30');
});

test('formatClock rolls minutes without producing 13:00 or 0:00', () => {
  assert.equal(formatClock(359.9), '12:00');
  assert.equal(formatClock(29.9), '1:00');
});

test('parseClock accepts hours, decimals and h:mm, and rejects nonsense', () => {
  close(parseClock('7'), 210);
  close(parseClock('7:30'), 225);
  close(parseClock('7.5'), 225);
  close(parseClock('12'), 0);
  assert.equal(parseClock('13'), null);
  assert.equal(parseClock('7:75'), null);
  assert.equal(parseClock('half past'), null);
  assert.equal(parseClock(''), null);
});

test('polar projects 12 o clock up and 3 o clock right in screen space', () => {
  const top = polar(10, 0);
  close(top.x, 0);
  close(top.y, -10);

  const right = polar(10, 90);
  close(right.x, 10);
  close(right.y, 0);

  const bottom = polar(10, 180);
  close(bottom.y, 10);

  const left = polar(10, 270);
  close(left.x, -10);
});

test('angleOfPoint inverts polar', () => {
  for (const deg of [0, 37, 90, 150, 210, 270, 333]) {
    const point = polar(7, deg);
    close(angleOfPoint(point.x, point.y), deg, 1e-6);
  }
});

test('rangeOverlap handles the wrap seam', () => {
  close(rangeOverlap({ start: 350, span: 40 }, { start: 0, span: 20 }), 20);
  close(rangeOverlap({ start: 0, span: 60 }, { start: 100, span: 20 }), 0);
  close(rangeOverlap({ start: 210, span: 60 }, { start: 229, span: 22 }), 22);
  close(rangeOverlap({ start: 340, span: 40 }, { start: 350, span: 40 }), 30);
});

test('rangeContains recognises the clearance sitting inside the anchor', () => {
  assert.ok(rangeContains({ start: 210, span: 60 }, { start: 229, span: 22 }));
  assert.ok(!rangeContains({ start: 210, span: 60 }, { start: 260, span: 22 }));
  // Wrapping outer range.
  assert.ok(rangeContains({ start: 340, span: 60 }, { start: 350, span: 20 }));
});

test('subtractArc carves the clearance out of the anchor as two sub-sectors', () => {
  const anchor = { start: 210, span: 60 };
  const clearance = { start: 229, span: 22 };
  const segments = subtractArc(anchor, clearance);

  assert.equal(segments.length, 2);
  close(segments[0].start, 210);
  close(segments[0].span, 19);
  close(segments[1].start, 251);
  close(segments[1].span, 19);
});

test('subtractArc returns one segment when the hole touches an edge', () => {
  const segments = subtractArc({ start: 210, span: 60 }, { start: 210, span: 20 });
  assert.equal(segments.length, 1);
  close(segments[0].start, 230);
  close(segments[0].span, 40);
});

test('subtractArc handles a hole that wraps across 0 degrees', () => {
  const segments = subtractArc({ start: 340, span: 60 }, { start: 350, span: 30 });
  assert.equal(segments.length, 2);
  close(segments[0].start, 340);
  close(segments[0].span, 10);
  close(segments[1].start, 20);
  close(segments[1].span, 20);
});

test('subtractArc removes the range entirely when swallowed', () => {
  assert.deepEqual(subtractArc({ start: 10, span: 20 }, { start: 0, span: 60 }), []);
});

test('subtractArcs applies several holes', () => {
  const segments = subtractArcs({ start: 0, span: 360 }, [
    { start: 0, span: 30 },
    { start: 90, span: 30 },
  ]);
  const totalSpan = segments.reduce((sum, s) => sum + s.span, 0);
  close(totalSpan, 300);
});

test('mergeRanges joins contiguous ranges across the seam', () => {
  const merged = mergeRanges([
    { start: 210, span: 60 },
    { start: 270, span: 135 },
    { start: 133, span: 34 },
  ]);
  assert.equal(merged.length, 2);
  const spans = merged.map((r) => Math.round(r.span)).sort((a, b) => a - b);
  assert.deepEqual(spans, [34, 195]);
});

test('mergeRanges collapses full coverage', () => {
  const merged = mergeRanges([
    { start: 0, span: 180 },
    { start: 180, span: 180 },
  ]);
  assert.equal(merged.length, 1);
  close(merged[0].span, 360);
});

test('complementRanges finds the rest zones of the default composition', () => {
  const gaps = complementRanges([
    { start: 210, span: 60 }, // anchor
    { start: 270, span: 135 }, // sweep
    { start: 133, span: 34 }, // echo
  ]);

  const total = gaps.reduce((sum, g) => sum + g.span, 0);
  close(total, 131);
  assert.equal(gaps.length, 2);

  const spans = gaps.map((g) => Math.round(g.span)).sort((a, b) => a - b);
  assert.deepEqual(spans, [43, 88]);
});

test('complementRanges returns the whole circle when nothing is placed', () => {
  const gaps = complementRanges([]);
  assert.equal(gaps.length, 1);
  close(gaps[0].span, 360);
});

test('complementRanges returns nothing when the circle is covered', () => {
  assert.deepEqual(complementRanges([{ start: 0, span: 360 }]), []);
});

test('angleInRange respects wrapping', () => {
  assert.ok(angleInRange(240, { start: 210, span: 60 }));
  assert.ok(!angleInRange(150, { start: 210, span: 60 }));
  assert.ok(angleInRange(5, { start: 350, span: 30 }));
});

test('rangeFromCenter centres a span', () => {
  const range = rangeFromCenter(150, 34);
  close(range.start, 133);
  close(range.span, 34);
});

test('sweep width converts between degrees and inches at the mean radius', () => {
  // Default form: 24 in diameter, 5 in ring -> mean radius 9.5 in.
  close(widthDegToInches(15, 9.5), 2.4870941840919194, 1e-9);
  close(inchesToWidthDeg(widthDegToInches(15, 9.5), 9.5), 15, 1e-9);
});

test('snapDeg snaps to half-hour increments', () => {
  close(snapDeg(217, 15), 210);
  close(snapDeg(223, 15), 225);
  close(snapDeg(358, 15), 0);
});

test('annulusSectorPath emits a closed path with both arcs', () => {
  const path = annulusSectorPath(7, 12, { start: 210, span: 60 });
  assert.match(path, /^M /);
  assert.match(path, /Z$/);
  assert.equal((path.match(/A /g) ?? []).length, 2);
  // Clockwise outer arc, counter-clockwise inner return.
  assert.match(path, /0 0 1 /);
  assert.match(path, /0 0 0 /);
});

test('annulusSectorPath sets the large-arc flag past 180 degrees', () => {
  const path = annulusSectorPath(7, 12, { start: 0, span: 200 });
  assert.match(path, /0 1 1 /);
});

test('annulusSectorPath draws a full ring as two halves', () => {
  const path = annulusSectorPath(7, 12, { start: 0, span: 360 });
  assert.equal((path.match(/M /g) ?? []).length, 2);
});

test('annulusSectorPath and sweepRibbonPath return empty for zero span', () => {
  assert.equal(annulusSectorPath(7, 12, { start: 0, span: 0 }), '');
  assert.equal(
    sweepRibbonPath({ startDeg: 0, arcDeg: 0, rInner: 7, rOuter: 12, thicknessIn: 2 }),
    '',
  );
});

test('sweepRibbonPath stays inside the ring even at extreme curvature and width', () => {
  const path = sweepRibbonPath({
    startDeg: 270,
    arcDeg: 135,
    rInner: 7,
    rOuter: 12,
    radialPosition: 0.5,
    curvature: 1,
    thicknessIn: 4.5,
    taper: 0,
    samples: 64,
  });

  const coords = path
    .replace(/[MLZ]/g, ' ')
    .trim()
    .split(/\s+/)
    .map(Number)
    .filter(Number.isFinite);

  for (let i = 0; i < coords.length; i += 2) {
    const radius = Math.hypot(coords[i], coords[i + 1]);
    assert.ok(radius <= 12.001, `point at radius ${radius} escaped the outer edge`);
    assert.ok(radius >= 6.999, `point at radius ${radius} escaped the inner edge`);
  }
});
