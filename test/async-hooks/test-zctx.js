const common = require('../common')
const assert = require('assert')
const initHooks = require('./init-hooks')
const { checkInvocations } = require('./hook-checks')
const zlib = require('zlib')

const hooks = initHooks()

hooks.enable()
zlib.deflate('..........', common.mustCall(ondeflate));

function ondeflate() {
  const as = hooks.activities()
  const a = as[0]
  checkInvocations(a, { init: 1, before: 2, after: 2 }, 'while in ondeflate callback')
}

process.on('exit', onexit)

function onexit() {
  hooks.disable()
  hooks.sanityCheck()

  const as = hooks.activities()
  assert.strictEqual(as.length, 6, 'six activities')

  const a = as[0]
  assert.strictEqual(a.type, 'ZCTX', 'z ctx')
  assert.strictEqual(typeof a.uid, 'number', 'uid is a number')
  checkInvocations(a, { init: 1, before: 2, after: 2 }, 'when process exits')
}
