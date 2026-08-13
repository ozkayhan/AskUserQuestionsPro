'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const config = require('./coverage-config.cjs');

const root = path.resolve(__dirname, '..');
const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'askuserquestionspro-coverage-'));
const lcovPath = path.join(reportDir, 'lcov.info');
const testFiles = fs
  .readdirSync(__dirname)
  .filter((file) => file.endsWith('.test.js'))
  .sort()
  .map((file) => path.join('test', file));

const args = [
  '--experimental-test-coverage',
  `--test-coverage-lines=${config.lines}`,
  `--test-coverage-branches=${config.branches}`,
  `--test-coverage-functions=${config.functions}`,
  ...config.include.map((pattern) => `--test-coverage-include=${pattern}`),
  ...config.exclude.map((pattern) => `--test-coverage-exclude=${pattern}`),
  '--test-reporter=lcov',
  `--test-reporter-destination=${lcovPath}`,
  '--test',
  ...testFiles,
];

function criticalLineCoverage() {
  const records = fs.readFileSync(lcovPath, 'utf8').split('end_of_record');
  const coverage = new Map();
  for (const record of records) {
    const source = record.match(/^SF:(.+)$/m)?.[1];
    const found = record.match(/^LF:(\d+)$/m);
    const hit = record.match(/^LH:(\d+)$/m);
    if (source && found && hit) {
      coverage.set(path.relative(root, source), {
        lines: Number(found[1]),
        hit: Number(hit[1]),
      });
    }
  }

  for (const file of config.criticalFiles) {
    const entry = coverage.get(file);
    if (!entry) throw new Error(`Native coverage report is missing ${file}`);
    const percent = entry.lines === 0 ? 100 : (entry.hit / entry.lines) * 100;
    if (percent < config.criticalLine)
      throw new Error(
        `${file} line coverage ${percent.toFixed(2)}% is below ${config.criticalLine}%`
      );
  }
}

try {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`Native coverage test command failed with status ${result.status ?? 1}.`);
    process.exitCode = result.status ?? 1;
  } else {
    criticalLineCoverage();
    console.log('Native coverage thresholds and critical-module baseline passed.');
  }
} finally {
  fs.rmSync(reportDir, { recursive: true, force: true });
}
