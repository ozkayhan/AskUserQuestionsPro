'use strict';
const test=require('node:test'); const assert=require('node:assert/strict'); const fs=require('node:fs');
const doc=fs.readFileSync('docs/evidence/phase-13-native-os-runs.md','utf8');
test('native evidence has fail-closed rows and required metadata',()=>{for(const os of ['macOS','Linux','Windows']) assert.match(doc,new RegExp(`\\| ${os} \\|`)); for(const x of ['Architecture','Node','Result','Date','Limitation','config-root','scenario']) assert.match(doc,new RegExp(x,'i')); assert.match(doc,/Linux.*Unavailable/s); assert.match(doc,/Windows.*Unavailable/s); assert.match(doc,/WSL does not qualify/i);});
test('supported host promotion requires native OS and lifecycle evidence',()=>{assert.match(doc,/installed conformance/); assert.match(doc,/long-round/); assert.match(doc,/install\/upgrade/); assert.match(doc,/trust/); assert.match(doc,/config-scope/); assert.doesNotMatch(doc,/synthetic-(question|answer)|password|token\s*[:=]|\/Users\/oka/i);});
