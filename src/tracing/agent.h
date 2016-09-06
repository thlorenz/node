#ifndef SRC_TRACING_AGENT_H_
#define SRC_TRACING_AGENT_H_

#include "tracing/node_trace_buffer.h"
#include "tracing/node_trace_writer.h"
#include "uv.h"
#include "v8.h"

// Forward declaration to break recursive dependency chain with src/env.h.
namespace node {
class Environment;
}  // namespace node

namespace node {
namespace tracing {

class Agent {
 public:
  explicit Agent(Environment* env);
  void Start(v8::Platform* platform, const char* trace_config_file);
  void Stop();

 private:
  bool IsStarted() { return platform_ != nullptr; }
  static void ThreadCb(void* arg);

  uv_thread_t thread_;
  uv_loop_t tracing_loop_;
  v8::Platform* platform_ = nullptr;
  Environment* parent_env_;
  TracingController* tracing_controller_;
};

}  // namespace tracing
}  // namespace node

#endif  // SRC_TRACING_AGENT_H_
