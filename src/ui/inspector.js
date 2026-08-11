/**
 * Right panel — Inspector + Explainability.
 *
 * The wireframe's UX principle: "make the reasoning visible without forcing the
 * user to read technical data unless they want it." So the panel leads with the
 * plain-language explanation, and the numeric controls sit underneath it.
 *
 * Property controls are generated from PROPERTY_SPECS rather than hand-written,
 * so bounds and labels cannot drift away from what the actions layer enforces.
 */

import { h, replace } from './dom.js';
import { formatClock, parseClock, widthDegToInches } from '../core/geometry.js';
import {
  GRAVITY_MODES,
  LIFECYCLE_STAGES,
  LIFECYCLE_STAGES_SPRINT1,
  PROPERTY_SPECS,
  baseRadii,
  byId,
  getPath,
  objectCenter,
  objectRange,
} from '../core/schema.js';
import { compositionGravity, presenceOf, readGravityDirection, restZones } from '../core/analysis.js';
import { describeLink, explainObject } from '../core/explain.js';

export function createInspector({
  mount,
  getState,
  onEdit,
  onSelect,
  onToggleLock,
  onProperty,
  onAuthorNote,
  onExplanationOverride,
  onBlueprintField,
  onBaseProperty,
}) {
  function render() {
    const { blueprint, selectedId } = getState();

    if (!selectedId || selectedId === 'base') {
      replace(mount, ...renderBlueprintInspector(blueprint, selectedId === 'base'));
      return;
    }

    const obj = byId(blueprint, selectedId);
    if (!obj) {
      replace(mount, ...renderBlueprintInspector(blueprint, false));
      return;
    }

    replace(mount, ...renderObjectInspector(blueprint, obj));
  }

  /* ---------------- object inspector ---------------- */

  function renderObjectInspector(bp, obj) {
    const explanation = explainObject(bp, obj);
    const range = objectRange(obj);
    const presence = presenceOf(obj, bp.base);

    const header = h('header', { class: 'inspector-header' },
      h('div', { class: 'inspector-eyebrow' },
        h('span', { class: `dot swatch-${obj.role}` }),
        h('span', { text: obj.role.replace(/_/g, ' ') })),
      h('h2', { class: 'inspector-title', text: obj.label }),
      h('p', { class: 'inspector-what', text: explanation.what }));

    /* Position / weight summary — the wireframe's required readouts. */
    const spansRange = obj.kind === 'behavior_path' || obj.role === 'primary_anchor';
    const facts = h('dl', { class: 'fact-grid' },
      fact('Position', spansRange
        ? `${formatClock(range.start)} → ${formatClock(range.start + range.span)}`
        : formatClock(objectCenter(obj))),
      fact('Arc', `${range.span.toFixed(1)}°`),
      fact(obj.kind === 'clearance' ? 'Carries' : 'Presence',
        obj.kind === 'clearance' ? 'reserved void' : presence.toFixed(1)),
      fact('Lock', obj.locked ? 'Locked' : 'Free'));

    /* Explainability — the spec's five questions. */
    const explain = h('section', { class: 'panel-block block-explain' },
      h('h3', { class: 'block-title' }, 'Why this exists',
        h('span', { class: `source-tag ${explanation.source}`, text: explanation.source })),
      h('p', { class: 'explain-role', text: explanation.role }),
      h('p', { class: 'explain-why', text: explanation.why }),
      explanation.source === 'authored'
        ? h('details', { class: 'engine-why' },
            h('summary', { text: 'What the engine concluded' }),
            h('p', { text: explanation.engineWhy }))
        : null,
      h('div', { class: 'canon-list' },
        h('span', { class: 'canon-label', text: 'Canon' }),
        ...explanation.canonRules.map((rule) =>
          h('details', { class: 'canon-rule' },
            h('summary', { text: rule.label }),
            h('p', { class: 'canon-text', text: `"${rule.text}"` }),
            h('p', { class: 'canon-doc', text: `${rule.docTitle} v${rule.docVersion}` })))));

    /* Dependencies */
    const dependencies = h('section', { class: 'panel-block' },
      h('h3', { class: 'block-title' }, 'Dependencies'),
      h('div', { class: 'dep-group' },
        h('span', { class: 'dep-label', text: 'Follows' }),
        explanation.dependsOn.length
          ? h('ul', { class: 'dep-list' }, ...explanation.dependsOn.map((dep) =>
              h('li', {},
                dep.id === 'base'
                  ? h('span', { class: 'dep-static', text: dep.label })
                  : h('button', { class: 'dep-link', type: 'button', onClick: () => onSelect(dep.id) }, dep.label),
                dep.relationship ? h('span', { class: 'dep-note', text: dep.relationship }) : null)))
          : h('p', { class: 'dep-empty', text: 'Nothing.' })),
      h('div', { class: 'dep-group' },
        h('span', { class: 'dep-label', text: 'Moves with it' }),
        explanation.dependents.length
          ? h('ul', { class: 'dep-list' }, ...explanation.dependents.map((dep) =>
              h('li', {},
                h('button', { class: 'dep-link', type: 'button', onClick: () => onSelect(dep.id) }, dep.label),
                h('span', { class: 'dep-note', text: dep.relationship }))))
          : h('p', { class: 'dep-empty', text: 'Nothing depends on this.' })),
      obj.link
        ? h('p', { class: 'dep-summary', text: describeLink(obj) })
        : h('p', { class: 'dep-summary', text: 'Positioned absolutely — this is the object others follow.' }));

    /* Lock control */
    const lockRow = h('div', { class: 'lock-row' },
      h('button', {
        class: `lock-button ${obj.locked ? 'is-locked' : ''}`,
        type: 'button',
        onClick: () => onToggleLock(obj.id),
      }, obj.locked ? 'Unlock' : 'Lock'),
      h('span', {
        class: 'lock-note',
        text: obj.locked
          ? 'Held in place. It will not reflow when the anchor moves.'
          : 'Reflows automatically when the anchor moves.',
      }));

    /* Editable properties */
    const specs = PROPERTY_SPECS[obj.role] ?? [];
    const properties = h('section', { class: 'panel-block' },
      h('h3', { class: 'block-title' }, 'Properties'),
      obj.locked
        ? h('p', { class: 'locked-warning', text: 'This object is locked. Unlock it to edit.' })
        : null,
      ...specs.map((spec) => renderControl(bp, obj, spec)));

    /* Learning-loop capture */
    const authoring = h('section', { class: 'panel-block block-authoring' },
      h('h3', { class: 'block-title' }, 'Author notes'),
      h('label', { class: 'field' },
        h('span', { class: 'field-label', text: 'Why I changed this' }),
        h('textarea', {
          class: 'field-input',
          rows: '2',
          placeholder: 'What the edit improved — balance, hierarchy, breathing room…',
          value: explanation.authorNote,
          onChange: (event) => onAuthorNote(obj.id, event.target.value),
        }),
        h('span', { class: 'field-hint', text: 'Captured for the learning loop. A human edit is not automatically a new rule.' })),
      h('label', { class: 'field' },
        h('span', { class: 'field-label', text: 'Override the explanation' }),
        h('textarea', {
          class: 'field-input',
          rows: '2',
          placeholder: 'Leave empty to keep the engine explanation',
          value: obj.explanation?.override ?? '',
          onChange: (event) => onExplanationOverride(obj.id, event.target.value),
        })));

    return [header, facts, explain, lockRow, properties, dependencies, authoring];
  }

  /* ---------------- property controls ---------------- */

  function renderControl(bp, obj, spec) {
    const value = getPath(obj, spec.key);
    const disabled = obj.locked;
    const id = `prop-${obj.id}-${spec.key.replace(/\./g, '-')}`;

    const label = h('label', { class: 'field-label', for: id, text: spec.label });
    const hint = spec.hint ? h('span', { class: 'field-hint', text: spec.hint }) : null;

    if (spec.kind === 'select') {
      return h('div', { class: 'field' }, label,
        h('select', {
          id, class: 'field-input', disabled,
          onChange: (event) => onProperty(obj.id, spec.key, event.target.value),
        }, ...spec.options.map((option) =>
          h('option', { value: option, selected: option === value, text: option.replace(/_/g, ' ') }))),
        hint);
    }

    if (spec.kind === 'text' || spec.kind === 'textarea') {
      const input = spec.kind === 'textarea'
        ? h('textarea', {
            id, class: 'field-input', rows: '2', disabled,
            placeholder: spec.placeholder ?? '',
            value: value ?? '',
            onChange: (event) => onProperty(obj.id, spec.key, event.target.value),
          })
        : h('input', {
            id, class: 'field-input', type: 'text', disabled,
            placeholder: spec.placeholder ?? '',
            value: value ?? '',
            onChange: (event) => onProperty(obj.id, spec.key, event.target.value),
          });
      return h('div', { class: 'field' }, label, input, hint);
    }

    if (spec.kind === 'clock') {
      return h('div', { class: 'field' }, label,
        h('div', { class: 'field-row' },
          h('input', {
            id, class: 'field-input field-clock', type: 'text', disabled,
            value: formatClock(value ?? 0),
            onChange: (event) => {
              const deg = parseClock(event.target.value);
              if (deg === null) {
                event.target.value = formatClock(value ?? 0);
                return;
              }
              onProperty(obj.id, spec.key, deg);
            },
          }),
          h('span', { class: 'field-unit', text: `${Number(value ?? 0).toFixed(0)}°` })),
        hint);
    }

    /* Numeric kinds: slider plus a typed value, kept in sync. */
    const suffix = spec.kind === 'deg' ? '°' : spec.unit ? ` ${spec.unit}` : '';
    const display = spec.kind === 'width'
      ? `${widthDegToInches(Number(value), baseRadii(bp.base).rMean).toFixed(2)} in`
      : `${Number(value ?? 0).toFixed(spec.step < 1 ? 2 : 0)}${suffix}`;

    return h('div', { class: 'field' },
      h('div', { class: 'field-head' }, label, h('span', { class: 'field-value', text: display })),
      h('div', { class: 'field-row' },
        h('input', {
          id, class: 'field-slider', type: 'range', disabled,
          min: spec.min, max: spec.max, step: spec.step, value: Number(value ?? 0),
          onInput: (event) => onProperty(obj.id, spec.key, Number(event.target.value)),
        }),
        h('input', {
          class: 'field-number', type: 'number', disabled,
          min: spec.min, max: spec.max, step: spec.step, value: Number(value ?? 0),
          onChange: (event) => onProperty(obj.id, spec.key, Number(event.target.value)),
        })),
      spec.kind === 'width'
        ? h('span', { class: 'field-hint', text: `${Number(value ?? 0).toFixed(1)}° at the ring mean radius. ${spec.hint ?? ''}` })
        : hint);
  }

  /* ---------------- blueprint inspector ---------------- */

  function renderBlueprintInspector(bp, baseSelected) {
    const gravity = compositionGravity(bp);
    const zones = restZones(bp);
    const restDegrees = zones.reduce((sum, z) => sum + z.span, 0);
    const { rInner, rOuter, rMean } = baseRadii(bp.base);

    const header = h('header', { class: 'inspector-header' },
      h('div', { class: 'inspector-eyebrow' },
        h('span', { class: 'dot swatch-base' }),
        h('span', { text: baseSelected ? 'base' : 'blueprint' })),
      h('h2', { class: 'inspector-title', text: bp.name }),
      h('p', { class: 'inspector-what', text: baseSelected
        ? 'The wreath form every other object is positioned against.'
        : 'Nothing selected. Click an object on the canvas to see why it exists.' }));

    const facts = h('dl', { class: 'fact-grid' },
      fact('Revision', `r${bp.revision}`),
      fact('Status', (bp.lifecycle_status ?? 'draft').replace(/_/g, ' ')),
      fact('Objects', String(bp.objects.length)),
      fact('Schema', bp.schema_version));

    const form = h('section', { class: 'panel-block' },
      h('h3', { class: 'block-title' }, 'Form'),
      numberField('Diameter', bp.base.diameter_in, 6, 72, 0.5, 'in',
        (value) => onBaseProperty('diameter_in', value)),
      numberField('Ring width', bp.base.ring_width_in, 1, 24, 0.25, 'in',
        (value) => onBaseProperty('ring_width_in', value)),
      numberField('Depth', bp.base.depth_in, 0.5, 18, 0.25, 'in',
        (value) => onBaseProperty('depth_in', value)),
      h('p', { class: 'field-hint', text: `Outer radius ${rOuter.toFixed(2)} in · inner ${rInner.toFixed(2)} in · mean ${rMean.toFixed(2)} in.` }));

    const intent = h('section', { class: 'panel-block' },
      h('h3', { class: 'block-title' }, 'Intent'),
      h('label', { class: 'field' },
        h('span', { class: 'field-label', text: 'Blueprint name' }),
        h('input', {
          class: 'field-input', type: 'text', value: bp.name,
          onChange: (event) => onBlueprintField('name', event.target.value || 'Untitled blueprint'),
        })),
      h('label', { class: 'field' },
        h('span', { class: 'field-label', text: 'Emotional intent' }),
        h('textarea', {
          class: 'field-input', rows: '3',
          placeholder: 'The essence this design is interpreting…',
          value: bp.emotional_profile?.intent ?? '',
          onChange: (event) => onBlueprintField('emotional_profile.intent', event.target.value),
        })),
      h('label', { class: 'field' },
        h('span', { class: 'field-label', text: 'Declared composition gravity' }),
        h('select', {
          class: 'field-input',
          onChange: (event) => onBlueprintField('composition_gravity.declared', event.target.value),
        }, ...GRAVITY_MODES.map((mode) =>
          h('option', { value: mode, selected: mode === bp.composition_gravity?.declared, text: mode }))),
        h('span', { class: 'field-hint', text: 'Authored intent. The canon documents disagree on whether gravity leads or follows placement — see CONFLICTS.md C-01 — so this is held next to the computed reading rather than enforced against it.' })),
      h('label', { class: 'field' },
        h('span', { class: 'field-label', text: 'Lifecycle status' }),
        h('select', {
          class: 'field-input',
          onChange: (event) => onBlueprintField('lifecycle_status', event.target.value),
        }, ...LIFECYCLE_STAGES.map((stage) =>
          // Later stages need engines that do not exist yet — shown so the
          // lifecycle is legible, disabled so it cannot be claimed falsely.
          h('option', {
            value: stage,
            selected: stage === bp.lifecycle_status,
            disabled: !LIFECYCLE_STAGES_SPRINT1.includes(stage),
            text: stage.replace(/_/g, ' '),
          })))));

    const computed = h('section', { class: 'panel-block' },
      h('h3', { class: 'block-title' }, 'Computed'),
      h('dl', { class: 'fact-grid fact-grid-wide' },
        fact('Gravity reads', readGravityDirection(gravity)),
        fact('Concentration', gravity.concentration.toFixed(2)),
        fact('Total presence', gravity.total.toFixed(1)),
        fact('Negative space', `${Math.round(restDegrees)}° in ${zones.length}`)),
      h('ul', { class: 'presence-list' },
        ...gravity.contributions.map((entry) =>
          h('li', {},
            h('button', { class: 'dep-link', type: 'button', onClick: () => onSelect(entry.id) }, entry.label),
            h('span', { class: 'presence-bar' },
              h('span', {
                class: 'presence-fill',
                style: { width: `${(entry.presence / (gravity.contributions[0]?.presence || 1)) * 100}%` },
              })),
            h('span', { class: 'presence-value', text: entry.presence.toFixed(1) })))));

    const history = h('section', { class: 'panel-block' },
      h('h3', { class: 'block-title' }, 'History'),
      h('ul', { class: 'history-list' },
        ...[...(bp.history ?? [])].reverse().slice(0, 8).map((entry) =>
          h('li', {},
            h('span', { class: 'history-rev', text: `r${entry.revision}` }),
            h('span', { class: 'history-note', text: entry.note }),
            h('span', { class: 'history-time', text: new Date(entry.at).toLocaleString() })))));

    return [header, facts, form, intent, computed, history];
  }

  return { render };
}

/* ---------------- small helpers ---------------- */

function fact(label, value) {
  return h('div', { class: 'fact' },
    h('dt', { text: label }),
    h('dd', { text: value }));
}

function numberField(label, value, min, max, step, unit, onChange) {
  return h('div', { class: 'field' },
    h('div', { class: 'field-head' },
      h('span', { class: 'field-label', text: label }),
      h('span', { class: 'field-value', text: `${Number(value).toFixed(2)} ${unit}` })),
    h('div', { class: 'field-row' },
      h('input', {
        class: 'field-slider', type: 'range', min, max, step, value,
        onInput: (event) => onChange(Number(event.target.value)),
      }),
      h('input', {
        class: 'field-number', type: 'number', min, max, step, value,
        onChange: (event) => onChange(Number(event.target.value)),
      })));
}
