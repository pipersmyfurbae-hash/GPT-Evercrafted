/**
 * Pure blueprint transforms.
 *
 * Every action takes a blueprint and returns a NEW blueprint. Nothing mutates
 * the argument, so the UI can hold a previous state for comparison and the
 * transforms stay directly testable without a DOM.
 *
 * Every action ends by running `applyLinks`, so dependent objects are always
 * recomputed after any edit — the spec's reflow rule holds by construction
 * rather than by remembering to call it.
 */

import { clamp, normDeg, clampSpan } from './geometry.js';
import {
  PROPERTY_SPECS,
  byId,
  getPath,
  setPath,
  validateSchema,
  migrate,
} from './schema.js';
import { applyLinks, relinkFromCurrent } from './analysis.js';

const clone = (bp) => structuredClone(bp);

/** Re-run dependency reflow and hand back the blueprint. */
function settle(bp) {
  applyLinks(bp);
  return bp;
}

/** Find the editable spec for a property, so bounds live in one place. */
function specFor(role, path) {
  return (PROPERTY_SPECS[role] ?? []).find((s) => s.key === path) ?? null;
}

/**
 * Edit one property on one object.
 *
 * Numeric values are clamped to the bounds declared in PROPERTY_SPECS; angles
 * are normalised. An out-of-range value never reaches the blueprint.
 */
export function updateProperty(bp, objectId, path, rawValue) {
  const next = clone(bp);
  const obj = byId(next, objectId);
  if (!obj) return bp;

  const spec = specFor(obj.role, path);
  let value = rawValue;

  if (spec && ['number', 'ratio', 'deg', 'band_width'].includes(spec.kind)) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return bp;
    value = clamp(numeric, spec.min ?? -Infinity, spec.max ?? Infinity);
  } else if (spec?.kind === 'clock') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return bp;
    value = normDeg(numeric);
  } else if (spec?.kind === 'select' && spec.options && !spec.options.includes(value)) {
    return bp;
  }

  setPath(obj, path, value);
  return settle(next);
}

/**
 * Lock or unlock an object.
 *
 * Unlocking re-derives the link offset from where the object currently sits, so
 * it stays put on unlock instead of snapping back to where its parent would have
 * put it. Locking freezes it at its current absolute angles.
 */
export function setLocked(bp, objectId, locked) {
  const next = clone(bp);
  const obj = byId(next, objectId);
  if (!obj) return bp;

  if (!locked && obj.locked) relinkFromCurrent(next, obj);
  obj.locked = Boolean(locked);
  return settle(next);
}

export function setVisible(bp, objectId, visible) {
  const next = clone(bp);
  if (objectId === 'base') {
    next.base.visible = Boolean(visible);
    return next;
  }
  const obj = byId(next, objectId);
  if (!obj) return bp;
  obj.visible = Boolean(visible);
  return next;
}

/**
 * Move or resize the anchor directly (canvas drag).
 * The anchor has no parent, so its angles are absolute.
 */
export function setAnchorArc(bp, objectId, { startDeg, arcDeg }) {
  const next = clone(bp);
  const obj = byId(next, objectId);
  if (!obj || obj.locked) return bp;

  if (Number.isFinite(startDeg)) obj.start_deg = normDeg(startDeg);
  if (Number.isFinite(arcDeg)) obj.arc_deg = clamp(clampSpan(arcDeg), 5, 180);
  return settle(next);
}

/**
 * Drag a linked object to an absolute angle. The link is preserved by updating
 * its offset rather than breaking it — dragging a child re-expresses the
 * relationship, it does not sever it.
 */
export function setLinkedPosition(bp, objectId, absoluteDeg) {
  const next = clone(bp);
  const obj = byId(next, objectId);
  if (!obj || obj.locked) return bp;

  if (obj.kind === 'behavior_path') obj.start_deg = normDeg(absoluteDeg);
  else obj.center_deg = normDeg(absoluteDeg);

  relinkFromCurrent(next, obj);
  return settle(next);
}

/** Resize a centre+width object (echo, clearance) from a dragged edge. */
export function setArcWidth(bp, objectId, arcDeg) {
  const next = clone(bp);
  const obj = byId(next, objectId);
  if (!obj || obj.locked) return bp;

  const spec = specFor(obj.role, 'arc_deg');
  obj.arc_deg = clamp(clampSpan(arcDeg), spec?.min ?? 4, spec?.max ?? 180);
  return settle(next);
}

/** Set a behaviour path's travel from a dragged end handle. */
export function setPathTravel(bp, objectId, arcDeg) {
  const next = clone(bp);
  const obj = byId(next, objectId);
  if (!obj || obj.locked) return bp;

  const spec = specFor(obj.role, 'arc_deg');
  obj.arc_deg = clamp(clampSpan(arcDeg), spec?.min ?? 10, spec?.max ?? 330);
  return settle(next);
}

/** Set a behaviour path's curvature from the dragged midpoint handle. */
export function setCurvature(bp, objectId, curvature) {
  const next = clone(bp);
  const obj = byId(next, objectId);
  if (!obj || obj.locked) return bp;
  obj.curvature = clamp(curvature, -1, 1);
  return settle(next);
}

/* ------------------------------------------------------------------ *
 * Explanation authoring — EC-DOS-001 Principle 6, spec's "why I changed this"
 * ------------------------------------------------------------------ */

/** Record the author's reason for an edit. See CONFLICTS.md C-10. */
export function setAuthorNote(bp, objectId, note) {
  const next = clone(bp);
  const obj = byId(next, objectId);
  if (!obj) return bp;
  obj.explanation = obj.explanation ?? {};
  obj.explanation.author_note = String(note ?? '');
  return next;
}

/**
 * Override the generated "why" text. The engine's own reasoning is retained
 * alongside it — an authored explanation replaces what is shown, never what the
 * engine concluded.
 */
export function setExplanationOverride(bp, objectId, text) {
  const next = clone(bp);
  const obj = byId(next, objectId);
  if (!obj) return bp;
  obj.explanation = obj.explanation ?? {};
  const trimmed = String(text ?? '').trim();
  obj.explanation.override = trimmed || null;
  obj.explanation.source = trimmed ? 'authored' : 'engine';
  return next;
}

/* ------------------------------------------------------------------ *
 * Blueprint-level edits
 * ------------------------------------------------------------------ */

export function setBaseProperty(bp, key, value) {
  const next = clone(bp);
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return bp;

  if (key === 'diameter_in') next.base.diameter_in = clamp(numeric, 6, 72);
  else if (key === 'ring_width_in') next.base.ring_width_in = clamp(numeric, 1, 24);
  else if (key === 'depth_in') next.base.depth_in = clamp(numeric, 0.5, 18);
  else return bp;

  // Keep the ring inside the form after either dimension changes.
  const maxRing = next.base.diameter_in / 2 - 0.5;
  next.base.ring_width_in = Math.min(next.base.ring_width_in, maxRing);

  return settle(next);
}

export function setBlueprintField(bp, path, value) {
  const next = clone(bp);
  setPath(next, path, value);
  return next;
}

export function setView(bp, key, value) {
  const next = clone(bp);
  next.view = { ...next.view, [key]: value };
  return next;
}

/* ------------------------------------------------------------------ *
 * Revisioning
 * ------------------------------------------------------------------ */

/**
 * Stamp a new revision. Called on save, so the revision number counts saved
 * states rather than keystrokes.
 */
export function commitRevision(bp, note, now) {
  const next = clone(bp);
  next.revision = (next.revision ?? 0) + 1;
  next.updated_at = now ?? new Date().toISOString();
  next.history = [
    ...(next.history ?? []),
    { revision: next.revision, at: next.updated_at, note: note || 'Saved.' },
  ].slice(-100);
  return next;
}

/** Normalise anything read from disk or storage: migrate, reflow, verify. */
export function hydrate(raw) {
  const migrated = migrate(raw);
  if (!migrated || !Array.isArray(migrated.objects)) {
    return { ok: false, errors: ['File does not contain a blueprint object list.'], blueprint: null };
  }
  const settled = settle(migrated);
  const { ok, errors } = validateSchema(settled);
  return { ok, errors, blueprint: settled };
}

export { getPath };
