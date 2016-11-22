const assert = require('assert')
const async_hooks = require('async_hooks')
const util = require('util')

class ActivityCollector {
  constructor(start) {
    this._start = start
    this._activities = new Map()
  }

  _stamp(h, hook) {
    if (h[hook] == null) h[hook] = []
    const time = process.hrtime(this._start)
    h[hook].push((time[0] * 1e9) + time[1])
  }

  init(uid, type, parentUid, handle) {
    const activity = { uid,  type, parentUid }
    this._stamp(activity, 'init')
    this._activities.set(uid, activity)
  }

  before(uid) {
    const h = this._activities.get(uid)
    if (!h) throw new Error('Found a handle who\'s before hook was invoked but not it\'s init hook')
    this._stamp(h, 'before')
  }

  after(uid) {
    const h = this._activities.get(uid)
    if (!h) throw new Error('Found a handle who\'s after hook was invoked but not it\'s init hook')
    this._stamp(h, 'after')
  }

  destroy(uid) {
    const h = this._activities.get(uid)
    if (!h) throw new Error('Found a handle who\'s destroy hook was invoked but not it\'s init hook')
    this._stamp(h, 'destroy')
  }

  sanityCheck() {
    const violations = []
    function v(msg) { violations.push(msg) }
    for (let a of this._activities.values()) {
      if (a.init && a.init.length > 1) {
        v('Activity inited twice')
      }
      if (a.destroy && a.destroy.length > 1) {
        v('Activity destroyed twice')
      }
      if (a.before && a.after) {
        if (a.before.length < a.after.length) {
          v('Activity called after without calling before')
        }
        if (a.before.some((x, idx) => x > a.after[idx])) {
          v('Activity had an instance where "after" was invoked before "before"')
        }
      }
    }
    if (violations.length) {
      console.error(violations.join('\n'))
      assert.fail('Failed sanity check')
    }
  }

  inspect(depth = 5) {
    console.log(util.inspect(this.activities, false, depth, true))
  }

  get activities() {
    return Array.from(this._activities.values())
  }
}

module.exports = function initHooks() {
  const collector = new ActivityCollector(process.hrtime())

  function asyncInit() { collector.init.apply(collector, arguments) }
  function asyncBefore() { collector.before.apply(collector, arguments) }
  function asyncAfter() { collector.after.apply(collector, arguments) }
  function asyncDestroy() { collector.destroy.apply(collector, arguments) }

  const asyncHook = async_hooks.createHook({
    init: asyncInit,
    before: asyncBefore,
    after: asyncAfter,
    destroy: asyncDestroy
  })
  return {
    sanityCheck: () => collector.sanityCheck(),
    inspect: () => collector.inspect(),
    activities: () => collector.activities,
    enable: () => asyncHook.enable(),
    disable: () => asyncHook.disable()
  }
}
