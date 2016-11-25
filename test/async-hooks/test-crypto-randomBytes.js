const common = require('../common')
const assert = require('assert')
const initHooks = require('./init-hooks')
const { checkInvocations } = require('./hook-checks')
const crypto = require('crypto')

if (!common.hasCrypto) {
  common.skip('missing crypto')
  return
}

const hooks = initHooks()

hooks.enable()
crypto.randomBytes(1, common.mustCall(onrandomBytes))

function onrandomBytes() {
  const as = hooks.activities()
  const a = as[0]
  checkInvocations(a, { init: 1, before: 1 }, 'while in onrandomBytes callback')
}

process.on('exit', onexit)

function onexit() {
  hooks.disable()
  hooks.sanityCheck()

  const as = hooks.activities()
  assert.equal(as.length, 1, 'one activity')

  const a = as[0]
  assert.equal(a.type, 'RANDOMBYTESREQUEST', 'random byte request')
  assert.equal(typeof a.uid, 'number', 'uid is a number')
  assert.equal(a.triggerId, 1, 'parent uid 1')
  checkInvocations(a, { init: 1, before: 1, after: 1, destroy: 1 }, 'when process exits')
}
