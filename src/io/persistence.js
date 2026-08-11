/**
 * Save / load.
 *
 * Sprint 1 ships two persistence paths and no backend:
 *
 *   - a browser-local blueprint library in localStorage, for the create/save/
 *     reload loop the ticket's Definition of Done describes;
 *   - JSON file export/import, so a blueprint can leave the machine, be
 *     versioned in git, or be handed to the next engine in the pipeline.
 *
 * A server was deliberately not built: nothing in the Sprint 1 scope requires
 * one, and adding it would put auth, hosting and migrations inside a sprint
 * whose stated goal is the composition canvas.
 *
 * Everything read from either path goes through `hydrate`, so a hand-edited or
 * older file is migrated and schema-checked before it reaches the canvas.
 */

import { hydrate, commitRevision } from '../core/actions.js';

const LIBRARY_KEY = 'evercrafted.placement-engine.library.v1';
const LAST_OPEN_KEY = 'evercrafted.placement-engine.last-open.v1';

function storage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    // Touch it — Safari private mode throws on write rather than on access.
    const probe = '__ec_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

function readLibrary() {
  const store = storage();
  if (!store) return {};
  try {
    const raw = store.getItem(LIBRARY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLibrary(library) {
  const store = storage();
  if (!store) return { ok: false, error: 'Browser storage is unavailable, so blueprints cannot be saved locally. Use Export JSON instead.' };
  try {
    store.setItem(LIBRARY_KEY, JSON.stringify(library));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `Could not write to browser storage: ${error.message}` };
  }
}

/**
 * Index of saved blueprints, newest first.
 *
 * Ties on the timestamp fall back to name then id, so two blueprints saved in the
 * same millisecond still list in a stable, predictable order rather than in
 * whatever order the storage object happens to enumerate.
 */
export function listBlueprints() {
  const library = readLibrary();
  return Object.values(library)
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      revision: entry.revision,
      updated_at: entry.updated_at,
      created_at: entry.created_at,
      lifecycle_status: entry.lifecycle_status,
    }))
    .sort(
      (a, b) =>
        String(b.updated_at).localeCompare(String(a.updated_at)) ||
        String(a.name).localeCompare(String(b.name)) ||
        String(a.id).localeCompare(String(b.id)),
    );
}

/**
 * Save a blueprint, stamping a new revision.
 * Returns the saved blueprint so the caller can adopt the new revision number.
 * `now` is injectable so the save path can be tested without wall-clock races.
 */
export function saveBlueprint(bp, note, now) {
  const stamped = commitRevision(bp, note, now);
  const library = readLibrary();
  library[stamped.id] = stamped;

  const written = writeLibrary(library);
  if (!written.ok) return { ok: false, error: written.error, blueprint: bp };

  const store = storage();
  if (store) {
    try {
      store.setItem(LAST_OPEN_KEY, stamped.id);
    } catch {
      /* non-fatal — the blueprint itself is saved */
    }
  }
  return { ok: true, blueprint: stamped };
}

/** Load one blueprint by id, migrating and validating on the way in. */
export function loadBlueprint(id) {
  const library = readLibrary();
  const raw = library[id];
  if (!raw) return { ok: false, errors: [`No saved blueprint with id "${id}".`], blueprint: null };

  const hydrated = hydrate(raw);
  if (hydrated.blueprint) {
    const store = storage();
    try {
      store?.setItem(LAST_OPEN_KEY, id);
    } catch {
      /* non-fatal */
    }
  }
  return hydrated;
}

export function deleteBlueprint(id) {
  const library = readLibrary();
  if (!library[id]) return { ok: false, error: 'Not found.' };
  delete library[id];
  return writeLibrary(library);
}

export function lastOpenedId() {
  const store = storage();
  try {
    return store?.getItem(LAST_OPEN_KEY) ?? null;
  } catch {
    return null;
  }
}

export function rememberOpen(id) {
  const store = storage();
  try {
    store?.setItem(LAST_OPEN_KEY, id);
  } catch {
    /* non-fatal */
  }
}

export function storageAvailable() {
  return storage() !== null;
}

/* ------------------------------------------------------------------ *
 * File export / import
 * ------------------------------------------------------------------ */

function safeFilename(name) {
  const slug = String(name || 'blueprint')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'blueprint';
}

/** Download the blueprint as formatted JSON. */
export function exportBlueprint(bp) {
  const json = JSON.stringify(bp, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFilename(bp.name)}-r${bp.revision}.ecbp.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Revoke on the next frame so the download has taken the URL.
  requestAnimationFrame(() => URL.revokeObjectURL(url));
  return { ok: true, filename: link.download };
}

/** Read a File/Blob chosen by the user and hydrate it. */
export async function importBlueprintFile(file) {
  let text;
  try {
    text = await file.text();
  } catch (error) {
    return { ok: false, errors: [`Could not read the file: ${error.message}`], blueprint: null };
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { ok: false, errors: [`That file is not valid JSON: ${error.message}`], blueprint: null };
  }

  return hydrate(parsed);
}
