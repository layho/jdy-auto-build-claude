/**
 * Cleanup: Delete test forms. Handles:
 * - Delete confirmation with form-name input: type name → click "删除"
 * - Reference warning: click "我知道了" (cannot delete)
 * - Simple confirmation: just click "删除"
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, navigateToApp, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function closeDialog(page: any): Promise<void> {
  // x-alert dialogs don't close with Escape — click "取消" instead
  const cancelBtn = page.locator('[class*="alert"] button:has-text("取消")').last();
  if (await cancelBtn.count() > 0 && await cancelBtn.isVisible().catch(() => false)) {
    await cancelBtn.click({ force: true });
    await page.waitForTimeout(500);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  // Wait for mask to disappear
  const mask = page.locator('.x-window-mask');
  await mask.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
}

async function deleteForm(page: any, formName: string): Promise<boolean> {
  console.log(`  Deleting: "${formName}"...`);

  // Ensure clean state
  await closeDialog(page);

  // Find the form entry and hover to reveal ellipsis
  const formEntry = page.locator('.tree-node').filter({ hasText: formName }).first();
  if (await formEntry.count() === 0) {
    console.log(`    entry not found`);
    return false;
  }

  await formEntry.hover({ force: true });
  await page.waitForTimeout(600);

  const ellipsis = formEntry.locator('.entry-set-icon');
  try {
    await ellipsis.waitFor({ state: 'visible', timeout: 5000 });
    await ellipsis.click({ force: true });
    await page.waitForTimeout(600);
  } catch {
    console.log(`    ellipsis not clickable`);
    return false;
  }

  // Click "删除" in context menu (x-popover with li items)
  const deleteLi = page.locator('li:has-text("删除")').last();
  try {
    await deleteLi.click({ force: true, timeout: 5000 });
    console.log(`    clicked "删除"`);
  } catch {
    console.log(`    "删除" not in menu`);
    await closeDialog(page);
    return false;
  }
  await page.waitForTimeout(1000);

  // Now read the dialog that appeared
  // Read dialog text to understand what's needed
  const dialogText = await page.$eval('[class*="x-alert"]', (el: Element) => {
    return (el as HTMLElement).innerText?.trim() || '';
  }).catch(() => '');

  console.log(`    dialog: "${dialogText.substring(0, 150)}"`);

  // Case A: Reference warning — "表单已被引用，无法删除"
  if (dialogText.includes('无法删除') || dialogText.includes('已被引用')) {
    const gotIt = page.locator('button:has-text("我知道了")').last();
    if (await gotIt.count() > 0) {
      await gotIt.click({ force: true });
      console.log(`    cannot delete (referenced), dismissed`);
      await page.waitForTimeout(800);
      await closeDialog(page);
      return false;
    }
  }

  // Case B: Delete confirmation — may require typing form name
  if (dialogText.includes('确定要删除') || dialogText.includes('请输入表单名称')) {
    // Check if there's an input to type the form name
    const input = page.locator('[class*="x-alert"] input, [class*="alert"] input').first();
    const inputCount = await input.count();
    if (inputCount > 0 && await input.isVisible().catch(() => false)) {
      console.log(`    typing form name into confirmation input`);
      await input.click({ force: true });
      await page.waitForTimeout(200);
      // Triple-click to select any existing text, then type
      await input.click({ clickCount: 3, force: true });
      await input.fill(formName);
      await page.waitForTimeout(300);
    }

    // Click "删除" to confirm
    const delBtn = page.locator('[class*="alert"] button:has-text("删除")').last();
    if (await delBtn.count() > 0 && await delBtn.isVisible().catch(() => false)) {
      await delBtn.click({ force: true });
      console.log(`    confirmed delete`);
      await page.waitForTimeout(2000);
      await closeDialog(page);
      return true;
    }
  }

  // Dialogue didn't match expected patterns
  console.log(`    unexpected dialog, closing`);
  await page.screenshot({ path: `screenshots/debug-delete-${formName}.png`, fullPage: true });
  await closeDialog(page);
  return false;
}

async function main() {
  console.log('[CLEANUP] Starting...');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);
    await navigateToApp(page, '爱马仕');
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    const formNames = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
    console.log(`[CLEANUP] Current forms (${formNames.length}):`);
    formNames.forEach((name, i) => console.log(`  ${i}: ${name}`));

    const KEEP = ['产品信息', '客户', '供应商信息'];
    const toDelete = formNames.filter((n: string) => !KEEP.includes(n!)).reverse();
    console.log(`\n[CLEANUP] Keeping: ${KEEP.join(', ')}`);
    console.log(`[CLEANUP] Deleting ${toDelete.length} forms...`);

    let deleted = 0, skipped = 0;
    for (const name of toDelete) {
      const success = await deleteForm(page, name!);
      if (success) {
        deleted++;
        // After delete, navigate may change — wait for stable state
        await waitForStableDOM(page);
        await page.waitForTimeout(1000);
      } else {
        skipped++;
      }
    }

    // Final report
    const remaining = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
    console.log(`\n[CLEANUP] Deleted: ${deleted}, Skipped: ${skipped}`);
    console.log(`[CLEANUP] Remaining forms: ${remaining.join(', ')}`);

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
