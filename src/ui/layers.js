/**
 * Left panel — Layers / Structure.
 *
 * Mirrors the UI wireframe's layer list. Layers belonging to engines that do not
 * exist yet are shown disabled and labelled with the sprint that will build them,
 * rather than hidden: the wireframe's structure stays legible, and it is obvious
 * what Sprint 1 does and does not cover.
 */

import { h, replace } from './dom.js';
import { formatClock } from '../core/geometry.js';
import { objectCenter, objectRange } from '../core/schema.js';
import { presenceOf } from '../core/analysis.js';
import { shortReason } from '../core/explain.js';

/** Layers the ticket explicitly defers. Shown, but inert. */
const FUTURE_LAYERS = [
  { label: 'Greenery architecture', note: 'Behaviour paths beyond the primary sweep' },
  { label: 'Floral pockets', note: 'Generated from the architecture' },
  { label: 'Floral roles', note: 'Needs the Floral Role Engine' },
  { label: 'Inventory assignments', note: 'Out of scope for Sprint 1' },
];

function iconButton(label, active, onClick, title, extraClass = '') {
  return h('button', {
    class: `layer-toggle ${extraClass} ${active ? 'is-on' : 'is-off'}`,
    type: 'button',
    title,
    'aria-pressed': String(Boolean(active)),
    onClick: (event) => {
      event.stopPropagation();
      onClick();
    },
  }, label);
}

export function createLayersPanel({ mount, getState, onSelect, onToggleVisible, onToggleLock, onView }) {
  function render() {
    const { blueprint, selectedId } = getState();
    const view = blueprint.view ?? {};

    const rows = [];

    /* Base */
    rows.push(h('div', {
      class: 'layer-row is-base',
      onClick: () => onSelect('base'),
      'data-selected': String(selectedId === 'base'),
    },
      h('div', { class: 'layer-main' },
        h('span', { class: 'layer-swatch swatch-base' }),
        h('div', { class: 'layer-text' },
          h('span', { class: 'layer-name', text: 'Base' }),
          h('span', { class: 'layer-meta', text: `${blueprint.base.diameter_in} in form · ${blueprint.base.ring_width_in} in ring` }))),
      h('div', { class: 'layer-actions' },
        iconButton('◉', blueprint.base.visible !== false, () => onToggleVisible('base'), 'Show or hide the base'))));

    /* Objects, in the wireframe's reading order rather than draw order. */
    const order = ['primary_anchor', 'hardware_clearance', 'primary_sweep', 'secondary_echo'];
    const objects = [...blueprint.objects].sort(
      (a, b) => order.indexOf(a.role) - order.indexOf(b.role),
    );

    for (const obj of objects) {
      const range = objectRange(obj);
      const presence = presenceOf(obj, blueprint.base);

      // Objects the ticket describes as a span read as a range ("7:00 → 9:00");
      // objects it describes by position read as a centre ("5:00").
      const meta = obj.kind === 'behavior_path' || obj.role === 'primary_anchor'
        ? `${formatClock(range.start)} → ${formatClock(range.start + range.span)} · ${Math.round(range.span)}°`
        : `${formatClock(objectCenter(obj))} · ${Math.round(range.span)}° arc`;

      rows.push(h('div', {
        class: `layer-row layer-${obj.role}${obj.visible === false ? ' is-hidden' : ''}${obj.locked ? ' is-locked' : ''}`,
        'data-selected': String(selectedId === obj.id),
        onClick: () => onSelect(obj.id),
        title: shortReason(blueprint, obj),
      },
        h('div', { class: 'layer-main' },
          h('span', { class: `layer-swatch swatch-${obj.role}` }),
          h('div', { class: 'layer-text' },
            h('span', { class: 'layer-name', text: obj.label }),
            h('span', { class: 'layer-meta', text: meta }),
            presence > 0
              ? h('span', { class: 'layer-presence', text: `presence ${presence.toFixed(1)}` })
              : h('span', { class: 'layer-presence is-void', text: 'reserved void' }))),
        h('div', { class: 'layer-actions' },
          iconButton(obj.locked ? '🔒' : '🔓', obj.locked, () => onToggleLock(obj.id),
            obj.locked ? 'Unlock — let it follow the anchor again' : 'Lock — hold it in place when the anchor moves',
            'is-lock'),
          iconButton('◉', obj.visible !== false, () => onToggleVisible(obj.id), 'Show or hide'))));
    }

    /* Derived overlays */
    rows.push(h('div', { class: 'layer-group-label', text: 'Derived' }));

    rows.push(overlayRow('Negative space', 'rest_zones', view.rest_zones,
      'Computed from the gaps between placed objects. Read-only in Sprint 1.', onView));
    rows.push(overlayRow('Clock overlay', 'clock_overlay', view.clock_overlay,
      'Hour positions and spokes.', onView));
    rows.push(overlayRow('Composition gravity', 'gravity_marker', view.gravity_marker,
      'Presence-weighted centre of visual weight.', onView));

    /* Deferred layers */
    rows.push(h('div', { class: 'layer-group-label', text: 'Later sprints' }));
    for (const layer of FUTURE_LAYERS) {
      rows.push(h('div', { class: 'layer-row is-future', title: layer.note },
        h('div', { class: 'layer-main' },
          h('span', { class: 'layer-swatch swatch-future' }),
          h('div', { class: 'layer-text' },
            h('span', { class: 'layer-name', text: layer.label }),
            h('span', { class: 'layer-meta', text: layer.note })))));
    }

    replace(mount, ...rows);
  }

  return { render };
}

function overlayRow(label, key, active, note, onView) {
  return h('div', {
    class: `layer-row is-overlay${active ? '' : ' is-hidden'}`,
    onClick: () => onView({ [key]: !active }),
    title: note,
  },
    h('div', { class: 'layer-main' },
      h('span', { class: `layer-swatch swatch-${key}` }),
      h('div', { class: 'layer-text' },
        h('span', { class: 'layer-name', text: label }),
        h('span', { class: 'layer-meta', text: note }))),
    h('div', { class: 'layer-actions' },
      h('button', {
        class: `layer-toggle ${active ? 'is-on' : 'is-off'}`,
        type: 'button',
        'aria-pressed': String(Boolean(active)),
        onClick: (event) => {
          event.stopPropagation();
          onView({ [key]: !active });
        },
      }, '◉')));
}
