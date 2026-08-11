/** Top bar — blueprint identity, save/load, and canvas view controls. */

import { h, replace } from './dom.js';
import { listBlueprints } from '../io/persistence.js';

export function createToolbar({
  mount,
  getState,
  onNew,
  onSave,
  onOpen,
  onDelete,
  onExport,
  onImport,
  onView,
  onZoom,
  onFit,
}) {
  function render() {
    const { blueprint, dirty, status } = getState();
    const view = blueprint.view ?? {};
    const saved = listBlueprints();

    const identity = h('div', { class: 'toolbar-identity' },
      h('span', { class: 'brand' },
        h('span', { class: 'brand-mark' }),
        h('span', { class: 'brand-text', text: 'Placement Engine' })),
      h('span', { class: 'brand-sprint', text: 'Sprint 1 · Composition Canvas' }));

    const file = h('div', { class: 'toolbar-group' },
      h('span', { class: 'blueprint-name' }, blueprint.name,
        h('span', { class: 'revision-chip', text: `r${blueprint.revision}` }),
        dirty ? h('span', { class: 'dirty-chip', title: 'Unsaved changes', text: '●' }) : null),
      h('button', { class: 'btn btn-primary', type: 'button', onClick: onSave }, 'Save'),
      h('button', { class: 'btn', type: 'button', onClick: onNew }, 'New'),
      h('select', {
        class: 'btn btn-select',
        title: 'Open a saved blueprint',
        onChange: (event) => {
          if (event.target.value) onOpen(event.target.value);
          event.target.selectedIndex = 0;
        },
      },
        h('option', { value: '', text: saved.length ? `Open… (${saved.length})` : 'No saved blueprints' }),
        ...saved.map((entry) => h('option', {
          value: entry.id,
          text: `${entry.name} · r${entry.revision}`,
        }))),
      h('button', { class: 'btn', type: 'button', onClick: onExport, title: 'Download this blueprint as JSON' }, 'Export'),
      h('label', { class: 'btn btn-file', title: 'Load a blueprint from a JSON file' }, 'Import',
        h('input', {
          type: 'file',
          accept: '.json,application/json',
          onChange: (event) => {
            const [file] = event.target.files ?? [];
            if (file) onImport(file);
            event.target.value = '';
          },
        })),
      blueprint.id && saved.some((entry) => entry.id === blueprint.id)
        ? h('button', { class: 'btn btn-quiet', type: 'button', onClick: onDelete, title: 'Delete the saved copy' }, 'Delete')
        : null);

    const viewControls = h('div', { class: 'toolbar-group toolbar-view' },
      toggle('Clock', view.clock_overlay, () => onView({ clock_overlay: !view.clock_overlay }), 'Toggle the clock overlay'),
      toggle('Rest', view.rest_zones, () => onView({ rest_zones: !view.rest_zones }), 'Toggle derived negative space'),
      toggle('Gravity', view.gravity_marker, () => onView({ gravity_marker: !view.gravity_marker }), 'Toggle the composition gravity marker'),
      h('span', { class: 'toolbar-divider' }),
      h('button', { class: 'btn btn-icon', type: 'button', onClick: () => onZoom(1 / 1.25), title: 'Zoom out' }, '−'),
      h('span', { class: 'zoom-readout', text: `${Math.round((view.zoom ?? 1) * 100)}%` }),
      h('button', { class: 'btn btn-icon', type: 'button', onClick: () => onZoom(1.25), title: 'Zoom in' }, '+'),
      h('button', { class: 'btn btn-icon', type: 'button', onClick: onFit, title: 'Reset zoom and pan' }, '⤢'));

    replace(mount, identity, h('div', { class: 'toolbar-main' }, file, viewControls),
      status
        ? h('div', { class: `toolbar-status status-${status.tone ?? 'info'}` },
            h('span', { class: 'status-text', text: status.message }),
            status.detail ? h('span', { class: 'status-detail', text: status.detail }) : null)
        : null);
  }

  return { render };
}

function toggle(label, active, onClick, title) {
  return h('button', {
    class: `btn btn-toggle ${active ? 'is-on' : ''}`,
    type: 'button',
    title,
    'aria-pressed': String(Boolean(active)),
    onClick,
  }, label);
}
