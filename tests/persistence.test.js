/**
 * Save / load round-trip — Sprint 1 ticket §7 and Definition of Done items 8-9.
 *
 * Runs the real persistence module against a minimal localStorage shim, so the
 * code under test is exactly the code the browser runs.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  #map = new Map();

  getItem(key) {
    return this.#map.has(key) ? this.#map.get(key) : null;
  }

  setItem(key, value) {
    this.#map.set(key, String(value));
  }

  removeItem(key) {
    this.#map.delete(key);
  }

  clear() {
    this.#map.clear();
  }
}

globalThis.localStorage = new MemoryStorage();

const {
  deleteBlueprint,
  lastOpenedId,
  listBlueprints,
  loadBlueprint,
  saveBlueprint,
  storageAvailable,
} = await import('../src/io/persistence.js');
const { createBlueprint, getAnchor, getEcho, getSweep, objectCenter } = await import('../src/core/schema.js');
const { setAnchorArc, setAuthorNote, setLocked, updateProperty } = await import('../src/core/actions.js');
const { validateBlueprint } = await import('../src/core/validate.js');

const close = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) < tol, `expected ${a} to be within ${tol} of ${b}`);

test.beforeEach(() => globalThis.localStorage.clear());

test('storage is detected as available', () => {
  assert.ok(storageAvailable());
});

test('a fresh blueprint saves, lists, and reloads identically', () => {
  const bp = createBlueprint({ name: 'Winter arrival', id: 'bp-1', now: '2026-01-01T00:00:00.000Z' });

  const saved = saveBlueprint(bp, 'First save.');
  assert.ok(saved.ok);
  assert.equal(saved.blueprint.revision, 2);

  const index = listBlueprints();
  assert.equal(index.length, 1);
  assert.equal(index[0].name, 'Winter arrival');
  assert.equal(index[0].revision, 2);

  const loaded = loadBlueprint('bp-1');
  assert.deepEqual(loaded.errors, []);
  assert.ok(loaded.ok);
  assert.deepEqual(loaded.blueprint, saved.blueprint);
});

test('every transform and every piece of metadata survives a reload', () => {
  let bp = createBlueprint({ name: 'Edited', id: 'bp-2', now: '2026-01-01T00:00:00.000Z' });

  bp = setAnchorArc(bp, 'anchor-1', { startDeg: 195, arcDeg: 78 });
  bp = updateProperty(bp, 'sweep-1', 'curvature', -0.35);
  bp = updateProperty(bp, 'sweep-1', 'band_width_norm', 0.23);
  bp = updateProperty(bp, 'sweep-1', 'behavior_type', 'arching');
  bp = updateProperty(bp, 'echo-1', 'visual_weight', 0.38);
  bp = updateProperty(bp, 'echo-1', 'focal_repeat.color_note', 'oxidised copper');
  bp = updateProperty(bp, 'clearance-1', 'arc_deg', 26);
  bp = setLocked(bp, 'echo-1', true);
  bp = setAuthorNote(bp, 'anchor-1', 'Dropped it to 6:30 — the bow was fighting the hinge side.');
  bp.gravity_intent.value = 'lifted';
  bp.emotional_profile.intent = 'A held breath before a door opens.';

  saveBlueprint(bp, 'Edited pass.');
  const { blueprint: reloaded } = loadBlueprint('bp-2');

  close(getAnchor(reloaded).start_deg, 195);
  close(getAnchor(reloaded).arc_deg, 78);
  close(getSweep(reloaded).curvature, -0.35);
  close(getSweep(reloaded).band_width_norm, 0.23);
  assert.equal(getSweep(reloaded).behavior_type, 'arching');
  close(getEcho(reloaded).visual_weight, 0.38);
  assert.equal(getEcho(reloaded).focal_repeat.color_note, 'oxidised copper');
  assert.equal(getEcho(reloaded).locked, true);
  assert.match(
    reloaded.objects.find((o) => o.id === 'anchor-1').explanation.author_note,
    /hinge side/,
  );
  assert.equal(reloaded.gravity_intent.value, 'lifted');
  assert.equal(reloaded.emotional_profile.intent, 'A held breath before a door opens.');
  assert.equal(reloaded.name, 'Edited');
});

test('a locked object keeps its absolute position across a reload', () => {
  let bp = createBlueprint({ name: 'Locked', id: 'bp-3', now: '2026-01-01T00:00:00.000Z' });

  bp = setLocked(bp, 'echo-1', true);
  bp = setAnchorArc(bp, 'anchor-1', { startDeg: 300 }); // echo must not follow
  close(objectCenter(getEcho(bp)), 150);

  saveBlueprint(bp, 'Locked echo.');
  const { blueprint: reloaded } = loadBlueprint('bp-3');

  // hydrate() re-runs reflow on load; the lock must still hold it in place.
  close(objectCenter(getEcho(reloaded)), 150);
  assert.equal(getEcho(reloaded).locked, true);
});

test('saving bumps the revision and appends to history each time', () => {
  const bp = createBlueprint({ name: 'Versioned', id: 'bp-4', now: '2026-01-01T00:00:00.000Z' });

  const first = saveBlueprint(bp, 'One.').blueprint;
  const second = saveBlueprint(first, 'Two.').blueprint;
  const third = saveBlueprint(second, 'Three.').blueprint;

  assert.equal(third.revision, 4);
  assert.deepEqual(third.history.map((h) => h.note).slice(-3), ['One.', 'Two.', 'Three.']);
  assert.equal(loadBlueprint('bp-4').blueprint.revision, 4);
});

test('a reloaded blueprint still passes validation', () => {
  const bp = createBlueprint({ name: 'Valid', id: 'bp-5', now: '2026-01-01T00:00:00.000Z' });
  saveBlueprint(bp, 'Save.');

  const report = validateBlueprint(loadBlueprint('bp-5').blueprint);
  assert.deepEqual(report.results.filter((r) => r.status === 'fail'), []);
  assert.ok(report.ok);
});

test('several blueprints coexist and list newest first', () => {
  saveBlueprint(createBlueprint({ name: 'Older', id: 'bp-a' }), 'a', '2026-01-01T00:00:00.000Z');
  saveBlueprint(createBlueprint({ name: 'Newer', id: 'bp-b' }), 'b', '2026-06-01T00:00:00.000Z');

  const names = listBlueprints().map((entry) => entry.name);
  assert.equal(names.length, 2);
  assert.equal(names[0], 'Newer');
  assert.equal(lastOpenedId(), 'bp-b');
});

test('blueprints saved in the same millisecond still list deterministically', () => {
  const at = '2026-04-04T00:00:00.000Z';
  saveBlueprint(createBlueprint({ name: 'Beta', id: 'bp-beta' }), 'b', at);
  saveBlueprint(createBlueprint({ name: 'Alpha', id: 'bp-alpha' }), 'a', at);

  assert.deepEqual(listBlueprints().map((e) => e.name), ['Alpha', 'Beta']);
});

test('deleting removes a blueprint from the library', () => {
  saveBlueprint(createBlueprint({ name: 'Doomed', id: 'bp-x', now: '2026-01-01T00:00:00.000Z' }), 'x');
  assert.equal(listBlueprints().length, 1);

  assert.ok(deleteBlueprint('bp-x').ok);
  assert.equal(listBlueprints().length, 0);
  assert.ok(!loadBlueprint('bp-x').ok);
});

test('loading an unknown id fails cleanly instead of throwing', () => {
  const result = loadBlueprint('nope');
  assert.ok(!result.ok);
  assert.equal(result.blueprint, null);
  assert.match(result.errors[0], /No saved blueprint/);
});

test('corrupt library JSON degrades to an empty library rather than crashing', () => {
  globalThis.localStorage.setItem('evercrafted.placement-engine.library.v1', '{not json');
  assert.deepEqual(listBlueprints(), []);
});

test('a blueprint saved by an older build is migrated on load', () => {
  const bp = createBlueprint({ name: 'Legacy', id: 'bp-old', now: '2026-01-01T00:00:00.000Z' });
  saveBlueprint(bp, 'Save.');

  // Simulate a file written before view state / gravity existed.
  const raw = JSON.parse(globalThis.localStorage.getItem('evercrafted.placement-engine.library.v1'));
  delete raw['bp-old'].view;
  delete raw['bp-old'].gravity_intent;
  globalThis.localStorage.setItem('evercrafted.placement-engine.library.v1', JSON.stringify(raw));

  const loaded = loadBlueprint('bp-old');
  assert.ok(loaded.ok, loaded.errors.join(' '));
  assert.ok(loaded.blueprint.view);
  assert.equal(loaded.blueprint.gravity_intent.value, 'grounded');
});
