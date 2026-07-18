'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ledger = require('./host-compatibility-evidence.json');
const required = [
  'cursor',
  'github-copilot-cli',
  'gemini-cli',
  'amazon-q-developer',
  'cline',
  'kiro',
  'kilo-code',
  'qwen-code',
  'opencode',
  'roo-code',
  'windsurf',
  'aider',
];
const allowed = new Set(['Supported', 'Experimental', 'Researching', 'Unsupported']);
const installed = new Set([
  'installed',
  'installed-unverified',
  'official-doc+installed-unverified',
  'authenticated',
  'manual',
]);
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
test('ledger has one dated row per named host and required fields', () => {
  assert.equal(ledger.hosts.length, required.length);
  assert.deepEqual(
    ledger.hosts.map((h) => h.id),
    required
  );
  for (const h of ledger.hosts) {
    assert.ok(allowed.has(h.status));
    assert.match(ledger.evidenceDates?.[h.id], /^2026-07-17$/);
    for (const key of [
      'name',
      'sources',
      'transport',
      'version',
      'scenarios',
      'nextGate',
      'evidenceClass',
    ])
      assert.ok(h[key] !== undefined, `${h.id}/${key}`);
    assert.ok(
      typeof (h.limitations || h.limitation) === 'string' && (h.limitations || h.limitation).length
    );
    for (const url of h.sources) assert.match(url, /^https:\/\//);
  }
});
test('promotion fails closed and unavailable rows are honest', () => {
  for (const h of ledger.hosts) {
    if (h.status === 'Supported' || h.status === 'Experimental')
      assert.ok(
        [...installed].some((x) => h.evidenceClass.includes(x)),
        `${h.id} lacks installed evidence`
      );
    if (h.status === 'Unsupported') assert.ok((h.limitations || h.limitation).length > 10);
  }
  assert.equal(ledger.hosts.find((h) => h.id === 'aider').status, 'Unsupported');
  assert.ok(ledger.hosts.filter((h) => h.status === 'Researching').length >= 10);
});
test('ledger is redacted and matrix/cards map one-to-one', () => {
  const raw = fs.readFileSync(path.join(__dirname, 'host-compatibility-evidence.json'), 'utf8');
  assert.doesNotMatch(
    raw,
    /synthetic-(question|answer)|password|secret|token\s*[:=]|\/Users\/oka|\/home\/[^/\s"']+/i
  );
  const matrix = fs.readFileSync(path.join(__dirname, 'host-compatibility-evidence.md'), 'utf8');
  const cardsDir = path.join(__dirname, '..', 'docs', 'host-capability-cards');
  for (const h of ledger.hosts) {
    const row = matrix.split('\n').find((line) => line.startsWith(`| ${h.id} |`));
    assert.ok(row, `${h.id} matrix row missing`);
    assert.match(
      row,
      new RegExp(
        `\\| ${escapeRegExp(h.id)} \\| ${escapeRegExp(h.name)} \\| ${escapeRegExp(h.status)} \\| ${escapeRegExp(h.version)} \\| ${escapeRegExp(h.evidenceClass)} \\|`
      )
    );
    const cardPath = path.join(cardsDir, `${h.id}.md`);
    assert.ok(fs.existsSync(cardPath));
    const card = fs.readFileSync(cardPath, 'utf8');
    assert.ok(card.includes('Evidence state: `' + h.status + '`'), `${h.id} card status drift`);
    assert.match(card, new RegExp(`Evidence date: ${ledger.evidenceDates[h.id]}`));
    assert.match(card, new RegExp(`Version: ${escapeRegExp(h.version)}`));
    assert.match(card, new RegExp(`Evidence class: ${escapeRegExp(h.evidenceClass)}`));
    assert.match(card, /Transport:/);
    assert.match(card, /Configuration:/);
    assert.match(card, /Limitations:/);
  }
});

test('published evidence corpus is redacted', () => {
  const roots = [
    path.join(__dirname, '..', 'docs', 'host-capability-cards'),
    path.join(__dirname, '..', 'docs', 'host-research'),
    path.join(__dirname, '..', 'docs', 'evidence'),
    path.join(__dirname, 'host-compatibility-evidence.md'),
    path.join(__dirname, 'tier1-acceptance-evidence.md'),
  ];
  const files = [];
  const visit = (entry) => {
    if (!fs.existsSync(entry)) return;
    if (fs.statSync(entry).isDirectory())
      for (const child of fs.readdirSync(entry)) visit(path.join(entry, child));
    else files.push(entry);
  };
  roots.forEach(visit);
  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(
      raw,
      /synthetic-(question|answer)|password|secret|token\s*[:=]|(?:^|[\s(])(?:\/Users\/oka|\/home\/[^/\s]+)/i,
      file
    );
  }
});
