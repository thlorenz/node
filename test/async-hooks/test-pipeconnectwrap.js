const common = require('../common')
const assert = require('assert')
const initHooks = require('./init-hooks')
const { checkInvocations } = require('./hook-checks')
const types = [ 'PIPEWRAP', 'PIPECONNECTWRAP' ]

const net = require('net')

common.refreshTmpDir()

const hooks = initHooks()
hooks.enable()
let pipe1, pipe2, pipe3
let pipeconnect

net.createServer(function(c) {
  c.end()
  this.close()
  // setImmediate here and check for destroy
}).listen(common.PIPE, common.mustCall(onlisten))

function onlisten() {
  let as = hooks.activitiesOfTypes(types)
  assert.equal(as.length, 1, 'one pipe wrap created when net server is listening')

  net.connect(common.PIPE, common.mustCall(onconnect))

  as = hooks.activitiesOfTypes(types)
  assert.equal(as.length, 3, '2  pipe wraps and one pipe connect wrap created when client is connecting')

  pipe1 = as[0]
  pipe2 = as[1]
  pipeconnect = as[2]

  assert.equal(pipe1.type, 'PIPEWRAP', 'first is pipe wrap')
  assert.equal(pipe2.type, 'PIPEWRAP', 'second is pipe wrap')
  assert.equal(pipeconnect.type, 'PIPECONNECTWRAP', 'third is pipeconnect wrap')
  ;[ pipe1, pipe2, pipeconnect ].forEach(check)

  function check(a) {
    assert.equal(typeof a.uid, 'number', 'uid is a number')
    assert.equal(typeof a.triggerId, 'number', 'triggerId is a number')
    checkInvocations(a, { init: 1 }, 'after net.connect')
  }
}

function onconnect() {
  hooks.disable()
  const as = hooks.activitiesOfTypes(types)
  assert.equal(as.length, 4, '3  pipe wraps and one pipe connect wrap created when client connected')
  pipe3 = as[3]
  assert.equal(typeof pipe3.uid, 'number', 'uid is a number')
  assert.equal(typeof pipe3.triggerId, 'number', 'triggerId is a number')

  checkInvocations(pipe1, { init: 1, before: 1, after: 1 }, 'pipe1, client connected')
  checkInvocations(pipe2, { init: 1 }, 'pipe2, client connected')
  checkInvocations(pipeconnect, { init: 1, before: 1 }, 'pipeconnect, client connected')
  checkInvocations(pipe3, { init: 1 }, 'pipe3, client connected')
}

process.on('exit', onexit)

function onexit() {
  hooks.disable()
  hooks.sanityCheck()
  // TODO(thlorenz) why have none of those been destroyed and why don't we see an 'after' call
  // for the pipeconnect here
  // May have to close things (see net.createServer callback)
  checkInvocations(pipe1, { init: 1, before: 1, after: 1 }, 'pipe1, process exiting')
  checkInvocations(pipe2, { init: 1 }, 'pipe2, process exiting')
  checkInvocations(pipeconnect, { init: 1, before: 1 }, 'pipeconnect, process exiting')
  checkInvocations(pipe3, { init: 1 }, 'pipe3, process exiting')
}
