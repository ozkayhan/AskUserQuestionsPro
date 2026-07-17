'use strict';
const test=require('node:test'); const assert=require('node:assert/strict'); const fs=require('node:fs');
const { spawnSync } = require('node:child_process');
const docs=fs.readFileSync('docs/testing.md','utf8');
test('release gate documents the complete clean-checkout sequence',()=>{for(const cmd of ['npm ci','npm test','npm run lint','npm run format:check','npm audit --audit-level=high --omit=dev','npm pack --dry-run --json','shellcheck']) assert.match(docs,new RegExp(cmd.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))); assert.match(docs,/unavailable optional tools[\s\S]{0,80}environment gaps/i);});
test('release gate preserves package boundary and no new installs',()=>{assert.match(docs,/zero\s+production dependencies/i); assert.match(docs,/file allowlist/i); assert.match(docs,/changeset.*release workflow/i);});
test('release gate executes the locally available package and shell checks',()=>{
  const pack=spawnSync('npm',['pack','--dry-run','--json'],{encoding:'utf8'});
  assert.equal(pack.status,0,pack.stderr);
  const shell=spawnSync('bash',['-n','install.sh','uninstall.sh','reinstall.sh'],{encoding:'utf8'});
  assert.equal(shell.status,0,shell.stderr);
  const shellcheck=spawnSync('shellcheck',['install.sh','uninstall.sh','reinstall.sh'],{encoding:'utf8'});
  if (shellcheck.error?.code === 'ENOENT') assert.match(docs,/unavailable optional tools/i);
  else assert.equal(shellcheck.status,0,shellcheck.stdout || shellcheck.stderr);
});
