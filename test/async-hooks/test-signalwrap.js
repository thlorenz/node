const common = require('../common')
const assert = require('assert')
const initHooks = require('./init-hooks')
const { checkInvocations } = require('./hook-checks')
const exec = require('child_process').exec
const types = [ 'SIGNALWRAP' ]

const hooks = initHooks()

hooks.enable()
process.on('SIGUSR2', common.mustCall(onsigusr2, 2))

let signal1, signal2

const as = hooks.activitiesOfTypes(types)
assert.equal(as.length, 1, 'one signal wrap when SIGUSR2 handler is set up')
signal1 = as[0]
assert.equal(signal1.type, 'SIGNALWRAP', 'signal wrap')
assert.equal(typeof signal1.uid, 'number', 'uid is a number')
assert.equal(typeof signal1.triggerId, 'number', 'triggerId is a number')
checkInvocations(signal1, { init: 1 }, 'when SIGUSR2 handler is set up')

let count = 0
exec('kill -USR2 ' + process.pid)

function onsigusr2() {
  count++

  if (count === 1) {
    // first invocation
    checkInvocations(signal1, { init: 1, before: 1 },
      ' signal1: when first SIGUSR2 handler is called for the first time')

    // trigger same signal handler again
    exec('kill -USR2 ' + process.pid)
  } else {
    // second invocation
    checkInvocations(signal1, { init: 1, before: 2, after: 1 },
      'signal1: when first SIGUSR2 handler is called for the second time')

    // install another signal handler
    process.removeAllListeners('SIGUSR2')
    process.on('SIGUSR2', common.mustCall(onsigusr2Again))

    const as = hooks.activitiesOfTypes(types)
    assert.equal(as.length, 2, 'two signal wraps when second SIGUSR2 handler is set up')
    signal2 = as[1]
    assert.equal(signal2.type, 'SIGNALWRAP', 'signal wrap')
    assert.equal(typeof signal2.uid, 'number', 'uid is a number')
    assert.equal(typeof signal2.triggerId, 'number', 'triggerId is a number')

    checkInvocations(signal1, { init: 1, before: 2, after: 1 },
      'signal1: when second SIGUSR2 handler is set up')
    checkInvocations(signal2, { init: 1 },
      'signal2: when second SIGUSR2 handler is setup')

    exec('kill -USR2 ' + process.pid)
  }
}

function onsigusr2Again() {
  checkInvocations(signal1, { init: 1, before: 2, after: 2, destroy: 1 },
    'signal1: when second SIGUSR2 handler is called')
  checkInvocations(signal2, { init: 1, before: 1 },
    'signal2: when second SIGUSR2 handler is called')
}

process.on('exit', onexit)

function onexit() {
  hooks.disable()
  hooks.sanityCheck()
  checkInvocations(signal1, { init: 1, before: 2, after: 2, destroy: 1 },
    'signal1: when second SIGUSR2 process exits')
  // TODO:(thlorenz) verify that it is ok that signal2 hasn't been destroyed yet
  checkInvocations(signal2, { init: 1, before: 1, after: 1 },
    'signal2: when second SIGUSR2 process exits')
}
