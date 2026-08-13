'use strict';

const { MAX_BODY_BYTES } = require('../lib/protocol-limits.cjs');

const MAX_BODY = MAX_BODY_BYTES; // 8 MiB sert tavanı; host stdio ile aynıdır.

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

// A host result is delivered only after Node reports that its response stream
// completed. A closed or unwritable stream is an uncertain delivery and must
// leave request-id results available to /resume.
function sendJsonAndObserve(res, code, obj) {
  return new Promise((resolve) => {
    let done = false;
    const settle = (delivered) => {
      if (done) return;
      done = true;
      res.off('finish', onFinish);
      res.off('close', onClose);
      res.off('error', onError);
      resolve(delivered);
    };
    const onFinish = () => settle(true);
    const onClose = () => settle(false);
    const onError = () => settle(false);
    if (res.destroyed || !res.writable) return settle(false);
    res.once('finish', onFinish);
    res.once('close', onClose);
    res.once('error', onError);
    try {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(obj));
    } catch {
      settle(false);
    }
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let done = false; // tek-atislik settle: cift-reject/resolve'i engeller.
    const fail = (msg) => {
      if (done) return;
      done = true;
      reject(new Error(msg));
      req.destroy(); // 'data' akisini durdur; close-yarisini deterministik kapat.
    };
    const ok = () => {
      if (done) return;
      done = true;
      resolve(Buffer.concat(chunks).toString('utf8'));
    };
    req.on('data', (c) => {
      size += c.length;
      // Asimda destroy'dan ÖNCE senkron reject — buffered 'data'/'end' kismi gövdeyi
      // sessizce resolve edemez (boyut guard'i atlanmaz).
      if (size > MAX_BODY) return fail('request body too large');
      chunks.push(c);
    });
    req.on('end', ok);
    req.on('error', (e) => fail(e.message));
    // destroy 'close' garantilemese de (socket zaten dead ise) 'data'/'end'/'error'
    // yollarindan biri done'i set eder; bu yol yalniz erken kopuslarda calisir.
    req.on('close', () => {
      if (!req.readableEnded) fail('connection closed');
    });
  });
}

module.exports = { MAX_BODY, readBody, sendJson, sendJsonAndObserve };
