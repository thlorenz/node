'use strict';

const async_hooks = require('async_hooks');
const { AsyncEvent } = async_hooks;
const event1 = new AsyncEvent('event1', async_hooks.currentId());

// Proper unwind
event1.emitBefore();
event1.emitAfter();

// Improper unwind
event1.emitBefore(); // <= aborts due to this line

/*
 * Aborts with the following message instead of printing the message about improper unwind.
 
/Volumes/d/dev/ns/nsolid/node/out/Release/node[52038]: ../../src/env-inl.h:150:void node::Environment::AsyncHooks::pop_from_id_stack(double): Assertion `(id_stack_[fields_[AsyncHooks::kIdStackIndex]]) == (id)' failed.
 1: node::Abort() [/Volumes/d/dev/ns/nsolid/node/./node]
 2: node::RunMicrotasks(v8::FunctionCallbackInfo<v8::Value> const&) [/Volumes/d/dev/ns/nsolid/node/./node]
 3: node::Environment::AsyncHooks::pop_from_id_stack(double) [/Volumes/d/dev/ns/nsolid/node/./node]
 4: node::Start(v8::Isolate*, node::IsolateData*, int, char const* const*, int, char const* const*) [/Volumes/d/dev/ns/nsolid/node/./node]
 5: node::Start(uv_loop_s*, int, char const* const*, int, char const* const*) [/Volumes/d/dev/ns/nsolid/node/./node]
 6: node::Start(int, char**) [/Volumes/d/dev/ns/nsolid/node/./node]
 7: start [/Volumes/d/dev/ns/nsolid/node/./node]
Abort trap: 6
*/
