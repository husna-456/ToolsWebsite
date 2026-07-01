// In-memory metrics for the Text-to-PDF AI formatting endpoint.
// Process-local counters — reset on restart. Good enough for a single-instance
// deployment; swap for a real metrics backend (Prometheus/Datadog) if this
// service ever scales beyond one process.

const state = {
  requests:        0,
  successes:       0,
  failures:        0,
  retries:         0,
  timeouts:        0,
  chunkedRequests: 0,
  chunksProcessed: 0,
  parseFallbacks:  0, // chunks where the model's JSON didn't parse cleanly (salvaged or plain-text)
  totalDurationMs: 0,
  failuresByCode:  {},
};

function recordRequest({ success, durationMs, retries = 0, timedOut = false, chunkCount = 1, parseFallbacks = 0, code = null }) {
  state.requests += 1;
  state.totalDurationMs += durationMs;
  state.retries += retries;
  state.parseFallbacks += parseFallbacks;
  if (timedOut) state.timeouts += 1;
  if (chunkCount > 1) state.chunkedRequests += 1;
  state.chunksProcessed += chunkCount;

  if (success) {
    state.successes += 1;
  } else {
    state.failures += 1;
    if (code) state.failuresByCode[code] = (state.failuresByCode[code] || 0) + 1;
  }
}

function getSnapshot() {
  const avgResponseTimeMs = state.requests ? Math.round(state.totalDurationMs / state.requests) : 0;
  const failureRate = state.requests ? +(state.failures / state.requests).toFixed(4) : 0;
  return {
    requests:            state.requests,
    successes:           state.successes,
    failures:            state.failures,
    failureRate,
    avgResponseTimeMs,
    retries:             state.retries,
    timeouts:            state.timeouts,
    chunkedRequests:     state.chunkedRequests,
    chunksProcessed:     state.chunksProcessed,
    parseFallbacks:      state.parseFallbacks,
    failuresByCode:      { ...state.failuresByCode },
  };
}

module.exports = { recordRequest, getSnapshot };
