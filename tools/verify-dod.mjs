#!/usr/bin/env node
/**
 * Walks the Sprint 1 ticket's Definition of Done against the running app.
 *
 * The node:test suite covers the engine without a browser. This covers the part
 * a unit test cannot: that a person can actually open the canvas, drag the
 * anchor, watch the sweep and echo follow, read why an object exists, save, and
 * reopen it unchanged.
 *
 * Playwright is NOT a dependency of this project — `npm test` stays zero-dep.
 * To run this:
 *
 *     npm start                       # in one terminal
 *     npm i -D playwright             # once
 *     npx playwright install chromium # once, unless a browser is already present
 *     node tools/verify-dod.mjs
 *
 * Set BASE_URL to point at a different origin, or PW_CHROMIUM to an existing
 * Chromium binary.
 */

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright is not installed. See the header of this file for setup.');
  process.exit(2);
}

const launchOptions = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};

let passed = 0;
const check = (label, condition, detail = '') => {
  if (!condition) throw new Error(`FAILED — ${label}${detail ? `: ${detail}` : ''}`);
  passed += 1;
  console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch(launchOptions);
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();

const jsErrors = [];
page.on('pageerror', (error) => jsErrors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') jsErrors.push(`console: ${message.text()}`);
});

// A fresh context already has empty storage. Do NOT use addInitScript to clear
// it — that re-runs on every navigation, including the reload that DoD 9 needs
// in order to prove the saved blueprint comes back.
await page.goto(BASE_URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

const meta = (role) => page.locator(`.layer-${role} .layer-meta`).textContent();

try {
  console.log('\nDoD 1 — open a 24-inch wreath canvas');
  const base = await page.evaluate(() => ({
    outerR: Number(document.querySelector('.base-edge').getAttribute('r')),
    objects: document.querySelectorAll('svg.canvas .object').length,
  }));
  check('canvas opens at a 24 in base', base.outerR === 12, `outer radius ${base.outerR} in`);
  check('all four Sprint 1 objects render', base.objects === 4, `${base.objects} objects`);

  console.log('\nDoD 2 — see and toggle clock positions');
  const on = await page.locator('.clock-numeral').count();
  await page.getByRole('button', { name: 'Clock', exact: true }).click();
  await page.waitForTimeout(150);
  const off = await page.locator('.clock-numeral').count();
  await page.getByRole('button', { name: 'Clock', exact: true }).click();
  await page.waitForTimeout(150);
  check('clock overlay toggles', on === 12 && off === 0, `${on} numerals on, ${off} off`);

  console.log('\nDoD 3 — edit the 7–9 anchor');
  const anchorStart = (await meta('primary_anchor')).trim();
  check('anchor starts at the canonical 7–9', anchorStart.startsWith('7:00 → 9:00'), anchorStart);

  // Drag the anchor body. Grab at 220 deg — inside the anchor arc but clear of
  // the bow clearance at 229-251 deg, which draws above it and wins the hit test.
  const box = await page.locator('svg.canvas').boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const radiusPx = (box.height / 34) * 9.5;
  const at = (deg) => ({
    x: cx + radiusPx * Math.sin((deg * Math.PI) / 180),
    y: cy - radiusPx * Math.cos((deg * Math.PI) / 180),
  });

  let point = at(220);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  point = at(235);
  await page.mouse.move(point.x, point.y, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(250);

  const dragged = (await meta('primary_anchor')).trim();
  check('anchor moves on canvas drag', dragged !== anchorStart, `${anchorStart} → ${dragged}`);

  console.log('\nDoD 6 — relationships update visually');
  const followed = {
    sweep: (await meta('primary_sweep')).trim(),
    echo: (await meta('secondary_echo')).trim(),
    clearance: (await meta('hardware_clearance')).trim(),
  };
  check('sweep followed the anchor', !followed.sweep.startsWith('9:00 →'), followed.sweep);
  check('echo followed the anchor', !followed.echo.startsWith('5:00'), followed.echo);
  check('clearance followed the anchor', !followed.clearance.startsWith('8:00'), followed.clearance);

  await page.locator('#prop-anchor-1-start_deg').fill('7:00');
  await page.locator('#prop-anchor-1-start_deg').press('Enter');
  await page.waitForTimeout(250);
  check('typed clock notation edits the anchor', (await meta('primary_anchor')).trim().startsWith('7:00 → 9:00'));

  console.log('\nDoD 4 — edit the primary sweep');
  await page.locator('.layer-primary_sweep').click();
  await page.waitForTimeout(200);
  const sweepBefore = (await meta('primary_sweep')).trim();
  await page.locator('#prop-sweep-1-arc_deg').fill('160');
  await page.locator('#prop-sweep-1-arc_deg').dispatchEvent('change');
  await page.waitForTimeout(250);
  check('sweep travel is editable', (await meta('primary_sweep')).trim() !== sweepBefore,
    `${sweepBefore} → ${(await meta('primary_sweep')).trim()}`);

  // C-04 (REVISED): thickness is radial and independent of travel.
  const widthLabel = await page.locator('#prop-sweep-1-band_width_norm').evaluate((el) =>
    el.closest('.field').querySelector('.field-value').textContent);
  check('sweep band width reads as a radial thickness in inches', widthLabel.includes('in'), widthLabel);

  const travelAfterWidening = (await meta('primary_sweep')).trim();
  await page.locator('#prop-sweep-1-band_width_norm').fill('0.5');
  await page.locator('#prop-sweep-1-band_width_norm').dispatchEvent('change');
  await page.waitForTimeout(250);
  check('changing thickness does not change travel',
    (await meta('primary_sweep')).trim() === travelAfterWidening, travelAfterWidening);

  const widerLabel = await page.locator('#prop-sweep-1-band_width_norm').evaluate((el) =>
    el.closest('.field').querySelector('.field-value').textContent);
  check('thickness is a fraction of the ring, not an arc length',
    widerLabel.trim().startsWith('2.50'), `${widthLabel.trim()} -> ${widerLabel.trim()} of a 5 in ring`);

  await page.locator('#prop-sweep-1-band_width_norm').fill('0.3');
  await page.locator('#prop-sweep-1-band_width_norm').dispatchEvent('change');
  await page.waitForTimeout(200);

  console.log('\nDoD 5 — edit the 5 o’clock echo');
  await page.locator('.layer-secondary_echo').click();
  await page.waitForTimeout(200);
  const echoBefore = (await meta('secondary_echo')).trim();
  await page.locator('#prop-echo-1-arc_deg').fill('46');
  await page.locator('#prop-echo-1-arc_deg').dispatchEvent('change');
  await page.waitForTimeout(250);
  check('echo is editable', (await meta('secondary_echo')).trim() !== echoBefore,
    `${echoBefore} → ${(await meta('secondary_echo')).trim()}`);

  console.log('\nDoD 7 — select an object and see why it exists');
  const explain = await page.evaluate(() => ({
    what: document.querySelector('.inspector-what')?.textContent ?? '',
    role: document.querySelector('.explain-role')?.textContent ?? '',
    why: document.querySelector('.explain-why')?.textContent ?? '',
    canon: [...document.querySelectorAll('.canon-rule summary')].map((n) => n.textContent),
    dependents: [...document.querySelectorAll('.dep-list .dep-link')].map((n) => n.textContent),
  }));
  check('answers "what is this"', explain.what.length > 20);
  check('answers "what role"', explain.role.length > 20);
  check('answers "why is it here"', explain.why.length > 60);
  check('cites canon rules', explain.canon.length >= 3, explain.canon.join(', '));

  await page.locator('.canon-rule summary').first().click();
  await page.waitForTimeout(150);
  const ruleText = await page.locator('.canon-rule .canon-text').first().textContent();
  check('canon rule text is readable in place', ruleText.length > 30, `${ruleText.slice(0, 60)}…`);

  console.log('\nLock behaviour — spec Interaction Rules');
  await page.locator('.layer-primary_sweep .layer-toggle.is-lock').click();
  await page.waitForTimeout(200);
  const lockedSweep = (await meta('primary_sweep')).trim();
  await page.locator('.layer-primary_anchor').click();
  await page.waitForTimeout(150);
  await page.locator('#prop-anchor-1-start_deg').fill('9:00');
  await page.locator('#prop-anchor-1-start_deg').press('Enter');
  await page.waitForTimeout(250);
  check('locked object does not reflow', (await meta('primary_sweep')).trim() === lockedSweep, lockedSweep);
  check('unlocked object still follows', (await meta('secondary_echo')).trim() !== echoBefore);

  console.log('\nDoD 8 & 9 — save, then reopen with the same state');
  await page.locator('#prop-anchor-1-start_deg').fill('6:30');
  await page.locator('#prop-anchor-1-start_deg').press('Enter');
  await page.waitForTimeout(200);

  const snapshot = () => page.evaluate(() =>
    [...document.querySelectorAll('.layer-row')]
      .filter((row) => row.querySelector('.layer-meta'))
      .map((row) => `${row.querySelector('.layer-name').textContent}: ${row.querySelector('.layer-meta').textContent}`));

  const before = await snapshot();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForTimeout(400);
  check('save reports success', (await page.locator('.status-text').textContent()).includes('Saved'));

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const after = await snapshot();
  const drift = before.findIndex((row, index) => row !== after[index]);
  check('every transform survives a reload', drift === -1,
    drift === -1 ? `${before.length} rows identical` : `"${before[drift]}" vs "${after[drift]}"`);
  check('lock state survives a reload',
    await page.evaluate(() => document.querySelector('.layer-primary_sweep').className.includes('is-locked')));

  console.log('\nValidation');
  const validation = await page.evaluate(() => ({
    verdict: document.querySelector('.verdict')?.textContent,
    blocking: document.querySelectorAll('.report-blocking .result').length,
    advisory: document.querySelectorAll('.report-advisory .result').length,
  }));
  check('ticket §8 runs exactly five blocking validators', validation.blocking === 5);
  check('spec-derived advisories run separately', validation.advisory === 7);
  check('the saved composition is valid', validation.verdict === 'Valid', validation.verdict);

  // C-07 (REVISED): uncalibrated numbers must never read as design law.
  const authority = await page.evaluate(() => {
    const concentration = [...document.querySelectorAll('.report-advisory .result')]
      .find((n) => n.querySelector('.result-title')?.textContent === 'Mass concentration');
    const echoRow = [...document.querySelectorAll('.report-blocking .result')]
      .find((n) => n.querySelector('.result-title')?.textContent?.includes('Echo'));
    return {
      provisionalTags: document.querySelectorAll('.report-columns .authority-tag.is-provisional').length,
      measuredTags: document.querySelectorAll('.report-columns .authority-tag.is-metric').length,
      concentrationDetail: concentration?.querySelector('.result-detail')?.textContent ?? '',
      concentrationIsMeasured: Boolean(concentration?.classList.contains('result-measured')),
      echoIsBlockingAndProvisional: Boolean(echoRow?.querySelector('.authority-tag.is-provisional')),
      echoReason: echoRow?.querySelector('.authority-tag.is-provisional')?.getAttribute('title') ?? '',
    };
  });
  check('provisional results are visibly tagged', authority.provisionalTags >= 6,
    `${authority.provisionalTags} tagged`);
  check('mass concentration is reported as a measurement, not a verdict',
    authority.concentrationIsMeasured && authority.measuredTags >= 1);
  check('the engine no longer claims a composition is "resolved"',
    !/\bresolved\b/i.test(authority.concentrationDetail),
    authority.concentrationDetail.slice(0, 80) + '…');

  // The two axes are independent, and the UI explains the combination.
  check('a blocking check can carry a provisional basis, and says why',
    authority.echoIsBlockingAndProvisional && /ticket §8/.test(authority.echoReason),
    authority.echoReason.slice(0, 100) + '…');

  console.log(`\nJS errors: ${jsErrors.length}`);
  jsErrors.forEach((error) => console.log(`  ! ${error}`));
  if (jsErrors.length) throw new Error('the page logged JavaScript errors');

  console.log(`\n${passed} checks passed — Definition of Done fully exercised.\n`);
} finally {
  await browser.close();
}
