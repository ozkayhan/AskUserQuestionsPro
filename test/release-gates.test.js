'use strict';
const test=require('node:test'); const assert=require('node:assert/strict'); const fs=require('node:fs');
const docs=fs.readFileSync('docs/testing.md','utf8');
test('release gate documents the complete clean-checkout sequence',()=>{for(const cmd of ['npm ci','npm test','npm run lint','npm run format:check','npm audit --audit-level=high --omit=dev','npm pack --dry-run --json','shellcheck']) assert.match(docs,new RegExp(cmd.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))); assert.match(docs,/unavailable optional tools[\s\S]{0,80}environment gaps/i);});
test('release gate preserves package boundary and no new installs',()=>{assert.match(docs,/zero\s+production dependencies/i); assert.match(docs,/file allowlist/i); assert.match(docs,/changeset.*release workflow/i);});
