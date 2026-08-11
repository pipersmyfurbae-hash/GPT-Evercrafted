/**
 * Bottom panel — validation report and blueprint summary.
 *
 * The wireframe reserves this strip for a realistic render preview. Rendering is
 * explicitly out of scope for Sprint 1, so the strip carries the validation
 * report instead, with the render slot present but visibly inert — the panel's
 * shape matches the wireframe without pretending the engine behind it exists.
 */

import { h, replace } from './dom.js';
import { validateBlueprint } from '../core/validate.js';
import { getRules } from '../core/canon.js';

export function createReportPanel({ mount, getState, onSelect }) {
  function render() {
    const { blueprint } = getState();
    const report = validateBlueprint(blueprint);

    const summary = h('div', { class: 'report-summary' },
      h('span', {
        class: `verdict ${report.ok ? 'is-ok' : 'is-blocked'}`,
        text: report.ok ? 'Valid' : `${report.counts.errors} blocking`,
      }),
      h('span', { class: 'report-counts' },
        `${report.counts.passed} passing`,
        report.counts.advisories
          ? h('span', { class: 'advisory-count', text: ` · ${report.counts.advisories} advisory` })
          : null,
        report.counts.metrics
          ? h('span', { class: 'metric-count', text: ` · ${report.counts.metrics} measured` })
          : null,
        report.counts.provisional
          ? h('span', { class: 'provisional-count', text: ` · ${report.counts.provisional} provisional` })
          : null));

    replace(mount,
      h('div', { class: 'report-head' },
        h('h3', { class: 'panel-heading', text: 'Validation' }),
        summary),
      h('div', { class: 'report-columns' },
        column('Blocking — ticket §8', report.blocking, 'blocking', onSelect),
        column('Advisory & measured — spec & canon', [...report.advisory, ...report.metrics], 'advisory', onSelect),
        h('div', { class: 'report-column report-render' },
          h('h4', { class: 'report-column-title', text: 'Render preview' }),
          h('div', { class: 'render-slot' },
            h('span', { class: 'render-slot-text', text: 'Rendering is out of scope for Sprint 1.' }),
            h('span', { class: 'render-slot-note', text: 'The blueprint stays the source of truth; the render is downstream feedback, not the authority.' })))));
  }

  return { render };
}

const MARKS = { pass: '✓', fail: '!', measured: '·' };

function column(title, results, level, onSelect) {
  const failures = results.filter((r) => r.status === 'fail');
  return h('div', { class: `report-column report-${level}` },
    h('h4', { class: 'report-column-title' }, title,
      h('span', {
        class: `column-badge ${failures.length ? 'has-issues' : 'is-clear'}`,
        text: failures.length ? String(failures.length) : '✓',
      })),
    h('ul', { class: 'result-list' },
      ...results.map((result) => h('li', { class: `result result-${result.status}` },
        h('div', { class: 'result-head' },
          h('span', { class: `result-mark ${result.status}`, text: MARKS[result.status] ?? '·' }),
          h('span', { class: 'result-title', text: result.title }),
          // Enforcement and confidence are independent, so both are shown when
          // either is not the default. A blocking check with a provisional basis
          // is legitimate — the tooltip carries the reason it still blocks.
          result.enforcement === 'metric'
            ? h('span', {
                class: 'authority-tag is-metric',
                title: result.enforcement_reason,
                text: 'measured',
              })
            : null,
          result.confidence === 'provisional'
            ? h('span', {
                class: 'authority-tag is-provisional',
                title: `${result.enforcement_reason} EC-GEO-001 / EC-CAL own the calibrated replacement.`,
                text: 'provisional',
              })
            : null),
        h('p', { class: 'result-detail', text: result.detail }),
        result.objects?.length
          ? h('div', { class: 'result-objects' }, ...result.objects.map((id) =>
              h('button', { class: 'result-object', type: 'button', onClick: () => onSelect(id) }, id)))
          : null,
        result.canon?.length
          ? h('details', { class: 'result-canon' },
              h('summary', { text: `Canon · ${result.canon.join(', ')}` }),
              ...getRules(result.canon).map((rule) =>
                h('p', { class: 'canon-text' },
                  h('span', { class: 'canon-rule-id', text: rule.label }),
                  ` "${rule.text}"`)))
          : null))));
}
