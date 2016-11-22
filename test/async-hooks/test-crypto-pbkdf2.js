const common = require('../common')
const assert = require('assert')
const initHooks = require('./init-hooks')
const crypto = require('crypto')

if (!common.hasCrypto) {
  common.skip('missing crypto')
  return
}

const hooks = initHooks()

hooks.enable()
crypto.pbkdf2('password', 'salt', 1, 20, 'sha256', common.mustCall(onpbkdf2))

function onpbkdf2() {
  const as = hooks.activities()
  const a = as[0]
  assert.equal(a.after, null, 'never called after while in callback')
  assert.equal(a.destroy, null, 'never called destroy while in callback')
}

process.on('exit', onexit)

function onexit() {
  hooks.disable()
  hooks.sanityCheck()

  const as = hooks.activities()
  assert.equal(as.length, 1, 'one activity')

  const a = as[0]
  assert.equal(a.type, 'PBKDF2REQUEST', 'random byte request')
  assert.equal(typeof a.uid, 'number', 'uid is a number')
  assert.equal(a.parentUid, 1, 'parent uid 1')
  assert.equal(a.before.length, 1, 'called before once')
}
