const common = require('../common')
const commonPath = require.resolve('../common')
const assert = require('assert')
const initHooks = require('./init-hooks')
const { checkInvocations } = require('./hook-checks')
const fs = require('fs')
const types = [ 'STATWATCHER' ]

const hooks = initHooks()
hooks.enable()

function onchange() { }
// install first file watcher
fs.watchFile(__filename, onchange)

let as = hooks.activities({ types })
assert.equal(as.length, 1, 'one stat watcher when watching one file')

const statwatcher1 = as[0]
assert.equal(statwatcher1.type, 'STATWATCHER', 'stat watcher')
assert.equal(typeof statwatcher1.uid, 'number', 'uid is a number')
assert.equal(statwatcher1.triggerId, 1, 'parent uid 1')
checkInvocations(statwatcher1, { init: 1 },
  'watcher1: when started to watch file')

// install second file watcher
fs.watchFile(commonPath, onchange)
as = hooks.activities({ types })
assert.equal(as.length, 2, 'two stat watchers when watching two files')

const statwatcher2 = as[1]
assert.equal(statwatcher2.type, 'STATWATCHER', 'stat watcher')
assert.equal(typeof statwatcher2.uid, 'number', 'uid is a number')
assert.equal(statwatcher2.triggerId, 1, 'parent uid 1')
checkInvocations(statwatcher1, { init: 1 },
  'watcher1: when started to watch second file')
checkInvocations(statwatcher2, { init: 1 },
  'watcher2: when started to watch second file')

// remove first file watcher
fs.unwatchFile(__filename)
checkInvocations(statwatcher1, { init: 1, before: 1, after: 1 },
  'watcher:1 when unwatched first file')
checkInvocations(statwatcher2, { init: 1 },
  'watcher2: when unwatched first file')

// remove second file watcher
fs.unwatchFile(commonPath)
checkInvocations(statwatcher1, { init: 1, before: 1, after: 1 },
  'watcher:1 when unwatched second file')
checkInvocations(statwatcher2, { init: 1, before: 1, after: 1 },
  'watcher2: when unwatched second file')

process.on('exit', onexit)

function onexit() {
  hooks.disable()
  hooks.sanityCheck()
  checkInvocations(statwatcher1, { init: 1, before: 1, after: 1 },
    'watcher:1 when process exits')
  checkInvocations(statwatcher2, { init: 1, before: 1, after: 1 },
    'watcher2: when process exits')
}
