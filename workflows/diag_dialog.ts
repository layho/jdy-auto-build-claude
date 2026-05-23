/**
 * Diagnose: Open context menu on a NON-active form, click "删除",
 * and inspect the confirmation dialog that appears.
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, navigateToApp, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[DIAG] Inspecting delete dialog on non-active form...');
  const wd = startWatchdog({ hardTimeoutMs: 120_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);
    await navigateToApp(page, '爱马仕');
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    // Pick a form that is NOT the active one (skip first tree-node)
    const allForms = page.locator('.tree-node');
    const count = await allForms.count();
    console.log(`[DIAG] Found ${count} form tree-nodes`);

    // Use the 3rd form (index 2) which should not be active
    const targetForm = allForms.nth(Math.min(2, count - 1));
    const formName = await targetForm.locator('.entry-name').textContent();
    console.log(`[DIAG] Target form: "${formName}"`);

    // Hover and click ellipsis
    await targetForm.hover({ force: true });
    await page.waitForTimeout(600);

    const ellipsis = targetForm.locator('.entry-set-icon');
    try {
      await ellipsis.waitFor({ state: 'visible', timeout: 5000 });
      await ellipsis.click({ force: true });
      console.log('[DIAG] Clicked ellipsis, context menu should be open');
    } catch {
      console.log('[DIAG] Ellipsis not found, trying right-click...');
      await targetForm.click({ button: 'right' });
    }
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'screenshots/diag1-context-menu.png', fullPage: true });

    // Find "删除" in context menu and click it
    const deleteMenuItem = page.locator('li:has-text("删除"), [class*="menu"]:has-text("删除")').last();
    const menuCount = await deleteMenuItem.count();
    console.log(`[DIAG] Found ${menuCount} "删除" menu items`);

    if (menuCount > 0) {
      await deleteMenuItem.first().click({ force: true });
      console.log('[DIAG] Clicked "删除" in context menu');
    } else {
      // Try text-based
      const anyDelete = page.locator('text="删除"').last();
      if (await anyDelete.count() > 0) {
        await anyDelete.click({ force: true });
        console.log('[DIAG] Clicked text="删除"');
      }
    }

    // Wait for the confirmation dialog to appear
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'screenshots/diag2-confirm-dialog.png', fullPage: true });

    // Dump the FULL dialog HTML
    const dialogHTML = await page.evaluate(() => {
      const dialogs = document.querySelectorAll('.x-dialog, [class*="dialog"], [class*="modal"], [role="dialog"], [class*="confirm"], [class*="popup"]');
      const results: string[] = [];
      dialogs.forEach((d, i) => {
        const el = d as HTMLElement;
        if (el.offsetParent !== null || el.innerHTML.length > 10) {
          results.push(`[Dialog ${i}] class="${el.className?.substring(0, 150)}" inner=${el.innerHTML.substring(0, 500)}`);
        }
      });
      return results.join('\n---\n');
    });
    console.log('[DIAG] Dialog HTML:');
    console.log(dialogHTML || '(no dialog found)');

    // Find ALL visible buttons with text
    const allBtns = await page.$$eval('button', els =>
      els.filter(el => {
        const htmlEl = el as HTMLElement;
        return htmlEl.offsetParent !== null && (el.textContent?.trim() || '').length > 0;
      }).map(el => ({
        text: el.textContent?.trim()?.substring(0, 60),
        parentClass: (el.parentElement?.className?.substring(0, 100) || ''),
        grandparentClass: (el.parentElement?.parentElement?.className?.substring(0, 100) || ''),
      }))
    );
    console.log('[DIAG] All visible buttons with parent context:');
    allBtns.forEach((b, i) => console.log(`  ${i}: "${b.text}" | parent: ${b.parentClass?.substring(0,50)} | grandparent: ${b.grandparentClass?.substring(0,50)}`));

    // Also check for <a> or <span> clickable elements in dialog
    const clickableInDialog = await page.$$eval('.x-dialog [class*="btn"], .x-dialog a, .x-dialog [role="button"]', els =>
      els.map(el => ({
        text: el.textContent?.trim()?.substring(0, 60),
        tag: el.tagName,
        class: (el as HTMLElement).className?.substring(0, 100),
      }))
    );
    console.log('[DIAG] Clickable elements in dialog:');
    clickableInDialog.forEach((el, i) => console.log(`  ${i}:`, JSON.stringify(el)));

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
