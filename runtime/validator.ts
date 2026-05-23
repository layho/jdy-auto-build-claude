import type { Page } from 'playwright';

/**
 * Validate that the current app is the allowed target.
 * V2 rule: only operate on 爱马仕. Stop immediately otherwise.
 */
export async function validateApp(page: Page, targetApp: string): Promise<void> {
  const appNameSelectors = [
    '[data-app-name]',
    '[data-testid="app-name"]',
  ];

  for (const selector of appNameSelectors) {
    const el = page.locator(selector);
    if ((await el.count()) > 0) {
      const appName = (await el.first().textContent())?.trim() ?? '';
      console.log(`[VALIDATION] current app: ${appName}`);
      if (appName !== targetApp) {
        throw new Error(
          `[VALIDATION] Forbidden application: "${appName}". Only "${targetApp}" is allowed.`
        );
      }
      console.log(`[VALIDATION] app confirmed: ${targetApp}`);
      return;
    }
  }
  console.log('[VALIDATION] could not detect app name, proceeding with caution');
}

/**
 * Validate that a save operation succeeded by checking for success indicators.
 */
export async function validateSave(page: Page): Promise<boolean> {
  const successSelectors = [
    '[data-testid="save-status"][data-status="success"]',
    '[aria-label="保存成功"]',
    '.toast-success',
    'text=保存成功',
  ];

  for (const selector of successSelectors) {
    const el = page.locator(selector);
    if ((await el.count()) > 0) {
      console.log('[VALIDATION] save confirmed');
      return true;
    }
  }

  // Also check no error toast
  const errorToast = page.locator('[role="alert"], .toast-error');
  if ((await errorToast.count()) > 0) {
    const text = await errorToast.first().textContent();
    console.log(`[VALIDATION] save may have failed: ${text}`);
    return false;
  }

  return true;
}

/**
 * Validate that an element exists and is visible.
 */
export async function validateElement(
  page: Page,
  selectors: string[]
): Promise<boolean> {
  for (const selector of selectors) {
    const el = page.locator(selector);
    if ((await el.count()) > 0) {
      const visible = await el.first().isVisible();
      if (visible) {
        console.log(`[VALIDATION] element found: ${selector}`);
        return true;
      }
    }
  }
  console.log(`[VALIDATION] element not found: ${selectors[0]}`);
  return false;
}
