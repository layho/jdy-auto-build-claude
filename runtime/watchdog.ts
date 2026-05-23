/**
 * V2 Watchdog: monitors memory and enforces hard timeout.
 * Kills the process if thresholds are exceeded.
 */

interface WatchdogConfig {
  hardTimeoutMs: number;   // 10 min default
  memoryThresholdMB: number;
  checkIntervalMs: number;
}

export function startWatchdog(config: Partial<WatchdogConfig> = {}): NodeJS.Timeout {
  const {
    hardTimeoutMs = 600_000,
    memoryThresholdMB = 2048,
    checkIntervalMs = 30_000,
  } = config;

  // Hard timeout: force exit after N ms
  const hardTimer = setTimeout(() => {
    console.error('[WATCHDOG] Hard timeout reached, force exit');
    process.exit(1);
  }, hardTimeoutMs);

  // Memory monitor
  const memTimer = setInterval(() => {
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    if (used > memoryThresholdMB) {
      console.error(`[WATCHDOG] Memory threshold exceeded: ${used.toFixed(1)}MB > ${memoryThresholdMB}MB`);
      process.exit(1);
    }
  }, checkIntervalMs);

  console.log(`[WATCHDOG] started (timeout: ${hardTimeoutMs / 1000}s, mem limit: ${memoryThresholdMB}MB)`);

  // Return a combined handle; clearing both on cleanup
  const combined = setInterval(() => {}, 1000);
  combined.unref();
  (combined as unknown as { _hard: NodeJS.Timeout; _mem: NodeJS.Timeout })._hard = hardTimer;
  (combined as unknown as { _hard: NodeJS.Timeout; _mem: NodeJS.Timeout })._mem = memTimer;

  return combined;
}

export function stopWatchdog(timer: NodeJS.Timeout): void {
  const t = timer as unknown as { _hard: NodeJS.Timeout; _mem: NodeJS.Timeout };
  clearTimeout(t._hard);
  clearInterval(t._mem);
  clearInterval(timer);
  console.log('[WATCHDOG] stopped');
}
