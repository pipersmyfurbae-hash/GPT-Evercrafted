/**
 * Application wiring.
 *
 * One store, one render pass. Every panel reads the same blueprint and
 * recomputes what it needs, so the canvas, inspector and validation report can
 * never disagree about a number.
 */

import { createStore } from './core/store.js';
import { createBlueprint } from './core/schema.js';
import {
  setAuthorNote,
  setBaseProperty,
  setBlueprintField,
  setExplanationOverride,
  setLocked,
  setView,
  setVisible,
  updateProperty,
} from './core/actions.js';
import {
  deleteBlueprint,
  exportBlueprint,
  importBlueprintFile,
  lastOpenedId,
  loadBlueprint,
  rememberOpen,
  saveBlueprint,
  storageAvailable,
} from './io/persistence.js';
import { createCanvas } from './ui/canvas.js';
import { createLayersPanel } from './ui/layers.js';
import { createInspector } from './ui/inspector.js';
import { createReportPanel } from './ui/report.js';
import { createToolbar } from './ui/toolbar.js';

/* ---------------- boot state ---------------- */

function initialBlueprint() {
  const lastId = lastOpenedId();
  if (lastId) {
    const { ok, blueprint } = loadBlueprint(lastId);
    if (ok && blueprint) return { blueprint, restored: true };
  }
  return { blueprint: createBlueprint({ name: 'Untitled blueprint' }), restored: false };
}

const boot = initialBlueprint();

const store = createStore({
  blueprint: boot.blueprint,
  selectedId: null,
  hoverId: null,
  dirty: false,
  status: boot.restored
    ? { tone: 'info', message: 'Reopened your last blueprint.', detail: boot.blueprint.name }
    : storageAvailable()
      ? { tone: 'info', message: 'New blueprint from the canonical 7–9 test composition.' }
      : { tone: 'warn', message: 'Browser storage is unavailable — use Export to keep your work.' },
});

let statusTimer = null;
function setStatus(message, tone = 'info', detail = '') {
  clearTimeout(statusTimer);
  store.set({ status: { message, tone, detail } });
  statusTimer = setTimeout(() => store.set({ status: null }), tone === 'error' ? 12000 : 5000);
}

/* ---------------- shared handlers ---------------- */

const getState = () => store.get();
const edit = (transform) => store.edit(transform);

const onSelect = (id) => store.set({ selectedId: id });
const onHover = (id) => {
  if (store.get().hoverId !== id) store.set({ hoverId: id });
};

const onView = (patch) => {
  store.edit((bp) => {
    let next = bp;
    for (const [key, value] of Object.entries(patch)) next = setView(next, key, value);
    return next;
  }, { dirty: false });
};

const onToggleVisible = (id) => {
  const state = store.get();
  const current = id === 'base'
    ? state.blueprint.base.visible !== false
    : state.blueprint.objects.find((o) => o.id === id)?.visible !== false;
  store.edit((bp) => setVisible(bp, id, !current), { dirty: false });
};

const onToggleLock = (id) => {
  const obj = store.get().blueprint.objects.find((o) => o.id === id);
  if (!obj) return;
  store.edit((bp) => setLocked(bp, id, !obj.locked));
};

/* ---------------- file operations ---------------- */

function doSave() {
  const { blueprint } = store.get();
  const result = saveBlueprint(blueprint, 'Saved from the composition canvas.');
  if (!result.ok) {
    setStatus('Could not save.', 'error', result.error);
    return;
  }
  store.set({ blueprint: result.blueprint, dirty: false });
  setStatus(`Saved ${result.blueprint.name} as r${result.blueprint.revision}.`, 'ok');
}

function confirmDiscard(action) {
  if (!store.get().dirty) return true;
  return window.confirm(`"${store.get().blueprint.name}" has unsaved changes. ${action} anyway?`);
}

function doNew() {
  if (!confirmDiscard('Start a new blueprint')) return;
  store.set({
    blueprint: createBlueprint({ name: 'Untitled blueprint' }),
    selectedId: null,
    dirty: false,
  });
  setStatus('New blueprint from the canonical 7–9 test composition.', 'ok');
}

function doOpen(id) {
  if (!confirmDiscard('Open another blueprint')) return;
  const { ok, errors, blueprint } = loadBlueprint(id);
  if (!blueprint) {
    setStatus('Could not open that blueprint.', 'error', errors.join(' '));
    return;
  }
  store.set({ blueprint, selectedId: null, dirty: false });
  rememberOpen(id);
  setStatus(
    ok ? `Opened ${blueprint.name} at r${blueprint.revision}.` : `Opened ${blueprint.name} with schema warnings.`,
    ok ? 'ok' : 'warn',
    ok ? '' : errors.join(' '),
  );
}

function doDelete() {
  const { blueprint } = store.get();
  if (!window.confirm(`Delete the saved copy of "${blueprint.name}"? The blueprint stays open here.`)) return;
  const result = deleteBlueprint(blueprint.id);
  if (!result.ok) {
    setStatus('Could not delete.', 'error', result.error);
    return;
  }
  store.set({ dirty: true });
  setStatus('Deleted the saved copy.', 'ok');
}

function doExport() {
  try {
    const { filename } = exportBlueprint(store.get().blueprint);
    setStatus(`Exported ${filename}.`, 'ok');
  } catch (error) {
    setStatus('Export failed.', 'error', error.message);
  }
}

async function doImport(file) {
  if (!confirmDiscard('Import a blueprint')) return;
  const { ok, errors, blueprint } = await importBlueprintFile(file);
  if (!blueprint) {
    setStatus('Could not import that file.', 'error', errors.join(' '));
    return;
  }
  store.set({ blueprint, selectedId: null, dirty: true });
  setStatus(
    ok ? `Imported ${blueprint.name}.` : `Imported ${blueprint.name} with schema warnings.`,
    ok ? 'ok' : 'warn',
    ok ? 'Save it to add it to your library.' : errors.join(' '),
  );
}

/* ---------------- panels ---------------- */

const canvas = createCanvas({
  mount: document.getElementById('canvas-mount'),
  getState,
  onEdit: edit,
  onSelect,
  onHover,
  onView,
});

const layers = createLayersPanel({
  mount: document.getElementById('layers-mount'),
  getState,
  onSelect,
  onToggleVisible,
  onToggleLock,
  onView,
});

const inspector = createInspector({
  mount: document.getElementById('inspector-mount'),
  getState,
  onEdit: edit,
  onSelect,
  onToggleLock,
  onProperty: (id, path, value) => edit((bp) => updateProperty(bp, id, path, value)),
  onAuthorNote: (id, note) => edit((bp) => setAuthorNote(bp, id, note)),
  onExplanationOverride: (id, text) => edit((bp) => setExplanationOverride(bp, id, text)),
  onBlueprintField: (path, value) => edit((bp) => setBlueprintField(bp, path, value)),
  onBaseProperty: (key, value) => edit((bp) => setBaseProperty(bp, key, value)),
});

const report = createReportPanel({
  mount: document.getElementById('report-mount'),
  getState,
  onSelect,
});

const toolbar = createToolbar({
  mount: document.getElementById('toolbar-mount'),
  getState,
  onNew: doNew,
  onSave: doSave,
  onOpen: doOpen,
  onDelete: doDelete,
  onExport: doExport,
  onImport: doImport,
  onView,
  onZoom: (factor) => canvas.zoomBy(factor),
  onFit: () => canvas.fit(),
});

/* ---------------- render loop ---------------- */

let frame = null;
function scheduleRender() {
  if (frame !== null) return;
  frame = requestAnimationFrame(() => {
    frame = null;
    canvas.render();
    layers.render();
    inspector.render();
    report.render();
    toolbar.render();
  });
}

/**
 * The inspector holds focus-sensitive inputs, so a full re-render on every
 * keystroke would steal the caret. Hover changes only affect the canvas and the
 * layer list, so they take a cheaper path.
 */
let previous = store.get();
store.subscribe((state) => {
  const onlyHoverChanged =
    state.blueprint === previous.blueprint &&
    state.selectedId === previous.selectedId &&
    state.status === previous.status &&
    state.dirty === previous.dirty;

  previous = state;

  if (onlyHoverChanged) {
    canvas.render();
    return;
  }
  scheduleRender();
});

scheduleRender();

/* ---------------- global shortcuts ---------------- */

window.addEventListener('keydown', (event) => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName);

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    doSave();
    return;
  }
  if (typing) return;

  if (event.key === 'c') onView({ clock_overlay: !store.get().blueprint.view.clock_overlay });
  else if (event.key === 'r') onView({ rest_zones: !store.get().blueprint.view.rest_zones });
  else if (event.key === 'g') onView({ gravity_marker: !store.get().blueprint.view.gravity_marker });
  else if (event.key === '0') canvas.fit();
  else if (event.key === 'l') {
    const { selectedId } = store.get();
    if (selectedId && selectedId !== 'base') onToggleLock(selectedId);
  }
});

window.addEventListener('beforeunload', (event) => {
  if (!store.get().dirty) return;
  event.preventDefault();
  event.returnValue = '';
});
