'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRoundRoutes } = require('../server/round-routes.cjs');

function response() {
  return {
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body = '') {
      this.body = body;
    },
    json() {
      return JSON.parse(this.body);
    },
  };
}

test('round route factory serves recoverable metadata through its injected bridge', async () => {
  const routes = createRoundRoutes({
    bridge: {
      listRecoverable: () => [{ roundId: 'round_opaque_42', state: 'detached' }],
    },
    readBody: async () => '',
    sendJson(res, status, body) {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    },
  });
  const res = response();

  assert.equal(await routes.handle({ method: 'GET' }, res, '/rounds'), true);
  assert.equal(res.status, 200);
  assert.deepEqual(res.json(), {
    rounds: [{ roundId: 'round_opaque_42', state: 'detached' }],
  });
});
