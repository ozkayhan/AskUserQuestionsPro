'use strict';
// Regression tests for web/ui-kit.js fixes.
// Finding [LOW] web/ui-kit.js:8-35 — Check and Brand SVG icons missing aria-hidden="true".
//
// Since ui-kit.js uses JSX and browser globals (React, AnswerMap), we test via
// source-text structural assertions — the lightest correct seam for browser-only JSX.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SRC_PATH = path.join(__dirname, '..', 'web', 'ui-kit.js');
const src = fs.readFileSync(SRC_PATH, 'utf8');

// ── Structural source-text assertions ────────────────────────────────────────

test('[LOW] Check SVG has aria-hidden="true"', () => {
  // Check is a decorative icon; screen readers must not announce it.
  // Find the Check component definition and verify aria-hidden within it.
  const checkStart = src.indexOf('const Check =');
  const checkEnd = src.indexOf('const Kbd =', checkStart);
  assert.ok(checkStart !== -1, 'Check component must be defined');
  const checkSrc = src.slice(checkStart, checkEnd);
  assert.ok(checkSrc.includes('aria-hidden="true"'), 'Check SVG must have aria-hidden="true"');
});

test('[LOW] Brand SVG has aria-hidden="true"', () => {
  // Brand is a decorative mark; screen readers must not announce it.
  const brandStart = src.indexOf('const Brand =');
  assert.ok(brandStart !== -1, 'Brand component must be defined');
  // Brand extends to end of the component (until next const or end of declarations).
  const brandEnd = src.indexOf('\nfunction ', brandStart);
  const brandSrc = brandEnd !== -1 ? src.slice(brandStart, brandEnd) : src.slice(brandStart);
  assert.ok(brandSrc.includes('aria-hidden="true"'), 'Brand SVG must have aria-hidden="true"');
});

test('Check component: still renders an svg (structural integrity)', () => {
  // Ensure aria-hidden addition didn't break the svg element.
  const checkStart = src.indexOf('const Check =');
  const checkEnd = src.indexOf('const Kbd =', checkStart);
  const checkSrc = src.slice(checkStart, checkEnd);
  assert.ok(checkSrc.includes('<svg'), 'Check must render an svg');
  assert.ok(checkSrc.includes('viewBox="0 0 16 16"'), 'Check viewBox must be preserved');
  assert.ok(checkSrc.includes('strokeLinecap="round"'), 'Check path attrs must be preserved');
});

test('Brand component: still renders an svg (structural integrity)', () => {
  const brandStart = src.indexOf('const Brand =');
  const brandEnd = src.indexOf('\nfunction ', brandStart);
  const brandSrc = brandEnd !== -1 ? src.slice(brandStart, brandEnd) : src.slice(brandStart);
  assert.ok(brandSrc.includes('<svg'), 'Brand must render an svg');
  assert.ok(brandSrc.includes('viewBox="0 0 20 20"'), 'Brand viewBox must be preserved');
});

test('CUSTOM_LABEL and CUSTOM_DESC constants are defined', () => {
  // Sanity check: other exports are untouched.
  assert.ok(src.includes("const CUSTOM_LABEL = 'Other'"), 'CUSTOM_LABEL must be defined');
  assert.ok(src.includes('CUSTOM_DESC'), 'CUSTOM_DESC must be defined');
});

test('fullOptions function is defined', () => {
  assert.ok(src.includes('function fullOptions('), 'fullOptions must be defined');
});
