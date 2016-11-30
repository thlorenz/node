const common = require('../common')
const assert = require('assert')
const initHooks = require('./init-hooks')
const { checkInvocations } = require('./hook-checks')
const types = [ 'SENDWRAP' ]
const dgram = require('dgram')

const hooks = initHooks()

hooks.enable()
let send

const sock = dgram
  .createSocket('udp4')
  .on('listening', common.mustCall(onlistening))
  .bind()

function onlistening() {
  sock.send(
    new Buffer(2), 0, 2, sock.address().port, '::', common.mustCall(onsent))

  // TODO:(thlorenz) shouldn't init have been called synchronously here?
  assert.equal(hooks.activitiesOfTypes(types).length, 0,
    'no sendwrap after sock connected and sock.send called')
}

function onsent() {
  const as = hooks.activitiesOfTypes(types)
  send = as[0]

  assert.equal(as.length, 1, 'one SENDWRAP created synchronously when message sent')
  assert.equal(send.type, 'SENDWRAP', 'send wrap')
  assert.equal(typeof send.uid, 'number', 'uid is a number')
  assert.equal(typeof send.triggerId, 'number', 'triggerId is a number')
  checkInvocations(send, { init :1, destroy: 1 }, 'when message sent')

  sock.close(common.mustCall(onsockClosed))
}

function onsockClosed() {
  checkInvocations(send, { init :1, destroy: 1 }, 'when sock closed')
}

process.on('exit', onexit)

function onexit() {
  hooks.disable()
  hooks.sanityCheck(types)
  checkInvocations(send, { init :1, destroy: 1 }, 'when process exits')
}
