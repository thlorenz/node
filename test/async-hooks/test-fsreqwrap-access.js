const common = require('../common')
const assert = require('assert')
const initHooks = require('./init-hooks')
const fs = require('fs')

const hooks = initHooks()

hooks.enable()
fs.access(__filename, common.mustCall(onaccess))

function onaccess() {
  const as = hooks.activities()
  const a = as[0]
  assert.equal(a.init.length, 1, 'called init once while in callback')
  assert.equal(a.before.length, 1, 'called before once while in callback')
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
  assert.equal(a.type, 'FSREQWRAP', 'fs req wrap')
  assert.equal(typeof a.uid, 'number', 'uid is a number')
  assert.equal(a.parentUid, 1, 'parent uid 1')
  assert.equal(a.after.length, 1, 'called after once when process exits')
  assert.equal(a.destroy.length, 1, 'called destroy once when process exits')
}
