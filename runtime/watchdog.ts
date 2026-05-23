/**
 * V2 Watchdog: monitors memory and enforces hard timeout.
 * Kills the process if thresholds are exceeded.
 */

interface WatchdogConfig {
  hardTimeoutMs: number;   // 10 min default
  memoryThresholdMB: number;
  checkIntervalMs: number;
}

interface WatchdogHandle {
  hardTimer: NodeJS.Timeout;
  memTimer: NodeJS.Timeout;
}

// Use a WeakMap-style approach with a plain Map to store handles
const _handles = new Map<symbol, WatchdogHandle>();

export function startWatchdog(config: Partial<WatchdogConfig> = {}): symbol {
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
  hardTimer.unref();

  // Memory monitor
  const memTimer = setInterval(() => {
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    if (used > memoryThresholdMB) {
      console.error(`[WATCHDOG] Memory threshold exceeded: ${used.toFixed(1)}MB > ${memoryThresholdMB}MB`);
      process.exit(1);
    }
  }, checkIntervalMs);
  memTimer.unref();

  console.log(`[WATCHDOG] started (timeout: ${hardTimeoutMs / 1000}s, mem limit: ${memoryThresholdMB}MB)`);

  const handle = Symbol('watchdog');
  _handles.set(handle, { hardTimer, memTimer });
  return handle;
}

export function stopWatchdog(handle: symbol): void {
  const timers = _handles.get(handle);
  if (!timers) {
    console.warn('[WATCHDOG] stopWatchdog called with unknown handle');
    return;
  }
  clearTimeout(timers.hardTimer);
  clearInterval(timers.memTimer);
  _handles.delete(handle);
  console.log('[WATCHDOG] stopped');
}
