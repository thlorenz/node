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

crypto.pbkdf2('password', 'salt', 1, 20, 'sha256', common.mustCall(onpbkdf2));

function onpbkdf2() {
  const as = hooks.activitiesOfTypes('PBKDF2REQUEST');
  const a = as[0];
  checkInvocations(a, { init: 1, before: 1 }, 'while in onpbkdf2 callback');
  tick(2);
}

process.on('exit', onexit);
function onexit() {
  hooks.disable();
  hooks.sanityCheck('PBKDF2REQUEST');

  const as = hooks.activitiesOfTypes('PBKDF2REQUEST');
  assert.strictEqual(as.length, 1, 'one activity');

  const a = as[0];
  assert.strictEqual(a.type, 'PBKDF2REQUEST', 'random byte request');
  assert.strictEqual(typeof a.uid, 'number', 'uid is a number');
  assert.strictEqual(a.triggerId, 1, 'parent uid 1');
  checkInvocations(a, { init: 1, before: 1, after: 1, destroy: 1 },
                   'when process exits');
}
