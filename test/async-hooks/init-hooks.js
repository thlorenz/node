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

  init(uid, type, triggerId, handle) {
    const activity = { uid,  type, triggerId }
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

  sanityCheck(types) {
    if (!Array.isArray(types)) types = [ types ]

    function activityString(a) {
      return util.inspect(a, false, 5, true)
    }

    const violations = []
    function v(msg) { violations.push(msg) }
    for (let a of this._activities.values()) {
      if (types != null && !~types.indexOf(a.type)) continue

      if (a.init && a.init.length > 1) {
        v('Activity inited twice\n' + activityString(a))
      }
      if (a.destroy && a.destroy.length > 1) {
        v('Activity destroyed twice\n' + activityString(a))
      }
      if (a.before && a.after) {
        if (a.before.length < a.after.length) {
          v('Activity called after without calling before\n' + activityString(a))
        }
        if (a.before.some((x, idx) => x > a.after[idx])) {
          v('Activity had an instance where "after" was invoked before "before"\n'
            + activityString(a))
        }
      }
      if (a.before && a.destroy) {
        if (a.before.some((x, idx) => x > a.destroy[idx])) {
          v('Activity had an instance where "destroy" was invoked before "before"\n'
            + activityString(a))
        }
      }
      if (a.after && a.destroy) {
        if (a.after.some((x, idx) => x > a.destroy[idx])) {
          v('Activity had an instance where "destroy" was invoked before "after"\n'
            + activityString(a))
        }
      }
    }
    if (violations.length) {
      console.error(violations.join('\n'))
      assert.fail('Failed sanity check')
    }
  }

  inspect({ types = null, depth = 5 } = {}) {
    const activities = types == null ? this.activities : this.activitiesOfTypes(types)
    console.log(util.inspect(activities, false, depth, true))
  }

  get activities() {
    return Array.from(this._activities.values())
  }

  activitiesOfTypes(types) {
    if (!Array.isArray(types)) types = [ types ]
    return this.activities.filter(x => !!~types.indexOf(x.type))
  }
}

exports = module.exports = function initHooks() {
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
    sanityCheck: types => collector.sanityCheck(types),
    inspect: x => collector.inspect(x),
    activitiesOfTypes: x => collector.activitiesOfTypes(x),
    activities: () => collector.activities,
    enable: () => asyncHook.enable(),
    disable: () => asyncHook.disable()
  }
}
