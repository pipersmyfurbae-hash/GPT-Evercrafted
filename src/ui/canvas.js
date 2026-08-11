/**
 * Interactive blueprint canvas.
 *
 * SVG rather than <canvas>: every object is a real node, so hit testing, focus,
 * and styling come for free, and the drawing stays crisp at any zoom. Scene
 * coordinates are INCHES — a 24 in wreath is 24 units across — so the numbers in
 * the DOM match the numbers in the inspector.
 *
 * The scene is rebuilt wholesale on each render. It is a few dozen nodes, and
 * rebuilding removes any chance of the drawing disagreeing with the blueprint.
 * Drag state therefore lives on the SVG root, which is never rebuilt.
 */

import { s, clear } from './dom.js';
import {
  angleOfPoint,
  annulusSectorPath,
  clamp,
  formatClock,
  normDeg,
  polar,
  radiusOfPoint,
  signedDelta,
  snapDeg,
  sweepCenterline,
  sweepRibbonPath,
} from '../core/geometry.js';
import { baseRadii, byId, objectCenter, objectRange } from '../core/schema.js';
import {
  anchorSegments,
  clearanceRadii,
  compositionGravity,
  pocketRadii,
  restZones,
  sweepGeometry,
} from '../core/analysis.js';
import {
  setAnchorArc,
  setArcWidth,
  setCurvature,
  setLinkedPosition,
  setPathTravel,
} from '../core/actions.js';

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 8;
const HANDLE_R = 0.42; // inches
const VIEW_HALF = 17; // inches of viewBox half-extent

/** Draw order. Higher sits on top. */
function zIndexOf(obj) {
  if (obj.kind === 'clearance') return 40;
  if (obj.role === 'primary_anchor') return 30;
  if (obj.role === 'secondary_echo') return 25;
  if (obj.kind === 'behavior_path') {
    if (obj.depth_band === 'forward') return 35;
    if (obj.depth_band === 'receding') return 10;
    return 20;
  }
  return 15;
}

export function createCanvas({ mount, getState, onEdit, onSelect, onView, onHover }) {
  const svg = s('svg', {
    class: 'canvas',
    viewBox: `${-VIEW_HALF} ${-VIEW_HALF} ${VIEW_HALF * 2} ${VIEW_HALF * 2}`,
    preserveAspectRatio: 'xMidYMid meet',
    tabindex: '0',
    'aria-label': 'Wreath blueprint canvas',
  });

  const defs = s('defs', {}, s('pattern', {
    id: 'ec-hatch',
    width: '1.1',
    height: '1.1',
    patternUnits: 'userSpaceOnUse',
    patternTransform: 'rotate(45)',
  }, s('line', { x1: 0, y1: 0, x2: 0, y2: 1.1, class: 'hatch-line' })));

  const scene = s('g', { class: 'scene' });
  svg.append(defs, scene);
  clear(mount).appendChild(svg);

  /* ---------------- coordinate helpers ---------------- */

  const toViewBox = (event) => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
    return { x: point.x, y: point.y };
  };

  const toScene = (event) => {
    const ctm = scene.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
    return { x: point.x, y: point.y };
  };

  /* ---------------- drag state ---------------- */

  let drag = null;
  let readout = null;

  function setReadout(text, sceneX, sceneY) {
    if (!readout) return;
    if (!text) {
      readout.setAttribute('opacity', '0');
      return;
    }
    readout.setAttribute('opacity', '1');
    readout.setAttribute('transform', `translate(${sceneX} ${sceneY})`);
    const label = readout.querySelector('.readout-text');
    const box = readout.querySelector('.readout-box');
    label.textContent = text;
    const width = Math.max(3.4, text.length * 0.62);
    box.setAttribute('x', -width / 2);
    box.setAttribute('width', width);
  }

  /* ---------------- rendering ---------------- */

  function render() {
    const { blueprint, selectedId, hoverId } = getState();
    const view = blueprint.view ?? {};
    const zoom = clamp(view.zoom ?? 1, MIN_ZOOM, MAX_ZOOM);

    scene.setAttribute('transform', `translate(${view.pan_x ?? 0} ${view.pan_y ?? 0}) scale(${zoom})`);
    clear(scene);

    const { rInner, rOuter, rMean } = baseRadii(blueprint.base);

    // Base first: its fill is opaque, so anything drawn before it is hidden.
    if (blueprint.base.visible !== false) scene.appendChild(drawBase(blueprint, rInner, rOuter));
    if (view.rest_zones) scene.appendChild(drawRestZones(blueprint, rInner, rOuter));
    if (view.clock_overlay) scene.appendChild(drawClockOverlay(rInner, rOuter));

    const drawn = blueprint.objects
      .filter((obj) => obj.visible !== false)
      .map((obj) => ({ obj, z: zIndexOf(obj) }))
      .sort((a, b) => a.z - b.z);

    for (const { obj } of drawn) {
      const node = drawObject(blueprint, obj, selectedId === obj.id, hoverId === obj.id);
      if (node) scene.appendChild(node);
    }

    if (view.gravity_marker) scene.appendChild(drawGravity(blueprint, rInner));

    const selected = selectedId ? byId(blueprint, selectedId) : null;
    if (selected && selected.visible !== false && !selected.locked) {
      scene.appendChild(drawHandles(blueprint, selected, rInner, rOuter, rMean));
    }
    if (selected) scene.appendChild(drawSelectionLabel(blueprint, selected));

    readout = s('g', { class: 'readout', opacity: '0', 'pointer-events': 'none' },
      s('rect', { class: 'readout-box', x: -3, y: -1.05, width: 6, height: 2.1, rx: 0.42 }),
      s('text', { class: 'readout-text', x: 0, y: 0.02, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }));
    scene.appendChild(readout);
  }

  /* ---------------- scene pieces ---------------- */

  function drawBase(bp, rInner, rOuter) {
    const group = s('g', { class: 'layer layer-base' });
    group.appendChild(s('circle', { class: 'base-fill', cx: 0, cy: 0, r: rOuter }));
    group.appendChild(s('circle', { class: 'base-hole', cx: 0, cy: 0, r: rInner }));
    group.appendChild(s('circle', { class: 'base-edge', cx: 0, cy: 0, r: rOuter }));
    group.appendChild(s('circle', { class: 'base-edge', cx: 0, cy: 0, r: rInner }));
    group.appendChild(s('circle', { class: 'base-mid', cx: 0, cy: 0, r: (rInner + rOuter) / 2 }));
    group.appendChild(s('circle', { class: 'base-centre', cx: 0, cy: 0, r: 0.12 }));
    return group;
  }

  function drawClockOverlay(rInner, rOuter) {
    const group = s('g', { class: 'layer layer-clock', 'pointer-events': 'none' });

    for (let half = 0; half < 24; half += 1) {
      const deg = half * 15;
      const isHour = half % 2 === 0;
      const from = polar(rOuter + (isHour ? 0.3 : 0.3), deg);
      const to = polar(rOuter + (isHour ? 1.25 : 0.75), deg);
      group.appendChild(s('line', {
        class: isHour ? 'clock-tick clock-tick-hour' : 'clock-tick',
        x1: from.x, y1: from.y, x2: to.x, y2: to.y,
      }));

      if (isHour) {
        const inner = polar(rInner, deg);
        const outer = polar(rOuter, deg);
        group.appendChild(s('line', {
          class: 'clock-spoke', x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y,
        }));
      }
    }

    for (let hour = 1; hour <= 12; hour += 1) {
      const point = polar(rOuter + 2.5, hour * 30);
      group.appendChild(s('text', {
        class: `clock-numeral${hour % 3 === 0 ? ' clock-numeral-major' : ''}`,
        x: point.x, y: point.y,
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        text: String(hour),
      }));
    }
    return group;
  }

  function drawRestZones(bp, rInner, rOuter) {
    const group = s('g', { class: 'layer layer-rest', 'pointer-events': 'none' });
    for (const zone of restZones(bp)) {
      group.appendChild(s('path', {
        class: 'rest-zone',
        d: annulusSectorPath(rInner - 0.35, rOuter + 0.35, zone),
      }));
      if (zone.span >= 14) {
        const point = polar((rInner + rOuter) / 2, zone.center);
        group.appendChild(s('text', {
          class: 'rest-label', x: point.x, y: point.y,
          'text-anchor': 'middle', 'dominant-baseline': 'central',
          text: `${Math.round(zone.span)}°`,
        }));
      }
    }
    return group;
  }

  function drawObject(bp, obj, isSelected, isHovered) {
    const state = [isSelected && 'is-selected', isHovered && 'is-hovered', obj.locked && 'is-locked']
      .filter(Boolean)
      .join(' ');

    if (obj.role === 'primary_anchor') return drawAnchor(bp, obj, state);
    if (obj.kind === 'clearance') return drawClearance(bp, obj, state);
    if (obj.kind === 'behavior_path') return drawSweep(bp, obj, state);
    if (obj.kind === 'pocket') return drawPocket(bp, obj, state);
    return null;
  }

  function drawAnchor(bp, obj, state) {
    const group = s('g', { class: `layer object object-anchor ${state}`, dataset: { objectId: obj.id } });
    const radii = pocketRadii(obj, bp.base);
    const full = objectRange(obj);

    // Reserved zone outline — the whole anchor including the clearance it holds open.
    group.appendChild(s('path', {
      class: 'anchor-reserved',
      d: annulusSectorPath(radii.rInnerClamped, radii.rOuterClamped, full),
    }));

    // Actual mass: the anchor arc with the clearance carved out (CONFLICTS.md C-03).
    for (const segment of anchorSegments(bp)) {
      group.appendChild(s('path', {
        class: 'anchor-mass',
        d: annulusSectorPath(radii.rInnerClamped, radii.rOuterClamped, segment),
      }));
    }

    group.appendChild(s('path', {
      class: 'hit-area',
      d: annulusSectorPath(radii.rInnerClamped, radii.rOuterClamped, full),
      dataset: { objectId: obj.id, handle: 'body' },
    }));
    return group;
  }

  function drawPocket(bp, obj, state) {
    const group = s('g', {
      class: `layer object object-${obj.pocket_type ?? 'pocket'} ${state}`,
      dataset: { objectId: obj.id },
    });
    const radii = pocketRadii(obj, bp.base);
    const range = objectRange(obj);
    const path = annulusSectorPath(radii.rInnerClamped, radii.rOuterClamped, range);

    group.appendChild(s('path', { class: 'echo-mass', d: path }));
    group.appendChild(s('path', {
      class: 'hit-area', d: path, dataset: { objectId: obj.id, handle: 'body' },
    }));
    return group;
  }

  function drawSweep(bp, obj, state) {
    const group = s('g', {
      class: `layer object object-sweep depth-${obj.depth_band ?? 'middle'} ${state}`,
      dataset: { objectId: obj.id },
    });
    const geom = sweepGeometry(obj, bp.base);
    const ribbon = sweepRibbonPath(geom);
    const centre = sweepCenterline(geom);

    group.appendChild(s('path', { class: 'sweep-band', d: ribbon }));
    group.appendChild(s('polyline', {
      class: 'sweep-centreline',
      points: centre.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' '),
    }));

    // Direction arrow at the far end, so travel direction is never ambiguous.
    const tip = centre.at(-1);
    const prior = centre.at(-4) ?? centre.at(-2);
    if (tip && prior) {
      const angle = (Math.atan2(tip.y - prior.y, tip.x - prior.x) * 180) / Math.PI;
      group.appendChild(s('path', {
        class: 'sweep-arrow',
        d: 'M 0 0 L -1.05 0.52 L -0.72 0 L -1.05 -0.52 Z',
        transform: `translate(${tip.x} ${tip.y}) rotate(${angle})`,
      }));
    }

    group.appendChild(s('path', {
      class: 'hit-area hit-stroke', d: ribbon,
      dataset: { objectId: obj.id, handle: 'body' },
    }));
    return group;
  }

  function drawClearance(bp, obj, state) {
    const group = s('g', { class: `layer object object-clearance ${state}`, dataset: { objectId: obj.id } });
    const radii = clearanceRadii(obj, bp.base);
    const range = objectRange(obj);
    const path = annulusSectorPath(radii.rInner, radii.rOuter, range);

    group.appendChild(s('path', { class: 'clearance-fill', d: path }));
    group.appendChild(s('path', { class: 'clearance-edge', d: path }));

    const centre = polar((radii.rInner + radii.rOuter) / 2, objectCenter(obj));
    group.appendChild(s('text', {
      class: 'clearance-label', x: centre.x, y: centre.y,
      'text-anchor': 'middle', 'dominant-baseline': 'central',
      text: (obj.purpose ?? 'hardware').toUpperCase(),
    }));

    group.appendChild(s('path', {
      class: 'hit-area', d: path, dataset: { objectId: obj.id, handle: 'body' },
    }));
    return group;
  }

  function drawGravity(bp, rInner) {
    const gravity = compositionGravity(bp);
    const group = s('g', { class: 'layer layer-gravity', 'pointer-events': 'none' });
    if (gravity.total <= 0) return group;

    // Plotted inside the open centre rather than out on the ring: concentration
    // is still read as distance from the middle, but the marker never lands on
    // top of the mass it is describing.
    const point = polar(gravity.concentration * Math.max(1, rInner - 1.2), gravity.deg);
    group.appendChild(s('line', { class: 'gravity-line', x1: 0, y1: 0, x2: point.x, y2: point.y }));
    group.appendChild(s('circle', { class: 'gravity-halo', cx: point.x, cy: point.y, r: 0.85 }));
    group.appendChild(s('circle', { class: 'gravity-dot', cx: point.x, cy: point.y, r: 0.28 }));
    group.appendChild(s('text', {
      class: 'gravity-label',
      x: point.x, y: point.y - 1.55,
      'text-anchor': 'middle',
      text: `gravity ${gravity.concentration.toFixed(2)}`,
    }));
    return group;
  }

  function handleNode(point, kind, objectId, title) {
    const group = s('g', { class: `handle handle-${kind}`, dataset: { objectId, handle: kind } });
    group.appendChild(s('circle', { class: 'handle-hit', cx: point.x, cy: point.y, r: HANDLE_R * 2.4 }));
    group.appendChild(s('circle', { class: 'handle-dot', cx: point.x, cy: point.y, r: HANDLE_R }));
    group.appendChild(s('title', { text: title }));
    return group;
  }

  function drawHandles(bp, obj, rInner, rOuter, rMean) {
    const group = s('g', { class: 'layer layer-handles' });

    if (obj.kind === 'behavior_path') {
      const geom = sweepGeometry(obj, bp.base);
      const centre = sweepCenterline(geom);
      const start = centre[0];
      const end = centre.at(-1);
      const mid = centre[Math.floor(centre.length / 2)];

      group.appendChild(handleNode(start, 'path-start', obj.id, 'Drag to move the start of the path'));
      group.appendChild(handleNode(end, 'path-end', obj.id, 'Drag to change how far the path travels'));
      group.appendChild(handleNode(mid, 'curvature', obj.id, 'Drag in or out to bow the path'));
      return group;
    }

    const range = objectRange(obj);
    const radius = obj.kind === 'clearance'
      ? (clearanceRadii(obj, bp.base).rInner + clearanceRadii(obj, bp.base).rOuter) / 2
      : rMean;

    group.appendChild(handleNode(polar(radius, range.start), 'arc-start', obj.id, 'Drag to move the leading edge'));
    group.appendChild(handleNode(polar(radius, normDeg(range.start + range.span)), 'arc-end', obj.id, 'Drag to move the trailing edge'));
    return group;
  }

  /**
   * Caption for the selected object, pinned to the top-left of the viewBox.
   *
   * Deliberately not placed near the object: a label following the object's
   * angle collides with the clock numerals at exactly the positions the test
   * composition uses. A fixed corner never collides, and it keeps the selection
   * legible on narrow screens where the inspector sits below the canvas.
   */
  function drawSelectionLabel(bp, obj) {
    const text = `${obj.label}${obj.locked ? ' · locked' : ''}`;
    const width = Math.max(6, text.length * 0.62 + 1.4);
    const x = -VIEW_HALF + 0.9;
    const y = -VIEW_HALF + 0.9;

    return s('g', { class: 'selection-label', 'pointer-events': 'none' },
      s('rect', { class: 'selection-label-box', x, y, width, height: 2.1, rx: 0.42 }),
      s('circle', {
        class: `selection-label-dot role-${obj.role}`,
        cx: x + 0.95, cy: y + 1.05, r: 0.34,
      }),
      s('text', {
        class: 'selection-label-text', x: x + 1.75, y: y + 1.08,
        'dominant-baseline': 'central', text,
      }));
  }

  /* ---------------- interaction ---------------- */

  function targetInfo(event) {
    const node = event.target.closest?.('[data-handle], [data-object-id]');
    if (!node) return null;
    return { objectId: node.dataset.objectId ?? null, handle: node.dataset.handle ?? null };
  }

  svg.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.button !== 1) return;
    svg.focus({ preventScroll: true });

    const info = targetInfo(event);
    const state = getState();

    if (!info || event.button === 1) {
      // Empty space: pan, and clear the selection on a click that does not drag.
      drag = {
        kind: 'pan',
        startClient: { x: event.clientX, y: event.clientY },
        startPan: { x: state.blueprint.view.pan_x ?? 0, y: state.blueprint.view.pan_y ?? 0 },
        moved: false,
        wasEmpty: !info,
      };
      svg.setPointerCapture(event.pointerId);
      svg.classList.add('is-panning');
      return;
    }

    const obj = byId(state.blueprint, info.objectId);
    if (!obj) return;

    if (state.selectedId !== obj.id) onSelect(obj.id);

    if (obj.locked) {
      drag = null;
      return;
    }

    const point = toScene(event);
    const pointerDeg = angleOfPoint(point.x, point.y);
    const range = objectRange(obj);

    drag = {
      kind: info.handle ?? 'body',
      objectId: obj.id,
      grabDeg: pointerDeg,
      startRange: { ...range },
      startCurvature: obj.curvature ?? 0,
      moved: false,
    };
    svg.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  svg.addEventListener('pointermove', (event) => {
    const state = getState();

    if (!drag) {
      const info = targetInfo(event);
      const id = info?.objectId ?? null;
      if (id !== state.hoverId) onHover(id);
      return;
    }

    drag.moved = true;

    if (drag.kind === 'pan') {
      const dx = event.clientX - drag.startClient.x;
      const dy = event.clientY - drag.startClient.y;
      const ctm = svg.getScreenCTM();
      const scale = ctm ? ctm.a : 1;
      onView({ pan_x: drag.startPan.x + dx / scale, pan_y: drag.startPan.y + dy / scale });
      return;
    }

    const bp = state.blueprint;
    const obj = byId(bp, drag.objectId);
    if (!obj) return;

    const point = toScene(event);
    const snap = event.shiftKey ? (bp.view.snap_deg || 15) : 0;
    const pointerDeg = snap ? snapDeg(angleOfPoint(point.x, point.y), snap) : angleOfPoint(point.x, point.y);

    applyDrag(bp, obj, drag, pointerDeg, point);
    event.preventDefault();
  });

  function applyDrag(bp, obj, dragState, pointerDeg, point) {
    const range = objectRange(obj);

    switch (dragState.kind) {
      case 'body': {
        const delta = signedDelta(dragState.grabDeg, pointerDeg);
        if (obj.role === 'primary_anchor') {
          const next = normDeg(dragState.startRange.start + delta);
          onEdit((b) => setAnchorArc(b, obj.id, { startDeg: next }));
          setReadout(`${formatClock(next)} → ${formatClock(next + range.span)}`, point.x, point.y - 2.2);
        } else if (obj.kind === 'behavior_path') {
          const next = normDeg(dragState.startRange.start + delta);
          onEdit((b) => setLinkedPosition(b, obj.id, next));
          setReadout(`starts ${formatClock(next)}`, point.x, point.y - 2.2);
        } else {
          const startCentre = normDeg(dragState.startRange.start + dragState.startRange.span / 2);
          const next = normDeg(startCentre + delta);
          onEdit((b) => setLinkedPosition(b, obj.id, next));
          setReadout(formatClock(next), point.x, point.y - 2.2);
        }
        break;
      }

      case 'arc-start': {
        if (obj.role === 'primary_anchor') {
          const end = normDeg(range.start + range.span);
          const span = normDeg(end - pointerDeg);
          if (span >= 5 && span <= 180) {
            onEdit((b) => setAnchorArc(b, obj.id, { startDeg: pointerDeg, arcDeg: span }));
          }
          setReadout(`${formatClock(pointerDeg)} · ${Math.round(span)}°`, point.x, point.y - 2.2);
        } else {
          // Centre-anchored objects resize symmetrically about their centre.
          const centre = objectCenter(obj);
          const span = Math.abs(signedDelta(centre, pointerDeg)) * 2;
          onEdit((b) => setArcWidth(b, obj.id, span));
          setReadout(`${Math.round(span)}° wide`, point.x, point.y - 2.2);
        }
        break;
      }

      case 'arc-end': {
        if (obj.role === 'primary_anchor') {
          const span = normDeg(pointerDeg - range.start);
          if (span >= 5 && span <= 180) {
            onEdit((b) => setAnchorArc(b, obj.id, { arcDeg: span }));
          }
          setReadout(`${Math.round(span)}° wide`, point.x, point.y - 2.2);
        } else {
          const centre = objectCenter(obj);
          const span = Math.abs(signedDelta(centre, pointerDeg)) * 2;
          onEdit((b) => setArcWidth(b, obj.id, span));
          setReadout(`${Math.round(span)}° wide`, point.x, point.y - 2.2);
        }
        break;
      }

      case 'path-start': {
        onEdit((b) => setLinkedPosition(b, obj.id, pointerDeg));
        setReadout(`starts ${formatClock(pointerDeg)}`, point.x, point.y - 2.2);
        break;
      }

      case 'path-end': {
        const span = normDeg(pointerDeg - range.start);
        onEdit((b) => setPathTravel(b, obj.id, span));
        setReadout(`${Math.round(span)}° travel`, point.x, point.y - 2.2);
        break;
      }

      case 'curvature': {
        const { rInner, rOuter } = baseRadii(bp.base);
        const ringWidth = rOuter - rInner;
        const base = rInner + (obj.radial_position ?? 0.5) * ringWidth;
        const radius = radiusOfPoint(point.x, point.y);
        const curvature = clamp((radius - base) / (ringWidth * 0.5), -1, 1);
        onEdit((b) => setCurvature(b, obj.id, curvature));
        setReadout(`curvature ${curvature.toFixed(2)}`, point.x, point.y - 2.2);
        break;
      }

      default:
        break;
    }
  }

  function endDrag(event) {
    if (!drag) return;
    if (drag.kind === 'pan' && drag.wasEmpty && !drag.moved) onSelect(null);
    if (svg.hasPointerCapture?.(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    svg.classList.remove('is-panning');
    drag = null;
    setReadout(null);
  }

  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);

  svg.addEventListener('wheel', (event) => {
    event.preventDefault();
    const state = getState();
    const view = state.blueprint.view;
    const zoom = clamp(view.zoom ?? 1, MIN_ZOOM, MAX_ZOOM);
    const next = clamp(zoom * Math.exp(-event.deltaY * 0.0016), MIN_ZOOM, MAX_ZOOM);
    if (next === zoom) return;

    // Keep the point under the cursor fixed while zooming.
    const point = toViewBox(event);
    const panX = view.pan_x ?? 0;
    const panY = view.pan_y ?? 0;
    onView({
      zoom: next,
      pan_x: point.x - (next / zoom) * (point.x - panX),
      pan_y: point.y - (next / zoom) * (point.y - panY),
    });
  }, { passive: false });

  svg.addEventListener('dblclick', () => onView({ zoom: 1, pan_x: 0, pan_y: 0 }));

  /** Nudge the selected object with the arrow keys. */
  svg.addEventListener('keydown', (event) => {
    const state = getState();
    const obj = state.selectedId ? byId(state.blueprint, state.selectedId) : null;

    if (event.key === 'Escape') {
      onSelect(null);
      return;
    }
    if (!obj || obj.locked) return;

    const step = event.shiftKey ? 5 : 1;
    let delta = 0;
    if (event.key === 'ArrowLeft') delta = -step;
    else if (event.key === 'ArrowRight') delta = step;
    else return;

    event.preventDefault();
    if (obj.role === 'primary_anchor') {
      onEdit((b) => setAnchorArc(b, obj.id, { startDeg: objectRange(obj).start + delta }));
    } else if (obj.kind === 'behavior_path') {
      onEdit((b) => setLinkedPosition(b, obj.id, objectRange(obj).start + delta));
    } else {
      onEdit((b) => setLinkedPosition(b, obj.id, objectCenter(obj) + delta));
    }
  });

  return {
    render,
    /** Reset zoom and pan. */
    fit() {
      onView({ zoom: 1, pan_x: 0, pan_y: 0 });
    },
    zoomBy(factor) {
      const view = getState().blueprint.view;
      onView({ zoom: clamp((view.zoom ?? 1) * factor, MIN_ZOOM, MAX_ZOOM) });
    },
  };
}
