const common = require('../common')
const assert = require('assert')
const initHooks = require('./init-hooks')
const { checkInvocations } = require('./hook-checks')
const types = [ 'UDPWRAP' ]
const dgram = require('dgram')

const hooks = initHooks()

hooks.enable()
const sock = dgram.createSocket('udp4')

const as = hooks.activitiesOfTypes(types)
const udpwrap = as[0]
assert.equal(as.length, 1, 'one UDPWRAP handle after dgram.createSocket call')
assert.equal(udpwrap.type, 'UDPWRAP', 'udp wrap')
assert.equal(typeof udpwrap.uid, 'number', 'uid is a number')
assert.equal(typeof udpwrap.triggerId, 'number', 'triggerId is a number')
checkInvocations(udpwrap, { init: 1 }, 'after dgram.createSocket call')

sock.close(common.mustCall(onsockClosed))

function onsockClosed() {
  checkInvocations(udpwrap, { init: 1 }, 'when socket is closed')
}

process.on('exit', onexit)

function onexit() {
  hooks.disable()
  hooks.sanityCheck()
  checkInvocations(udpwrap, { init: 1, destroy: 1 }, 'when process exits')
}
