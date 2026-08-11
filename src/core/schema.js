/**
 * Blueprint data model for the Evercrafted Placement Engine, Sprint 1.
 *
 * Design notes:
 *
 * 1. `objects` is an ARRAY, not fixed named slots. The Sprint 1 ticket's
 *    Developer Note requires the architecture to stay flexible for later
 *    composition formulas, and the "exactly one primary anchor" validator is
 *    meaningless if the model can only ever hold one anchor.
 *
 * 2. Angles are stored in degrees only, clockwise from 12 o'clock. Clock
 *    notation is a UI format. See CONFLICTS.md C-08.
 *
 * 3. Hardware clearance is a first-class object linked to the anchor, not a
 *    property of it. See CONFLICTS.md C-02.
 *
 * 4. `emotional_profile` and `gravity_intent` are carried even though the
 *    ticket's persist list omits them. See CONFLICTS.md C-06.
 *
 * 5. INTENT AND MEASUREMENT NEVER SHARE A FIELD. Authored intent is persisted
 *    (`gravity_intent`); measured geometry is computed on demand and lives in
 *    the `geometry_metrics` namespace in analysis.js. An authored concept and a
 *    measured number are not two versions of the same truth, so they are never
 *    stored as two keys on one object. See CONFLICTS.md C-01 and the
 *    architectural principle at the foot of that file.
 */

import { normDeg, clampSpan, legacyWidthDegToInches } from './geometry.js';

export const SCHEMA_VERSION = '1.1.0';
export const ENGINE_VERSION = 'placement-engine/sprint-1';

/**
 * Authored gravity-intent vocabulary, from EC-COMP-001 "Composition Gravity".
 * These are intentions, not measurements — most of them have no angle at all.
 */
export const GRAVITY_INTENTS = [
  'grounded',
  'lifted',
  'outward',
  'inward',
  'stable',
  'expanding',
  'quiet',
  'energized',
];

/** Greenery behaviours, from EC-GRN-001's Behavior Library. */
export const BEHAVIOR_TYPES = [
  'cascading',
  'sweeping',
  'arching',
  'bridging',
  'nesting',
  'framing',
];

export const BEHAVIOR_CANON_REF = {
  cascading: 'GRN.B01',
  sweeping: 'GRN.B02',
  arching: 'GRN.B03',
  bridging: 'GRN.B04',
  nesting: 'GRN.B05',
  framing: 'GRN.B06',
};

export const DEPTH_BANDS = ['receding', 'middle', 'forward'];

export const POCKET_TYPES = ['anchor', 'support', 'echo', 'transition', 'rest'];

export const HARDWARE_PURPOSES = ['bow', 'ribbon', 'hanger', 'other'];

/** Blueprint lifecycle, from the spec. Sprint 1 only authors the first stages. */
export const LIFECYCLE_STAGES = [
  'draft',
  'composition_complete',
  'placement_complete',
  'inventory_assigned',
  'render_ready',
  'reviewed',
  'approved',
  'published',
];

/** Stages reachable in Sprint 1 — later stages need engines that do not exist yet. */
export const LIFECYCLE_STAGES_SPRINT1 = [
  'draft',
  'composition_complete',
  'placement_complete',
];

/* ------------------------------------------------------------------ *
 * Defaults — the canonical 24-inch test composition
 * ------------------------------------------------------------------ */

/**
 * Where each default number came from.
 *
 * A default is allowed to be provisional without becoming a validator — these
 * are starting values a designer immediately edits, not rules anything is
 * measured against. But they should not be mistaken for canon, so their
 * provenance is recorded rather than assumed.
 *
 *   spec        — given by the Placement Engine Spec or the Sprint 1 ticket.
 *   engineering — chosen to make the sprint's test composition read well. Not
 *                 empirically earned. Ruled acceptable as a default, and
 *                 explicitly NOT a calibrated canon value.
 *
 * `band_width_norm: 0.30` is the clearest case: the *geometry* it expresses is
 * now correct (radial thickness, CONFLICTS.md C-04), but the number 0.30 itself
 * has not been earned. EC-GEO-001 / EC-CAL may supply a calibrated starting
 * value later; nothing validates against it in the meantime.
 */
export const DEFAULT_PROVENANCE = Object.freeze({
  'base.diameter_in': 'spec',
  'anchor.start_deg': 'spec', // 7 o'clock
  'anchor.arc_deg': 'spec', // through to 9 o'clock
  'echo.offset_deg': 'spec', // places the echo near 5 o'clock
  'sweep.behavior_type': 'spec', // GRN-B02 sweeping

  'base.ring_width_in': 'engineering',
  'base.depth_in': 'engineering',
  'anchor.depth_ratio': 'engineering',
  'anchor.visual_weight': 'engineering',
  'clearance.arc_deg': 'engineering',
  'clearance.radial_position': 'engineering',
  'clearance.radial_extent': 'engineering',
  'sweep.arc_deg': 'engineering',
  'sweep.band_width_norm': 'engineering',
  'sweep.curvature': 'engineering',
  'sweep.taper': 'engineering',
  'sweep.strength': 'engineering',
  'sweep.radial_position': 'engineering',
  'echo.arc_deg': 'engineering',
  'echo.depth_ratio': 'engineering',
  'echo.visual_weight': 'engineering',
});

export const DEFAULTS = Object.freeze({
  base: {
    shape: 'circle',
    diameter_in: 24,
    ring_width_in: 5,
    depth_in: 4,
  },
  anchor: {
    start_deg: 210, // 7:00
    arc_deg: 60, // through to 9:00
    depth_ratio: 1.0,
    visual_weight: 1.0,
  },
  clearance: {
    arc_deg: 22,
    offset_deg: 0, // centred in the anchor
    radial_position: 0.5,
    radial_extent: 0.8,
    purpose: 'bow',
  },
  sweep: {
    // Starts at the anchor's leading (clockwise) edge = 9:00, travels clockwise
    // up over 12 to roughly 1:30. See CONFLICTS.md C-05.
    offset_deg: 0,
    arc_deg: 135, // how far it travels AROUND the form
    // How thick it is ACROSS the ring (CONFLICTS.md C-04). The geometry is
    // correct; the number is an engineering default, not calibrated canon.
    // See DEFAULT_PROVENANCE above.
    band_width_norm: 0.3,
    curvature: 0.25,
    taper: 0.45,
    strength: 0.6,
    radial_position: 0.5,
    depth_band: 'middle',
    priority: 1,
    behavior_type: 'sweeping',
  },
  echo: {
    offset_deg: -90, // anchor centre 8:00 -> echo centre 5:00
    arc_deg: 34,
    depth_ratio: 0.7,
    visual_weight: 0.45,
  },
});

/* ------------------------------------------------------------------ *
 * Factories
 * ------------------------------------------------------------------ */

function nowIso(now) {
  return now ?? new Date().toISOString();
}

function emptyExplanation() {
  return { source: 'engine', author_note: '', override: null };
}

export function createAnchor(overrides = {}) {
  return {
    id: 'anchor-1',
    kind: 'pocket',
    role: 'primary_anchor',
    pocket_type: 'anchor',
    label: 'Primary anchor',
    start_deg: DEFAULTS.anchor.start_deg,
    arc_deg: DEFAULTS.anchor.arc_deg,
    depth_ratio: DEFAULTS.anchor.depth_ratio,
    visual_weight: DEFAULTS.anchor.visual_weight,
    emotional_role: 'Point of entry and emotional weight of the composition.',
    locked: false,
    visible: true,
    explanation: emptyExplanation(),
    ...overrides,
  };
}

export function createClearance(overrides = {}) {
  return {
    id: 'clearance-1',
    kind: 'clearance',
    role: 'hardware_clearance',
    label: 'Hardware clearance',
    purpose: DEFAULTS.clearance.purpose,
    link: {
      parent_id: 'anchor-1',
      mode: 'centered_in_anchor',
      offset_deg: DEFAULTS.clearance.offset_deg,
    },
    center_deg: 240, // recomputed from the link on every reflow
    arc_deg: DEFAULTS.clearance.arc_deg,
    radial_position: DEFAULTS.clearance.radial_position,
    radial_extent: DEFAULTS.clearance.radial_extent,
    locked: false,
    visible: true,
    explanation: emptyExplanation(),
    ...overrides,
  };
}

export function createSweep(overrides = {}) {
  return {
    id: 'sweep-1',
    kind: 'behavior_path',
    role: 'primary_sweep',
    label: 'Primary sweep',
    behavior_type: DEFAULTS.sweep.behavior_type,
    link: {
      parent_id: 'anchor-1',
      mode: 'from_anchor_edge',
      edge: 'leading',
      offset_deg: DEFAULTS.sweep.offset_deg,
    },
    start_deg: 270, // recomputed from the link on every reflow
    arc_deg: DEFAULTS.sweep.arc_deg,
    band_width_norm: DEFAULTS.sweep.band_width_norm,
    curvature: DEFAULTS.sweep.curvature,
    taper: DEFAULTS.sweep.taper,
    strength: DEFAULTS.sweep.strength,
    radial_position: DEFAULTS.sweep.radial_position,
    depth_band: DEFAULTS.sweep.depth_band,
    priority: DEFAULTS.sweep.priority,
    locked: false,
    visible: true,
    explanation: emptyExplanation(),
    ...overrides,
  };
}

export function createEcho(overrides = {}) {
  return {
    id: 'echo-1',
    kind: 'pocket',
    role: 'secondary_echo',
    pocket_type: 'echo',
    label: 'Secondary echo',
    link: {
      parent_id: 'anchor-1',
      mode: 'offset_from_anchor',
      offset_deg: DEFAULTS.echo.offset_deg,
    },
    center_deg: 150, // recomputed from the link on every reflow
    arc_deg: DEFAULTS.echo.arc_deg,
    depth_ratio: DEFAULTS.echo.depth_ratio,
    visual_weight: DEFAULTS.echo.visual_weight,
    // Placeholder only. Ticket §4 asks for a field to hold the repeated focal
    // colour/species; inventory and species selection are Sprint 1 out-of-scope,
    // so this is free text wired to nothing.
    focal_repeat: { color_note: '', species_note: '' },
    locked: false,
    visible: true,
    explanation: emptyExplanation(),
    ...overrides,
  };
}

/** Build the canonical Sprint 1 test blueprint. */
export function createBlueprint(options = {}) {
  const { name = 'Untitled blueprint', id, now } = options;
  const timestamp = nowIso(now);

  return {
    schema_version: SCHEMA_VERSION,
    engine_version: ENGINE_VERSION,
    id: id ?? `bp-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    name,
    created_at: timestamp,
    updated_at: timestamp,
    revision: 1,
    lifecycle_status: 'draft',

    emotional_profile: {
      intent: '',
      keywords: [],
    },

    // Authored intent only. The measured gravity vector is computed live in
    // analysis.js under `geometry_metrics` and is deliberately never stored
    // beside this. See CONFLICTS.md C-01.
    gravity_intent: {
      value: 'grounded',
      note: '',
    },

    base: { ...DEFAULTS.base, visible: true, locked: false },

    objects: [createAnchor(), createClearance(), createSweep(), createEcho()],

    view: {
      clock_overlay: true,
      rest_zones: true,
      gravity_marker: true,
      snap_deg: 15,
      zoom: 1,
      pan_x: 0,
      pan_y: 0,
    },

    history: [{ revision: 1, at: timestamp, note: 'Blueprint created from canonical Sprint 1 test composition.' }],
  };
}

/* ------------------------------------------------------------------ *
 * Accessors
 * ------------------------------------------------------------------ */

export const byRole = (bp, role) => bp.objects.find((o) => o.role === role) ?? null;
export const allByRole = (bp, role) => bp.objects.filter((o) => o.role === role);
export const byId = (bp, id) => bp.objects.find((o) => o.id === id) ?? null;

export const getAnchor = (bp) => byRole(bp, 'primary_anchor');
export const getClearance = (bp) => byRole(bp, 'hardware_clearance');
export const getSweep = (bp) => byRole(bp, 'primary_sweep');
export const getEcho = (bp) => byRole(bp, 'secondary_echo');

/** Derived ring radii, in inches. */
export function baseRadii(base) {
  const rOuter = base.diameter_in / 2;
  const rInner = Math.max(0.5, rOuter - base.ring_width_in);
  return { rOuter, rInner, rMean: (rOuter + rInner) / 2, ringWidth: rOuter - rInner };
}

/**
 * The angular range an object occupies. Pockets and clearances are centre+width;
 * behaviour paths are start+span.
 */
export function objectRange(obj) {
  if (obj.kind === 'behavior_path') {
    return { start: normDeg(obj.start_deg), span: clampSpan(obj.arc_deg) };
  }
  if (obj.role === 'primary_anchor') {
    return { start: normDeg(obj.start_deg), span: clampSpan(obj.arc_deg) };
  }
  const span = clampSpan(obj.arc_deg);
  return { start: normDeg(obj.center_deg - span / 2), span };
}

/** Centre angle of any object. */
export function objectCenter(obj) {
  const range = objectRange(obj);
  return normDeg(range.start + range.span / 2);
}

/* ------------------------------------------------------------------ *
 * Editable property specs — drive the inspector generically
 * ------------------------------------------------------------------ */

const RATIO = { kind: 'ratio', min: 0, max: 1, step: 0.01 };

export const PROPERTY_SPECS = {
  primary_anchor: [
    { key: 'start_deg', label: 'Arc start', kind: 'clock', hint: 'Clockwise start of the anchor zone.' },
    { key: 'arc_deg', label: 'Arc width', kind: 'deg', min: 5, max: 180, step: 1, hint: 'Angular extent of the reserved focal zone.' },
    { key: 'depth_ratio', label: 'Depth', kind: 'number', min: 0.2, max: 1.8, step: 0.05, unit: 'x ring', hint: 'Radial mass as a multiple of the ring width.' },
    { key: 'visual_weight', label: 'Visual weight', ...RATIO, hint: 'Reference weight for the composition. Everything else is judged against this.' },
    { key: 'emotional_role', label: 'Emotional role', kind: 'textarea', hint: 'What this anchor carries emotionally. Feeds the explanation.' },
  ],
  hardware_clearance: [
    { key: 'purpose', label: 'Reserved for', kind: 'select', options: HARDWARE_PURPOSES },
    { key: 'link.offset_deg', label: 'Offset from anchor centre', kind: 'deg', min: -90, max: 90, step: 1, hint: 'Positive is clockwise from the anchor centre.' },
    { key: 'arc_deg', label: 'Clearance width', kind: 'deg', min: 4, max: 90, step: 1 },
    { key: 'radial_position', label: 'Radial position', ...RATIO, hint: '0 is the inner edge of the ring, 1 the outer.' },
    { key: 'radial_extent', label: 'Radial extent', ...RATIO, hint: 'How much of the ring depth the hardware needs.' },
  ],
  primary_sweep: [
    { key: 'behavior_type', label: 'Behaviour', kind: 'select', options: BEHAVIOR_TYPES, hint: 'EC-GRN-001 behaviour library. Behaviour is selected before species.' },
    { key: 'link.offset_deg', label: 'Offset from anchor edge', kind: 'deg', min: -60, max: 60, step: 1 },
    { key: 'arc_deg', label: 'Travel', kind: 'deg', min: 10, max: 330, step: 1, hint: 'Clockwise travel from the start of the path.' },
    { key: 'band_width_norm', label: 'Band width', kind: 'band_width', min: 0.04, max: 1, step: 0.01, hint: 'Radial thickness ACROSS the ring, as a fraction of the base band width. Travel around the form is set by Travel above. The 0.30 default is a starting value, not a calibrated one.' },
    { key: 'curvature', label: 'Curvature', kind: 'number', min: -1, max: 1, step: 0.05, hint: 'Radial bow at the midpoint. Positive lifts the path outward.' },
    { key: 'taper', label: 'Taper', ...RATIO, hint: 'How much the band narrows along its travel. GRN-B02 wants a gesture, not a hedge.' },
    { key: 'strength', label: 'Strength', ...RATIO, hint: 'Visual assertiveness of the gesture.' },
    { key: 'radial_position', label: 'Radial position', ...RATIO },
    { key: 'depth_band', label: 'Depth band', kind: 'select', options: DEPTH_BANDS },
    { key: 'priority', label: 'Priority', kind: 'number', min: 1, max: 9, step: 1 },
  ],
  secondary_echo: [
    { key: 'link.offset_deg', label: 'Offset from anchor centre', kind: 'deg', min: -180, max: 180, step: 1, hint: 'Relationship to the anchor. -90 puts the echo at 5:00 against a 7-9 anchor.' },
    { key: 'arc_deg', label: 'Arc width', kind: 'deg', min: 5, max: 180, step: 1 },
    { key: 'depth_ratio', label: 'Depth', kind: 'number', min: 0.2, max: 1.8, step: 0.05, unit: 'x ring' },
    { key: 'visual_weight', label: 'Visual weight', ...RATIO, hint: 'Must stay visibly below the anchor. An echo, not a mirror.' },
    { key: 'focal_repeat.color_note', label: 'Repeated focal colour', kind: 'text', placeholder: 'Placeholder - no inventory in Sprint 1', hint: 'Free text. Species and inventory matching are out of scope this sprint.' },
    { key: 'focal_repeat.species_note', label: 'Repeated focal species', kind: 'text', placeholder: 'Placeholder - no inventory in Sprint 1' },
  ],
};

/* ------------------------------------------------------------------ *
 * Nested get/set for property specs like "link.offset_deg"
 * ------------------------------------------------------------------ */

export function getPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

export function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  let target = obj;
  for (const key of keys) {
    if (target[key] == null || typeof target[key] !== 'object') target[key] = {};
    target = target[key];
  }
  target[last] = value;
  return obj;
}

/* ------------------------------------------------------------------ *
 * Schema validation — Ticket §8, "saved blueprint schema is valid"
 * ------------------------------------------------------------------ */

const NUMBER_FIELDS = {
  pocket: ['arc_deg', 'depth_ratio', 'visual_weight'],
  behavior_path: ['start_deg', 'arc_deg', 'band_width_norm', 'curvature', 'taper', 'strength', 'radial_position', 'priority'],
  clearance: ['center_deg', 'arc_deg', 'radial_position', 'radial_extent'],
};

export function validateSchema(bp) {
  const errors = [];
  const fail = (msg) => errors.push(msg);

  if (!bp || typeof bp !== 'object') {
    return { ok: false, errors: ['Blueprint is not an object.'] };
  }

  if (typeof bp.schema_version !== 'string') fail('Missing schema_version.');
  else if (bp.schema_version !== SCHEMA_VERSION) {
    fail(`Unsupported schema_version "${bp.schema_version}" (this engine reads ${SCHEMA_VERSION}).`);
  }

  for (const key of ['id', 'name', 'created_at', 'updated_at']) {
    if (typeof bp[key] !== 'string' || !bp[key]) fail(`Missing or invalid "${key}".`);
  }
  if (!Number.isInteger(bp.revision) || bp.revision < 1) fail('revision must be a positive integer.');
  if (!LIFECYCLE_STAGES.includes(bp.lifecycle_status)) fail(`Unknown lifecycle_status "${bp.lifecycle_status}".`);

  if (!bp.base || typeof bp.base !== 'object') fail('Missing base.');
  else {
    if (!(bp.base.diameter_in > 0)) fail('base.diameter_in must be greater than 0.');
    if (!(bp.base.ring_width_in > 0)) fail('base.ring_width_in must be greater than 0.');
    if (bp.base.ring_width_in >= bp.base.diameter_in / 2) {
      fail('base.ring_width_in must be smaller than the base radius.');
    }
  }

  if (bp.gravity_intent && !GRAVITY_INTENTS.includes(bp.gravity_intent.value)) {
    fail(`Unknown gravity_intent.value "${bp.gravity_intent.value}".`);
  }
  if ('composition_gravity' in bp) {
    fail('composition_gravity is a 1.0.0 field. Intent is gravity_intent; the measurement is not persisted.');
  }

  if (!Array.isArray(bp.objects)) {
    fail('objects must be an array.');
    return { ok: errors.length === 0, errors };
  }

  const seenIds = new Set();
  for (const obj of bp.objects) {
    const where = obj?.id ? `object "${obj.id}"` : 'an object';
    if (!obj || typeof obj !== 'object') {
      fail('objects contains a non-object entry.');
      continue;
    }
    if (typeof obj.id !== 'string' || !obj.id) fail(`${where} has no id.`);
    else if (seenIds.has(obj.id)) fail(`Duplicate object id "${obj.id}".`);
    else seenIds.add(obj.id);

    if (!['pocket', 'behavior_path', 'clearance'].includes(obj.kind)) {
      fail(`${where} has unknown kind "${obj.kind}".`);
    }
    if (typeof obj.role !== 'string' || !obj.role) fail(`${where} has no role.`);
    if (typeof obj.locked !== 'boolean') fail(`${where} is missing a boolean "locked".`);
    if (typeof obj.visible !== 'boolean') fail(`${where} is missing a boolean "visible".`);
    if (!obj.explanation || typeof obj.explanation !== 'object') {
      fail(`${where} is missing an explanation record.`);
    }

    for (const field of NUMBER_FIELDS[obj.kind] ?? []) {
      if (!Number.isFinite(obj[field])) fail(`${where} has non-numeric "${field}".`);
    }
    if (obj.kind === 'pocket' && obj.role === 'primary_anchor' && !Number.isFinite(obj.start_deg)) {
      fail(`${where} has non-numeric "start_deg".`);
    }
    if (obj.kind === 'pocket' && obj.role !== 'primary_anchor' && !Number.isFinite(obj.center_deg)) {
      fail(`${where} has non-numeric "center_deg".`);
    }
    if (obj.kind === 'behavior_path' && !BEHAVIOR_TYPES.includes(obj.behavior_type)) {
      fail(`${where} has unknown behavior_type "${obj.behavior_type}".`);
    }
    if (obj.kind === 'pocket' && !POCKET_TYPES.includes(obj.pocket_type)) {
      fail(`${where} has unknown pocket_type "${obj.pocket_type}".`);
    }

    if (obj.link) {
      if (typeof obj.link.parent_id !== 'string') fail(`${where} has a link with no parent_id.`);
      else if (!bp.objects.some((o) => o.id === obj.link.parent_id)) {
        fail(`${where} links to missing parent "${obj.link.parent_id}".`);
      }
      if (!Number.isFinite(obj.link.offset_deg)) fail(`${where} has a non-numeric link offset.`);
    }
  }

  if (!Array.isArray(bp.history)) fail('history must be an array.');
  if (!bp.view || typeof bp.view !== 'object') fail('Missing view state.');

  return { ok: errors.length === 0, errors };
}

/**
 * Bring any stored blueprint up to the current schema.
 *
 * Every read goes through here, so version handling has exactly one home.
 *
 * 1.0.0 -> 1.1.0 carries two ruled changes (2026-08-11):
 *   - `composition_gravity.declared` becomes `gravity_intent.value`, because
 *     authored intent and measured geometry must never share a field.
 *   - the sweep's `width_deg` becomes `band_width_norm`, because the 1.0.0
 *     reading converted an arc length along the ring into a thickness across
 *     it. The old arithmetic is replayed once, here, so a blueprint saved under
 *     1.0.0 reopens looking exactly as its author left it.
 */
export function migrate(bp) {
  if (!bp || typeof bp !== 'object') return bp;
  const next = structuredClone(bp);
  const from = next.schema_version;

  if (!next.view) {
    next.view = { clock_overlay: true, rest_zones: true, gravity_marker: true, snap_deg: 15, zoom: 1, pan_x: 0, pan_y: 0 };
  }
  if (!next.history) next.history = [];
  if (!next.emotional_profile) next.emotional_profile = { intent: '', keywords: [] };
  if (!next.lifecycle_status) next.lifecycle_status = 'draft';
  if (!next.engine_version) next.engine_version = ENGINE_VERSION;

  // --- 1.0.0 gravity field rename ---
  if (next.composition_gravity) {
    next.gravity_intent = next.gravity_intent ?? {
      value: next.composition_gravity.declared ?? 'grounded',
      note: next.composition_gravity.note ?? '',
    };
    delete next.composition_gravity;
  }
  if (!next.gravity_intent) next.gravity_intent = { value: 'grounded', note: '' };

  const { ringWidth, rMean } = next.base ? baseRadii(next.base) : { ringWidth: 0, rMean: 0 };

  for (const obj of next.objects ?? []) {
    if (!obj.explanation) obj.explanation = emptyExplanation();
    if (typeof obj.explanation.author_note !== 'string') obj.explanation.author_note = '';
    if (typeof obj.visible !== 'boolean') obj.visible = true;
    if (typeof obj.locked !== 'boolean') obj.locked = false;

    // --- 1.0.0 sweep width reinterpretation ---
    if (obj.kind === 'behavior_path' && obj.band_width_norm === undefined) {
      const legacyInches = legacyWidthDegToInches(obj.width_deg ?? 0, rMean);
      obj.band_width_norm = ringWidth > 0
        ? Math.min(1, Math.max(0.04, legacyInches / ringWidth))
        : DEFAULTS.sweep.band_width_norm;
      delete obj.width_deg;
    }
  }

  if (from && from !== SCHEMA_VERSION) {
    next.schema_version = SCHEMA_VERSION;
    next.history = [
      ...next.history,
      {
        revision: next.revision ?? 1,
        at: next.updated_at ?? nowIso(),
        note: `Migrated ${from} to ${SCHEMA_VERSION}: gravity_intent split from measurement, sweep width re-expressed as radial band width.`,
      },
    ].slice(-100);
  }

  return next;
}
