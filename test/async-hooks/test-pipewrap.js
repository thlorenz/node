// NOTE: this also covers process wrap as one is created along with the pipes
// when we launch the sleep process
const common = require('../common')
const assert = require('assert')
const initHooks = require('./init-hooks')
const { checkInvocations } = require('./hook-checks')
const spawn = require('child_process').spawn

const hooks = initHooks()

hooks.enable()
const sleep = spawn('sleep', [ '0.1' ])

sleep
  .on('exit', common.mustCall(onsleepExit))
  .on('close', common.mustCall(onsleepClose))

// a process wrap and 3 pipe wraps for std{in,out,err} are initialized synchronously
const as = hooks.activities()
assert.equal(as.length, 4, '4 activities, (3 pipes and one processwrap)')

const processwrap = as[0]
const pipe1 = as[1]
const pipe2 = as[2]
const pipe3 = as[3]

assert.equal(processwrap.type, 'PROCESSWRAP', 'process wrap type')
assert.equal(processwrap.triggerId, 1, 'processwrap triggerId is 1')
checkInvocations(processwrap, { init: 1 }, 'processwrap when sleep.spawn was called')

;[ pipe1, pipe2, pipe3 ].forEach(x => {
  assert(x.type, 'PIPEWRAP', 'pipe wrap type')
  assert.equal(x.triggerId, 1, 'pipe wrap triggerId is 1')
  checkInvocations(x, { init: 1 }, 'pipe wrap when sleep.spawn was called')
})

function onsleepExit(code) {
  checkInvocations(processwrap, { init: 1, before: 1 }, 'processwrap while in onsleepExit callback')
  // Sanity check fails for multiple reasons
  // destroy called twice (for stderr) and before after for all pipes
  // hooks.sanityCheck()
}

function onsleepClose() {
  hooks.inspect()
  checkInvocations(processwrap, { init: 1, before: 1, after: 1, destroy: 1 }, 'processwrap while in onsleepClose callback')
  // Sanitiy check fails for similar reasons as in exit,
  // except all pipes have been destroyed twice at this point
}

process.on('exit', onexit)

function onexit() {
  hooks.disable()
  // TODO(thlorenz) once bugs have been resolved
  // check things here that should've changed since onsleepClose
  // and run a sanity check
}
