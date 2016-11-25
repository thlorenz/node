const common = require('../common')
const assert = require('assert')
const initHooks = require('./init-hooks')
const { checkInvocations } = require('./hook-checks')
const fs = require('fs')

const hooks = initHooks()

hooks.enable()
fs.readFile(__filename, common.mustCall(onread))

function onread() {
  /* Example hooks
    [   { uid: 5,
          type: 'FSREQWRAP',
          triggerId: 1,
          init: [ 789832 ],
          before: [ 1559419 ],
          after: [ 1934101 ],
          destroy: [ 2089716 ] },
        { uid: 6,
          type: 'FSREQWRAP',
          triggerId: 5,
          init: [ 1761235 ],
          before: [ 2132142 ],
          after: [ 2446294 ],
          destroy: [ 2468867 ] },
        { uid: 7,
          type: 'FSREQWRAP',
          triggerId: 6,
          init: [ 2406482 ],
          before: [ 2492567 ],
          after: [ 2645263 ],
          destroy: [ 2650261 ] },
        { uid: 8,
          type: 'FSREQWRAP',
          triggerId: 7,
          init: [ 2632196 ],
          before: [ 2678529 ] } ]
  */
  const as = hooks.activities()
  let lastParent = 1
  for (let i = 0; i < as.length; i++) {
    const a = as[i]
    assert.equal(a.type, 'FSREQWRAP', 'fs req wrap')
    assert.equal(typeof a.uid, 'number', 'uid is a number')
    assert.equal(a.triggerId, lastParent, 'parent uid 1')
    // this callback is called from within the last fs req callback therefore
    // the last req is still going and after/destroy haven't been called yet
    let after = 1
    let destroy = 1
    if (i === as.length - 1) {
      after = null
      destroy = null
    }
    checkInvocations(a, { init: 1, before: 1, after, destroy }, 'while in onread callback')
    lastParent = a.uid
  }
}

process.on('exit', onexit)

function onexit() {
  hooks.disable()
  hooks.sanityCheck()
  const as = hooks.activities()
  const a = as.pop()
  // check that after and destroy was called on the last FSREQWRAP
  checkInvocations(a, { init: 1, before: 1, after: 1, destroy: 1 }, 'when process exits')
}
