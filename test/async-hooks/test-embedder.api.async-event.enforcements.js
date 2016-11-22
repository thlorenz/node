'use strict';

// TODO(thlorenz): split up into multiple tests, one for each throw and inspect
// things at process.exit().
// However still waiting for the final verdict on what async-hooks should
// do in those cases in which things get corrupted
if (true) return;

require('../common');
const async_hooks = require('async_hooks');
const assert = require('assert');
const { AsyncEvent } = async_hooks;
const corruptedMsg = /async hook stack has become corrupted/;

const initHooks = require('./init-hooks');

const hooks = initHooks();
hooks.enable();
{
  // In both the below two cases 'before' of event2 is nested inside 'before' of
  // event1.
  // Therefore the 'after' of event2 needs to occur before the 'after' of event
  // 1.
  // The first test of the two below follows that rule, the second one doesnt.

  const event1 = new AsyncEvent('event1', async_hooks.currentId());
  const event2 = new AsyncEvent('event2', async_hooks.currentId());

  // Proper unwind
  event1.emitBefore();
  event2.emitBefore();
  event2.emitAfter();
  event1.emitAfter();

  // Improper unwind
  event1.emitBefore();
  event2.emitBefore();
  assert.throws(() => event1.emitAfter(), corruptedMsg);
}

{
  // async hooks enforce proper order of 'before' and 'after' invocations

  // Proper ordering
  const event1 = new AsyncEvent('event1', async_hooks.currentId());
  event1.emitBefore();
  event1.emitAfter();

  // Improper ordering
  // Emitting 'after' without 'before' which is illegal
  const event2 = new AsyncEvent('event2', async_hooks.currentId());
  assert.throws(() => event2.emitAfter(), corruptedMsg);
}

{
  // once 'destroy' has been emitted, we can no longer emit 'before' or 'after'

  // Emitting 'before', 'after' and then 'destroy'
  const event1 = new AsyncEvent('event1', async_hooks.currentId());
  event1.emitBefore();
  event1.emitAfter();
  event1.emitDestroy();

  // Emitting 'after' after 'destroy'
  const event2 = new AsyncEvent('event2', async_hooks.currentId());
  event2.emitDestroy();
  assert.throws(() => event2.emitAfter(), corruptedMsg);

  // Emitting 'before' after 'destroy'
  const event3 = new AsyncEvent('event3', async_hooks.currentId());
  event3.emitDestroy();

  // TODO:(trevnorris) the below assert should throw, as I shouldn't be
  // able to emit 'before' after I emitted 'destroy', i.e. it should enforce
  // this the same way it does for 'after' .. uncomment to see the failure
  /*
  assert.throws(() => event3.emitBefore(), corruptedMsg);
  */
}
