'use strict';

const APP_ID = require('./app-id.cjs');
const { version: packageVersion } = require('../package.json');

// This is the HTTP bridge contract version, independent from MCP's negotiated
// protocol version. It must change whenever host clients can no longer safely
// talk to the daemon.
const BRIDGE_PROTOCOL_VERSION = '1';

function healthPayload() {
  return {
    ok: true,
    app: APP_ID,
    protocolVersion: BRIDGE_PROTOCOL_VERSION,
    packageVersion,
  };
}

function isCompatibleHealth(body, expected = {}) {
  return (
    body !== null &&
    typeof body === 'object' &&
    body.ok === true &&
    body.app === (expected.app || APP_ID) &&
    body.protocolVersion === (expected.protocolVersion || BRIDGE_PROTOCOL_VERSION) &&
    body.packageVersion === (expected.packageVersion || packageVersion)
  );
}

module.exports = {
  APP_ID,
  BRIDGE_PROTOCOL_VERSION,
  packageVersion,
  healthPayload,
  isCompatibleHealth,
};
