/**
 * V2 retry runtime with exponential backoff. Default max 2 retries.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  times = 2
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= times; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (i === times) break;
      const delayMs = 1000 * (i + 1); // backoff: 1s, 2s
      console.log(`[RETRY] attempt ${i + 1} failed, retrying in ${delayMs}ms...`);
      if (e instanceof Error) {
        console.log(`[RETRY] error: ${e.message}`);
      }
      await sleep(delayMs);
    }
  }
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
