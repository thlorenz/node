'use strict'
const assert = require('assert')

exports.checkInvocations = function checkInvocations(activity, hooks, stage) {
  hooks = Object.assign({}, { init: null, before: null, after: null, destroy: null }, hooks)
  Object.keys(hooks).forEach(checkHook)

  function checkHook(k) {
    const val = hooks[k]
    if (val == null) {
      assert.equal(activity[k], null, `never called "${k}" at stage "${stage}"`)
    } else {
      assert.notEqual(activity[k], null, `called "${k}" at least once at stage "${stage}"`)
      assert.equal(activity[k].length, val, `called "${k}" ${val} times at stage "${stage}"`)
    }
  }
}
