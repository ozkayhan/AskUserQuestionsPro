#!/usr/bin/env node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const LABELS = [
  'full-suite',
  'focused-suite',
  'lint',
  'format',
  'browser-smoke',
  'audit',
  'package-dry-run',
  'bash-syntax',
  'shellcheck',
  'git-diff-check',
  'production-dependency-drift',
  'UAT-row-parser',
  'archive-immutability',
  'protected-file-snapshot/comparison',
];

const ZERO_REQUIRED = new Set([
  'full-suite',
  'focused-suite',
  'lint',
  'format',
  'browser-smoke',
  'audit',
  'package-dry-run',
  'bash-syntax',
  'archive-immutability',
  'git-diff-check',
  'production-dependency-drift',
  'UAT-row-parser',
  'protected-file-snapshot/comparison',
]);
const PROTECTED_PATHS = ['.planning/config.json', '.planning/ui-reviews/.gitignore'];

function fail(message) {
  throw new Error(`verification validation failed: ${message}`);
}

function parseReport(text) {
  const records = new Map();
  const headings = [...text.matchAll(/^## LABEL: (.+)$/gm)];
  for (let index = 0; index < headings.length; index += 1) {
    const label = headings[index][1].trim();
    const start = headings[index].index + headings[index][0].length;
    const end = headings[index + 1]?.index ?? text.length;
    if (records.has(label)) fail(`duplicate label ${label}`);
    const block = text.slice(start, end);
    const fields = {};
    for (const line of block.split('\n')) {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) fields[match[1].trim().toLowerCase()] = match[2].trim();
    }
    for (const field of ['command', 'status', 'output/summary', 'interpretation']) {
      if (!fields[field]) fail(`${label} is missing ${field}`);
    }
    if (!/^\d+$/.test(fields.status)) fail(`${label} status is not numeric`);
    if (ZERO_REQUIRED.has(label) && fields.status !== '0') fail(`${label} status is ${fields.status}`);
    if (label === 'shellcheck' && fields.status !== '0' && !fields.interpretation.includes('UNAVAILABLE')) {
      fail(`shellcheck status is ${fields.status} without an explicit UNAVAILABLE interpretation`);
    }
    records.set(label, { fields, block });
  }
  for (const label of LABELS) if (!records.has(label)) fail(`missing label ${label}`);
  if (records.size !== LABELS.length) fail('unexpected label present');
  const protectedRecord = records.get('protected-file-snapshot/comparison');
  for (const path of PROTECTED_PATHS) {
    const pathBlock = protectedRecord.block;
    if (!pathBlock.includes(path) || !new RegExp(`${path.replaceAll('.', '\\.') }[\\s\\S]*?matching baseline: yes`).test(pathBlock)) {
      fail(`protected path ${path} does not report a baseline match`);
    }
    const pathStart = pathBlock.indexOf(path);
    const nextPath = PROTECTED_PATHS.find((candidate) => pathBlock.indexOf(candidate, pathStart + 1) > pathStart);
    const pathSection = pathBlock.slice(pathStart, nextPath ? pathBlock.indexOf(nextPath, pathStart + 1) : undefined);
    if (!pathSection.includes('not staged: yes')) fail(`protected path ${path} is staged`);
  }
  return records;
}

async function validate(path) {
  const records = parseReport(await readFile(path, 'utf8'));
  console.log(`validator PASS: ${records.size} exact labels validated`);
}

function fixture(records = LABELS) {
  return records
    .map((label) => {
      const protectedFields = label === 'protected-file-snapshot/comparison'
        ? '\n.planning/config.json\nmatching baseline: yes\nnot staged: yes\n.planning/ui-reviews/.gitignore\nmatching baseline: yes\nnot staged: yes'
        : '';
      return `## LABEL: ${label}\ncommand: true\nstatus: 0\noutput/summary: fixture\ninterpretation: fixture${protectedFields}`;
    })
    .join('\n');
}

async function selfTest() {
  const dir = await mkdtemp(join(tmpdir(), 'askuserquestionspro-validator-'));
  try {
    const valid = join(dir, 'valid.md');
    await writeFile(valid, fixture());
    await validate(valid);
    const cases = [
      ['missing-label', fixture(LABELS.slice(0, -1))],
      ['duplicate-label', `${fixture()}\n${fixture(['full-suite'])}`],
      ['missing-field', fixture().replace('command: true', 'command:')],
      ['nonzero-archive', fixture().replace('## LABEL: archive-immutability\ncommand: true\nstatus: 0', '## LABEL: archive-immutability\ncommand: true\nstatus: 1')],
      ['incomplete-protected', fixture().replace('not staged: yes', 'not staged: no')],
    ];
    for (const [name, contents] of cases) {
      const file = join(dir, `${name}.md`);
      await writeFile(file, contents);
      try {
        await validate(file);
        fail(`${name} fixture unexpectedly passed`);
      } catch (error) {
        if (!String(error.message).includes('verification validation failed')) throw error;
      }
    }
    console.log('validator self-test PASS: valid and five invalid fixtures');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const argument = process.argv[2];
try {
  if (argument === '--self-test') await selfTest();
  else if (argument) await validate(argument);
  else fail('report path is required (or use --self-test)');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
