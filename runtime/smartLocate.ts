import type { Page, Locator } from 'playwright';

/**
 * V2 smartLocate - multi-selector fallback with semantic matching.
 * Priority: data-testid → aria-label → role → placeholder → text
 * Always returns the first match.
 */
export async function smartLocate(
  page: Page,
  selectors: string[]
): Promise<Locator> {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    if ((await locator.count()) > 0) {
      console.log('[SELECTOR] matched:', selector);
      return locator.first();
    }
  }
  throw new Error(`[SELECTOR] No selector matched from: ${selectors.join(', ')}`);
}

/**
 * Try to locate an element, returning null instead of throwing on failure.
 */
export async function tryLocate(
  page: Page,
  selectors: string[]
): Promise<Locator | null> {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    if ((await locator.count()) > 0) {
      return locator.first();
    }
  }
  return null;
}

/**
 * Wait for any of the given selectors to appear, with timeout.
 */
export async function waitForAnySelector(
  page: Page,
  selectors: string[],
  timeoutMs = 15000
): Promise<Locator> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const selector of selectors) {
      const locator = page.locator(selector);
      if ((await locator.count()) > 0) {
        return locator.first();
      }
    }
    await page.waitForTimeout(300);
  }
  throw new Error(`[SELECTOR] Timeout waiting for: ${selectors.join(', ')}`);
}
