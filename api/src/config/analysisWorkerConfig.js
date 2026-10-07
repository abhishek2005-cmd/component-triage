function positiveInteger(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export const analysisWorkerConfig = Object.freeze({
  pollIntervalMs: positiveInteger('ANALYSIS_POLL_INTERVAL_MS', 1000),
  maxAttempts: positiveInteger('ANALYSIS_MAX_ATTEMPTS', 5),
  retryBaseDelayMs: positiveInteger('ANALYSIS_RETRY_BASE_DELAY_MS', 5000),
  retryMaxDelayMs: positiveInteger('ANALYSIS_RETRY_MAX_DELAY_MS', 300000),
  leaseDurationMs: positiveInteger('ANALYSIS_LEASE_DURATION_MS', 60000),
  requestTimeoutMs: positiveInteger('ANALYSIS_REQUEST_TIMEOUT_MS', 20000),
});

if (analysisWorkerConfig.retryMaxDelayMs < analysisWorkerConfig.retryBaseDelayMs) {
  throw new Error('ANALYSIS_RETRY_MAX_DELAY_MS must be at least the base delay');
}
if (analysisWorkerConfig.leaseDurationMs <= analysisWorkerConfig.requestTimeoutMs) {
  throw new Error('ANALYSIS_LEASE_DURATION_MS must exceed request timeout');
}