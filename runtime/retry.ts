/**
 * V2 retry runtime. Default max 2 retries.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  times = 2
): Promise<T> {
  for (let i = 0; i <= times; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === times) {
        throw e;
      }
      console.log(`[RETRY] attempt ${i + 1} failed, retrying...`);
      await sleep(1000 * (i + 1)); // backoff: 1s, 2s
    }
  }
  throw new Error('[RETRY] unreachable');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
