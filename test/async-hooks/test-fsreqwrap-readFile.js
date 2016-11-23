const common = require('../common')
const assert = require('assert')
const initHooks = require('./init-hooks')
const fs = require('fs')

const hooks = initHooks()

hooks.enable()
fs.readFile(__filename, common.mustCall(onread))

function onread() {
  /* Example hooks
    [   { uid: 5,
          type: 'FSREQWRAP',
          parentUid: 1,
          init: [ 789832 ],
          before: [ 1559419 ],
          after: [ 1934101 ],
          destroy: [ 2089716 ] },
        { uid: 6,
          type: 'FSREQWRAP',
          parentUid: 5,
          init: [ 1761235 ],
          before: [ 2132142 ],
          after: [ 2446294 ],
          destroy: [ 2468867 ] },
        { uid: 7,
          type: 'FSREQWRAP',
          parentUid: 6,
          init: [ 2406482 ],
          before: [ 2492567 ],
          after: [ 2645263 ],
          destroy: [ 2650261 ] },
        { uid: 8,
          type: 'FSREQWRAP',
          parentUid: 7,
          init: [ 2632196 ],
          before: [ 2678529 ] } ]
  */
  const as = hooks.activities()
  let lastParent = 1
  for (let i = 0; i < as.length; i++) {
    const a = as[i]
    assert.equal(a.type, 'FSREQWRAP', 'fs req wrap')
    assert.equal(typeof a.uid, 'number', 'uid is a number')
    assert.equal(a.parentUid, lastParent, 'parent uid 1')
    assert.equal(a.init.length, 1, 'called init once while in callback')
    assert.equal(a.before.length, 1, 'called before once while in callback')
    // this callback is called from within the last fs req callback therefore
    // the last req is still going and after/destroy haven't been called yet
    if (i === as.length - 1) {
      assert.equal(a.after, null, 'never called after while in callback of last req')
      assert.equal(a.destroy, null, 'never called destroy while in callback of last req')
    } else {
      assert.equal(a.after.length, 1, 'called after once while in callback')
      assert.equal(a.destroy.length, 1, 'called destroy once while in callback')
    }
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
  assert.equal(a.after.length, 1, 'called after once for last req on process exit')
  assert.equal(a.destroy.length, 1, 'called destroy once for last req on process exit')
}
