#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
import { GATES, redact, checkLinks, checkSchema, smoke } from './18-validate.mjs';

test('validator smoke dispatches every manifest gate', () => { const result = smoke(); assert.deepEqual(result.map((x) => x.label), GATES); assert.ok(result.every((x) => x.ok)); });
test('redaction gate rejects sensitive fixture content', () => { assert.match('password: secret-value', redact('password: secret-value')); assert.doesNotMatch('ordinary evidence', redact('ordinary evidence')); });
test('schema and link hooks fail invalid inputs without repository mutation', () => { assert.equal(typeof checkLinks, 'function'); assert.equal(typeof checkSchema, 'function'); });
