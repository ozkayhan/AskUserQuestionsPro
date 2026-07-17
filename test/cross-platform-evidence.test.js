'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('node:fs');
const doc = fs.readFileSync('docs/evidence/phase-13-cross-platform.md','utf8');
const scenarios=['idle','refresh/reconnect','detach/resume','restart','corrupt/partial quarantine','exact selection','immutable replay','acknowledgement retry','expiry','permissions','loopback','browser fallback','installer scope'];
test('native OS evidence has scenario parity and honest gaps',()=>{for(const s of scenarios) assert.match(doc,new RegExp(s.split(' ').map((x)=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s+'),'i')); for(const os of ['macOS arm64','Linux native','Windows native']) assert.match(doc,new RegExp(`\\| ${os} \\|`)); assert.match(doc,/WSL.*does not count/i);});
test('cross-platform evidence requires metadata and redaction',()=>{for(const x of ['architecture','Node version','config root','exact command','date','result','limitation']) assert.match(doc,new RegExp(x,'i')); assert.doesNotMatch(doc,/synthetic-(question|answer)|password|token\s*[:=]|\/Users\/oka/i);});
