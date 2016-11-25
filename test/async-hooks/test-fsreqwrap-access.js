const common = require('../common')
const assert = require('assert')
const initHooks = require('./init-hooks')
const { checkInvocations } = require('./hook-checks')
const fs = require('fs')

const hooks = initHooks()

hooks.enable()
fs.access(__filename, common.mustCall(onaccess))

function onaccess() {
  const as = hooks.activities()
  const a = as[0]
  checkInvocations(a, { init: 1, before: 1 }, 'while in onaccess callback')
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
  checkInvocations(a, { init: 1, before: 1, after: 1, destroy: 1 }, 'when process exits')
}
