const common = require('../common')
const assert = require('assert')
const initHooks = require('./init-hooks')
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
assert.equal(processwrap.init.length, 1, 'process wrap init called synchronously')
assert.equal(processwrap.before, null, 'process wrap does not call before synchronously')
assert.equal(processwrap.after, null, 'process wrap does not call after synchronously')

;[ pipe1, pipe2, pipe3 ].forEach(x => {
  assert(x.type, 'PIPEWRAP', 'pipe wrap type')
  assert.equal(x.triggerId, 1, 'pipe wrap triggerId is 1')
  assert.equal(x.init.length, 1, 'pipe wrap init called synchronously')
  assert.equal(x.before, null, 'pipe wrap does not call before synchronously')
  assert.equal(x.after, null, 'pipe wrap does not call after synchronously')
})

function onsleepExit(code) {
  assert.equal(processwrap.before.length, 1, 'process wrap before was called once when invoking exit')
  assert.equal(processwrap.after, null, 'process wrap does not call after before invoking exit')
  assert.equal(processwrap.destroy, null, 'process wrap does not call destroy before invoking exit')
  // Sanity check fails for multiple reasons
  // destroy called twice (for stderr) and before after for all pipes
  // hooks.sanityCheck()
}

function onsleepClose() {
  hooks.inspect()
  assert.equal(processwrap.after.length, 1, 'process wrap after was called once when invoking close')
  assert.equal(processwrap.destroy.length, 1, 'process wrap destroy was called once when invoking close')
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
