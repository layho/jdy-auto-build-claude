import type { Page } from 'playwright';

/**
 * Wait for DOM to stabilize: network idle + extra settle time.
 * V2 rule: networkidle + 800ms.
 */
export async function waitForStableDOM(page: Page, settleMs = 800): Promise<void> {
  console.log('[DOM] waiting for stable DOM...');
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
    console.log('[DOM] networkidle timed out (websockets may be active), continuing...');
  });
  await page.waitForTimeout(settleMs);
  console.log('[DOM] DOM stable');
}

/**
 * Extract a localized DOM snapshot from a specific panel, avoiding full page.content().
 * V2 rule: never feed full DOM to DeepSeek.
 */
export async function getLocalDOM(
  page: Page,
  panelSelector: string = '[data-form-panel]'
): Promise<string | null> {
  const panel = page.locator(panelSelector).first();
  if ((await panel.count()) === 0) {
    return null;
  }
  return panel.innerHTML({ timeout: 5000 });
}

/**
 * Capture screenshot (Level 1 snapshot).
 * Creates screenshots directory if it doesn't exist.
 */
export async function captureScreenshot(
  page: Page,
  label: string
): Promise<string> {
  const fs = await import('fs');
  if (!fs.existsSync('screenshots')) {
    fs.mkdirSync('screenshots', { recursive: true });
  }
  // Sanitize label to avoid path injection
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = `screenshots/${safeLabel}-${Date.now()}.png`;
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`[DOM] screenshot saved: ${filePath}`);
  return filePath;
}

/**
 * Check if loading spinner is present.
 */
export async function isLoading(page: Page): Promise<boolean> {
  const spinners = page.locator('[data-testid="loading"], [role="progressbar"], [aria-label="加载中"]');
  return (await spinners.count()) > 0;
}

/**
 * Wait until loading spinners disappear.
 */
export async function waitForLoadingDone(page: Page, timeoutMs = 30000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isLoading(page))) {
      return;
    }
    await page.waitForTimeout(500);
  }
  console.log('[DOM] loading timeout, continuing...');
}
