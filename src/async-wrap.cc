#include "async-wrap.h"
#include "async-wrap-inl.h"
#include "env.h"
#include "env-inl.h"
#include "util.h"
#include "util-inl.h"

#include "v8.h"
#include "v8-profiler.h"

using v8::ArrayBuffer;
using v8::Boolean;
using v8::Context;
using v8::Float64Array;
using v8::Function;
using v8::FunctionCallbackInfo;
using v8::HandleScope;
using v8::HeapProfiler;
using v8::Int32;
using v8::Integer;
using v8::Isolate;
using v8::Local;
using v8::MaybeLocal;
using v8::Number;
using v8::Object;
using v8::RetainedObjectInfo;
using v8::TryCatch;
using v8::Value;

using AsyncHooks = node::Environment::AsyncHooks;

namespace node {

#define SET_HOOKS_CONSTANT(isolate, context, obj, name)                       \
  do {                                                                        \
    obj->ForceSet(context,                                                    \
                  FIXED_ONE_BYTE_STRING(isolate, #name),                      \
                  Integer::New(isolate, AsyncHooks::name),                    \
                  v8::ReadOnly).FromJust();                                   \
  } while (0)

static const char* const provider_names[] = {
#define V(PROVIDER)                                                           \
  #PROVIDER,
  NODE_ASYNC_PROVIDER_TYPES(V)
#undef V
};


// Report correct information in a heapdump.

class RetainedAsyncInfo: public RetainedObjectInfo {
 public:
  explicit RetainedAsyncInfo(uint16_t class_id, AsyncWrap* wrap);

  void Dispose() override;
  bool IsEquivalent(RetainedObjectInfo* other) override;
  intptr_t GetHash() override;
  const char* GetLabel() override;
  intptr_t GetSizeInBytes() override;

 private:
  const char* label_;
  const AsyncWrap* wrap_;
  const int length_;
};


RetainedAsyncInfo::RetainedAsyncInfo(uint16_t class_id, AsyncWrap* wrap)
    : label_(provider_names[class_id - NODE_ASYNC_ID_OFFSET]),
      wrap_(wrap),
      length_(wrap->self_size()) {
}


void RetainedAsyncInfo::Dispose() {
  delete this;
}


bool RetainedAsyncInfo::IsEquivalent(RetainedObjectInfo* other) {
  return label_ == other->GetLabel() &&
          wrap_ == static_cast<RetainedAsyncInfo*>(other)->wrap_;
}


intptr_t RetainedAsyncInfo::GetHash() {
  return reinterpret_cast<intptr_t>(wrap_);
}


const char* RetainedAsyncInfo::GetLabel() {
  return label_;
}


intptr_t RetainedAsyncInfo::GetSizeInBytes() {
  return length_;
}


RetainedObjectInfo* WrapperInfo(uint16_t class_id, Local<Value> wrapper) {
  // No class_id should be the provider type of NONE.
  CHECK_GT(class_id, NODE_ASYNC_ID_OFFSET);
  // And make sure the class_id doesn't extend past the last provider.
  CHECK_LE(class_id - NODE_ASYNC_ID_OFFSET, AsyncWrap::PROVIDERS_LENGTH);
  CHECK(wrapper->IsObject());
  CHECK(!wrapper.IsEmpty());

  Local<Object> object = wrapper.As<Object>();
  CHECK_GT(object->InternalFieldCount(), 0);

  AsyncWrap* wrap = Unwrap<AsyncWrap>(object);
  CHECK_NE(nullptr, wrap);

  return new RetainedAsyncInfo(class_id, wrap);
}


// end RetainedAsyncInfo


static void SetupHooks(const FunctionCallbackInfo<Value>& args) {
  Environment* env = Environment::GetCurrent(args);

  if (!args[0]->IsObject())
    return env->ThrowTypeError("first argument must be an object");

  // All of init, before, after, destroy are supplied by async_hooks
  // internally, so this should every only be called once. At which time all
  // the functions should be set. Detect this by checking if init !IsEmpty().
  CHECK(env->async_hooks_init_function().IsEmpty());

  Local<Object> fn_obj = args[0].As<Object>();

  Local<Value> init_v = fn_obj->Get(
      env->context(),
      FIXED_ONE_BYTE_STRING(env->isolate(), "init")).ToLocalChecked();
  Local<Value> before_v = fn_obj->Get(
      env->context(),
      FIXED_ONE_BYTE_STRING(env->isolate(), "before")).ToLocalChecked();
  Local<Value> after_v = fn_obj->Get(
      env->context(),
      FIXED_ONE_BYTE_STRING(env->isolate(), "after")).ToLocalChecked();
  Local<Value> destroy_v = fn_obj->Get(
      env->context(),
      FIXED_ONE_BYTE_STRING(env->isolate(), "destroy")).ToLocalChecked();

  CHECK(init_v->IsFunction());
  CHECK(before_v->IsFunction());
  CHECK(after_v->IsFunction());
  CHECK(destroy_v->IsFunction());

  env->set_async_hooks_init_function(init_v.As<Function>());
  env->set_async_hooks_before_function(before_v.As<Function>());
  env->set_async_hooks_after_function(after_v.As<Function>());
  env->set_async_hooks_destroy_function(destroy_v.As<Function>());
}


void AsyncWrap::Initialize(Local<Object> target,
                           Local<Value> unused,
                           Local<Context> context) {
  Environment* env = Environment::GetCurrent(context);
  Isolate* isolate = env->isolate();
  HandleScope scope(isolate);

  env->SetMethod(target, "setupHooks", SetupHooks);

  // Attach the uint32_t[] where each slot contains the count of the number of
  // callbacks waiting to be called on a particular event. It can then be
  // incremented/decremented from JS quickly to communicate to C++ if there are
  // any callbacks waiting to be called.
  uint32_t* fields_ptr = env->async_hooks()->fields();
  int fields_count = env->async_hooks()->fields_count();
  Local<ArrayBuffer> fields_ab = ArrayBuffer::New(
      isolate,
      fields_ptr,
      fields_count * sizeof(*fields_ptr));
  Local<Float64Array> fields =
      Float64Array::New(fields_ab, 0, fields_count);
  target->Set(context,
              FIXED_ONE_BYTE_STRING(isolate, "async_hook_fields"),
              fields).FromJust();

  // The following v8::Float64Array has 5 fields. These fields are shared in
  // this way to allow JS and C++ to read/write each value as quickly as
  // possible. The fields are represented as follows:
  //
  // kAsyncUid: Maintains the state of the next unique id to be assigned.
  //
  // kCurrentId: Is the id of the resource responsible for the current
  //   execution context. A currentId == 0 means the "void", or that there is
  //   no JS stack above the init() call (happens when a new handle is created
  //   for an incoming TCP socket). A currentId == 1 means "root". Or the
  //   execution context of node::StartNodeInstance.
  //
  // kTriggerId: Is the id of the resource responsible for init() being called.
  //   For example, the trigger id of a new connection's TCP handle would be
  //   the server handle. Whereas the current id at that time would be 0.
  //
  // kInitTriggerId: Write the id of the resource resource responsible for a
  //   handle's creation just before calling the new handle's constructor.
  //   After the new handle is constructed kInitTriggerId is set back to 0.
  //
  // kScopedTriggerId: triggerId for all constructors created within the
  //   execution scope of the JS function triggerIdScope(). This value is
  //   superseded by kInitTriggerId, if set.
  double* uid_fields_ptr = env->async_hooks()->uid_fields();
  int uid_fields_count = env->async_hooks()->uid_fields_count();
  Local<ArrayBuffer> uid_fields_ab = ArrayBuffer::New(
      isolate,
      uid_fields_ptr,
      uid_fields_count * sizeof(*uid_fields_ptr));
  Local<Float64Array> uid_fields =
      Float64Array::New(uid_fields_ab, 0, uid_fields_count);
  target->Set(context,
              FIXED_ONE_BYTE_STRING(isolate, "async_uid_fields"),
              uid_fields).FromJust();

  // TODO(trevnorris): Passing all this in feels bloated, but don't like
  // depending on "magic" variables available in the macro.
  Local<Object> constants = Object::New(isolate);
  SET_HOOKS_CONSTANT(isolate, context, constants, kInit);
  SET_HOOKS_CONSTANT(isolate, context, constants, kBefore);
  SET_HOOKS_CONSTANT(isolate, context, constants, kAfter);
  SET_HOOKS_CONSTANT(isolate, context, constants, kDestroy);
  SET_HOOKS_CONSTANT(isolate, context, constants, kActiveHooks);
  SET_HOOKS_CONSTANT(isolate, context, constants, kAsyncUidCntr);
  SET_HOOKS_CONSTANT(isolate, context, constants, kCurrentId);
  SET_HOOKS_CONSTANT(isolate, context, constants, kTriggerId);
  SET_HOOKS_CONSTANT(isolate, context, constants, kInitTriggerId);
  target->Set(context, FIXED_ONE_BYTE_STRING(isolate, "constants"), constants)
      .FromJust();

  Local<Object> async_providers = Object::New(isolate);
#define V(PROVIDER)                                                           \
  async_providers->Set(FIXED_ONE_BYTE_STRING(isolate, #PROVIDER),             \
      Integer::New(isolate, AsyncWrap::PROVIDER_ ## PROVIDER));
  NODE_ASYNC_PROVIDER_TYPES(V)
#undef V
  target->Set(FIXED_ONE_BYTE_STRING(isolate, "Providers"), async_providers);

  env->set_async_hooks_init_function(Local<Function>());
  env->set_async_hooks_before_function(Local<Function>());
  env->set_async_hooks_after_function(Local<Function>());
  env->set_async_hooks_destroy_function(Local<Function>());
}


void AsyncWrap::GetUid(const v8::FunctionCallbackInfo<v8::Value>& args) {
  AsyncWrap* wrap;
  args.GetReturnValue().Set(-1);
  ASSIGN_OR_RETURN_UNWRAP(&wrap, args.Holder());
  args.GetReturnValue().Set(wrap->get_id());
}


void LoadAsyncWrapperInfo(Environment* env) {
  HeapProfiler* heap_profiler = env->isolate()->GetHeapProfiler();
#define V(PROVIDER)                                                           \
  heap_profiler->SetWrapperClassInfoProvider(                                 \
      (NODE_ASYNC_ID_OFFSET + AsyncWrap::PROVIDER_ ## PROVIDER), WrapperInfo);
  NODE_ASYNC_PROVIDER_TYPES(V)
#undef V
}


// TODO(trevnorris): Look into the overhead of using this. Can't use it anway
// if it switches to using persistent strings instead.
static const char* GetProviderName(AsyncWrap::ProviderType provider) {
  CHECK_GT(provider, 0);
  CHECK_LE(provider, AsyncWrap::PROVIDERS_LENGTH);
  return provider_names[provider];
}


AsyncWrap::AsyncWrap(Environment* env,
                     Local<Object> object,
                     ProviderType provider,
                     AsyncWrap* parent)
    : BaseObject(env, object), bits_(static_cast<uint32_t>(provider) << 1),
      uid_(env->get_async_wrap_uid()) {
  CHECK_NE(provider, PROVIDER_NONE);
  CHECK_GE(object->InternalFieldCount(), 1);

  // Shift provider value over to prevent id collision.
  persistent().SetWrapperClassId(NODE_ASYNC_ID_OFFSET + provider);

  Local<Function> init_fn = env->async_hooks_init_function();

  // No init callback exists, no reason to go on.
  if (init_fn.IsEmpty())
    return;

  HandleScope scope(env->isolate());

  Local<Value> argv[] = {
    Number::New(env->isolate(), get_id()),
    Int32::New(env->isolate(), provider),
    Null(env->isolate()),
    Null(env->isolate())
  };

  if (parent != nullptr) {
    argv[2] = Number::New(env->isolate(), parent->get_id());
    argv[3] = parent->object();
  }

  TryCatch try_catch(env->isolate());

  MaybeLocal<Value> ret =
      init_fn->Call(env->context(), object, arraysize(argv), argv);

  if (ret.IsEmpty()) {
    ClearFatalExceptionHandlers(env);
    FatalException(env->isolate(), try_catch);
  }

  bits_ |= 1;  // ran_init_callback() is true now.
}


inline AsyncWrap::~AsyncWrap() {
  if (!ran_init_callback())
    return;

  Local<Function> fn = env()->async_hooks_destroy_function();
  if (!fn.IsEmpty()) {
    HandleScope scope(env()->isolate());
    Local<Value> uid = Number::New(env()->isolate(), get_id());
    TryCatch try_catch(env()->isolate());
    MaybeLocal<Value> ret =
        fn->Call(env()->context(), Null(env()->isolate()), 1, &uid);
    if (ret.IsEmpty()) {
      ClearFatalExceptionHandlers(env());
      FatalException(env()->isolate(), try_catch);
    }
  }
}


void AsyncWrap::GetUid(const FunctionCallbackInfo<Value>& args) {
  AsyncWrap* wrap;
  ASSIGN_OR_RETURN_UNWRAP(&wrap, args.Holder());
  args.GetReturnValue().Set(wrap->get_id());
}


Local<Value> AsyncWrap::MakeCallback(const Local<Function> cb,
                                     int argc,
                                     Local<Value>* argv) {
  CHECK(env()->context() == env()->isolate()->GetCurrentContext());

  Local<Function> before_fn = env()->async_hooks_before_function();
  Local<Function> after_fn = env()->async_hooks_after_function();
  Local<Value> uid = Number::New(env()->isolate(), get_id());
  Local<Object> context = object();
  Local<Object> domain;
  bool has_domain = false;

  Environment::AsyncCallbackScope callback_scope(env());

  if (env()->using_domains()) {
    Local<Value> domain_v = context->Get(env()->domain_string());
    has_domain = domain_v->IsObject();
    if (has_domain) {
      domain = domain_v.As<Object>();
      if (domain->Get(env()->disposed_string())->IsTrue())
        return Local<Value>();
    }
  }

  if (has_domain) {
    Local<Value> enter_v = domain->Get(env()->enter_string());
    if (enter_v->IsFunction()) {
      if (enter_v.As<Function>()->Call(domain, 0, nullptr).IsEmpty()) {
        FatalError("node::AsyncWrap::MakeCallback",
                   "domain enter callback threw, please report this");
      }
    }
  }

  if (ran_init_callback() && !before_fn.IsEmpty()) {
    TryCatch try_catch(env()->isolate());
    MaybeLocal<Value> ar = before_fn->Call(env()->context(), context, 1, &uid);
    if (ar.IsEmpty()) {
      ClearFatalExceptionHandlers(env());
      FatalException(env()->isolate(), try_catch);
      return Local<Value>();
    }
  }

  Local<Value> ret = cb->Call(context, argc, argv);

  if (ran_init_callback() && !after_fn.IsEmpty()) {
    Local<Value> did_throw = Boolean::New(env()->isolate(), ret.IsEmpty());
    Local<Value> vals[] = { uid, did_throw };
    TryCatch try_catch(env()->isolate());
    MaybeLocal<Value> ar =
        after_fn->Call(env()->context(), context, arraysize(vals), vals);
    if (ar.IsEmpty()) {
      ClearFatalExceptionHandlers(env());
      FatalException(env()->isolate(), try_catch);
      return Local<Value>();
    }
  }

  if (ret.IsEmpty()) {
    return ret;
  }

  if (has_domain) {
    Local<Value> exit_v = domain->Get(env()->exit_string());
    if (exit_v->IsFunction()) {
      if (exit_v.As<Function>()->Call(domain, 0, nullptr).IsEmpty()) {
        FatalError("node::AsyncWrap::MakeCallback",
                   "domain exit callback threw, please report this");
      }
    }
  }

  if (callback_scope.in_makecallback()) {
    return ret;
  }

  Environment::TickInfo* tick_info = env()->tick_info();

  if (tick_info->length() == 0) {
    env()->isolate()->RunMicrotasks();
  }

  Local<Object> process = env()->process_object();

  if (tick_info->length() == 0) {
    tick_info->set_index(0);
    return ret;
  }

  if (env()->tick_callback_function()->Call(process, 0, nullptr).IsEmpty()) {
    return Local<Value>();
  }

  return ret;
}

}  // namespace node

NODE_MODULE_CONTEXT_AWARE_BUILTIN(async_wrap, node::AsyncWrap::Initialize)
