const common = require('../common')
const assert = require('assert')
const initHooks = require('./init-hooks')
const fs = require('fs')

const hooks = initHooks()

hooks.enable()
const watcher = fs.watch(__dirname, onwatcherChanged);
function onwatcherChanged() { }

watcher.close()

process.on('exit', onexit)

function onexit() {
  hooks.disable()
  hooks.sanityCheck()

  const as = hooks.activities()
  assert.equal(as.length, 1, 'one activity')

  const a = as[0]
  assert.equal(a.type, 'FSEVENTWRAP', 'fs event wrap')
  assert.equal(typeof a.uid, 'number', 'uid is a number')
  assert.equal(a.triggerId, 1, 'parent uid 1')
  assert.equal(a.init.length, 1, 'called init once')
  assert.equal(a.before, null, 'never called before')
  assert.equal(a.after, null, 'never called after')
  assert.equal(a.destroy.length, 1, 'called destroy once')
}