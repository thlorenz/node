const common = require('../common')
const assert = require('assert')
const initHooks = require('./init-hooks')
const { checkInvocations } = require('./hook-checks')
const dns = require('dns')

const hooks = initHooks()

hooks.enable()
dns.lookupService('127.0.0.1', 80, common.mustCall(onlookupService))
function onlookupService(err_, ip, family) {
  // we don't care about the error here in order to allow
  // tests to run offline (lookup will fail in that case and the err be set)

  const as = hooks.activities()
  assert.equal(as.length, 1, 'one activity')

  const a = as[0]
  assert.equal(a.type, 'GETNAMEINFOREQWRAP', 'getnameinforeq wrap')
  assert.equal(typeof a.uid, 'number', 'uid is a number')
  assert.equal(a.triggerId, 1, 'parent uid 1')
  checkInvocations(a, { init: 1, before: 1 }, 'while in onlookupService callback')
}

process.on('exit', onexit)

function onexit() {
  hooks.disable()
  hooks.sanityCheck()

  const as = hooks.activities()
  const a = as[0]
  checkInvocations(a, { init: 1, before: 1, after: 1, destroy: 1 }, 'when process exits')
}

