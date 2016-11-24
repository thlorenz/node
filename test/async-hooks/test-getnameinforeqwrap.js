const common = require('../common')
const assert = require('assert')
const initHooks = require('./init-hooks')
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
  assert.equal(a.init.length, 1, 'called init once when inside callback')
  assert.equal(a.before.length, 1, 'before once when inside callback')
  assert.equal(a.after, null, 'never called after when inside callback')
  assert.equal(a.destroy, null, 'never called destroy when inside callback')
}

process.on('exit', onexit)

function onexit() {
  hooks.disable()
  hooks.sanityCheck()

  const as = hooks.activities()
  const a = as[0]
  assert.equal(a.after.length, 1, 'called after once when process exits')
  assert.equal(a.destroy.length, 1, 'called destroy once when process exits')
}

