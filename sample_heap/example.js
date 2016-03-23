'use strict'

const sp = require('sample_heap')

function inspect (obj, depth) {
  if (typeof console.error === 'function') {
    console.error(require('util').inspect(obj, false, depth || 5, true))
  }
}

function mytest () {
  const arr = []
  const OUTER_ITER = 1024
  const INNER_ITER = 1024 * 10

  for (let j = 0; j < OUTER_ITER; j++) {
    let innerArr = []
    for (let i = 0; i < INNER_ITER; i++) {
      innerArr.push({ i: i })
    }
    arr.push(innerArr)
  }
}

function bar (size) { return new Array(size) }

function v8test () {
  var A = []
  var foo = function () {
    for (var i = 0; i < 1024; ++i) {
      A[i] = bar(1024)
    }
  }
  foo()
}

function onNode (info) {
  inspect(info)
}

sp.startSampling(32, 10)

mytest()
v8test()

sp.visitAllocationProfile(onNode)
sp.stopSampling()

