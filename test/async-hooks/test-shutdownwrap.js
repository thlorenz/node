const common = require('../common')
const assert = require('assert')
const initHooks = require('./init-hooks')
const { checkInvocations } = require('./hook-checks')
const types = [ 'SHUTDOWNWRAP' ]

const net = require('net')

const hooks = initHooks()
hooks.enable()

const server = net
  .createServer(onconnection)
  .on('listening', common.mustCall(onlistening))
server.listen()
function onlistening() {
  net.connect(server.address().port, common.mustCall(onconnected))
}

function onconnection(c) {
  assert.equal(hooks.activitiesOfTypes(types).length, 0,
    'no shutdown wrap before ending the client connection')
  c.end()
  const as = hooks.activitiesOfTypes(types)
  assert.equal(as.length, 1,
    'one shutdown wrap created synchronously after ending the client connection')
  checkInvocations(as[0], { init: 1 }, 'after ending client connection')
  this.close(onserverClosed)
}

function onconnected() {
  assert.equal(hooks.activitiesOfTypes(types).length, 0,
    'no shutdown wrap when client connected')
}

function onserverClosed() {
  const as = hooks.activitiesOfTypes(types)
  checkInvocations(as[0], { init: 1, before: 1, after: 1, destroy: 1 }, 'when server closed')
}

process.on('exit', onexit)

function onexit() {
  hooks.disable()
  hooks.sanityCheck(types)
  const as = hooks.activitiesOfTypes(types)
  const a = as[0]
  assert.equal(a.type, 'SHUTDOWNWRAP', 'shutdown wrap')
  assert.equal(typeof a.uid, 'number', 'uid is a number')
  assert.equal(typeof a.triggerId, 'number', 'triggerId is a number')
  checkInvocations(as[0], { init: 1, before: 1, after: 1, destroy: 1 }, 'when process exits')
}
