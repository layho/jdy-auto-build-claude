import type { Page } from 'playwright';

/**
 * Close any visible modal dialog.
 * V2 rule: always recover from unexpected modals.
 */
export async function closeModal(page: Page): Promise<boolean> {
  const closeSelectors = [
    '[aria-label="关闭"]',
    '[data-testid="modal-close"]',
    'button:has-text("关闭")',
    'button:has-text("取消")',
  ];

  for (const selector of closeSelectors) {
    const btn = page.locator(selector);
    if ((await btn.count()) > 0) {
      await btn.first().click();
      console.log('[RECOVERY] modal closed');
      await page.waitForTimeout(500);
      return true;
    }
  }
  return false;
}

/**
 * Dismiss any visible toast/notification.
 */
export async function dismissToast(page: Page): Promise<void> {
  const toast = page.locator('[role="alert"], [data-testid="toast"]');
  if ((await toast.count()) > 0) {
    await page.waitForTimeout(2000); // let it auto-dismiss
    console.log('[RECOVERY] toast dismissed');
  }
}

/**
 * Handle stale locator: re-acquire the element after a rerender.
 * V2 rule: after any rerender, re-fetch the locator.
 */
export async function reacquireLocator<T>(
  page: Page,
  selectors: string[],
  action: (locator: ReturnType<Page['locator']>) => Promise<T>
): Promise<T> {
  const { smartLocate } = await import('./smartLocate');
  const locator = await smartLocate(page, selectors);
  return action(locator);
}

/**
 * Full recovery sequence: close modals, dismiss toasts, wait for stability.
 * Max 1 recovery attempt per V2 rules.
 */
export async function recover(page: Page): Promise<void> {
  console.log('[RECOVERY] starting recovery sequence...');
  await closeModal(page);
  await dismissToast(page);
  const { waitForStableDOM } = await import('./dom');
  await waitForStableDOM(page, 500);
  console.log('[RECOVERY] recovery complete');
}
