'use strict';

const common = require('../common');
const assert = require('assert');
const tick = require('./tick');
const initHooks = require('./init-hooks');
const { checkInvocations } = require('./hook-checks');
const crypto = require('crypto');

if (!common.hasCrypto) {
  common.skip('missing crypto');
  return;
}

const hooks = initHooks();

hooks.enable();
crypto.randomBytes(1, common.mustCall(onrandomBytes));

function onrandomBytes() {
  const as = hooks.activitiesOfTypes('RANDOMBYTESREQUEST');
  const a = as[0];
  checkInvocations(a, { init: 1, before: 1 },
                   'while in onrandomBytes callback');
  tick(2);
}

process.on('exit', onexit);

function onexit() {
  hooks.disable();
  hooks.sanityCheck('RANDOMBYTESREQUEST');

  const as = hooks.activitiesOfTypes('RANDOMBYTESREQUEST');
  assert.strictEqual(as.length, 1, 'one activity');

  const a = as[0];
  assert.strictEqual(a.type, 'RANDOMBYTESREQUEST', 'random byte request');
  assert.strictEqual(typeof a.uid, 'number', 'uid is a number');
  assert.strictEqual(a.triggerId, 1, 'parent uid 1');
  checkInvocations(a, { init: 1, before: 1, after: 1, destroy: 1 },
                   'when process exits');
}
