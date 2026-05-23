/**
 * Stage 0 v2: Delete ALL old forms and dashboards using mouse click on setting icon
 */
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06';

const OLD_ITEMS = [
  '客户信息', '产品信息', '订单管理', '订单明细表', '请假申请',
  '未命名仪表盘', '订单数据概览',
];

async function deleteMenuItem(page: any, itemName: string): Promise<boolean> {
  let retries = 0;
  while (retries < 3) {
    try {
      // Force the setting icon visible for this item and click it via mouse
      const clicked = await page.evaluate(async (name: string) => {
        const nodes = document.querySelectorAll('.fx-app-menu-tree .tree-node');
        for (const node of nodes) {
          const nameEl = node.querySelector('.name-text');
          if (nameEl && (nameEl as HTMLElement).innerText?.trim() === name) {
            // Force setting visible
            const settingDiv = node.querySelector('.setting') as HTMLElement;
            if (!settingDiv) return 'NO_SETTING';
            settingDiv.style.setProperty('display', 'flex', 'important');
            settingDiv.style.setProperty('visibility', 'visible', 'important');
            settingDiv.style.setProperty('opacity', '1', 'important');

            const icon = settingDiv.querySelector('i') as HTMLElement;
            if (!icon) return 'NO_ICON';
            const rect = icon.getBoundingClientRect();
            return JSON.stringify({ x: rect.x + rect.width/2, y: rect.y + rect.height/2 });
          }
        }
        return 'NOT_FOUND';
      }, itemName);

      if (clicked === 'NOT_FOUND') {
        console.log(`  ${itemName}: already deleted or not found`);
        return true;
      }
      if (clicked === 'NO_SETTING' || clicked === 'NO_ICON') {
        console.log(`  ${itemName}: no setting icon`);
        return false;
      }

      const pos = JSON.parse(clicked);
      await page.mouse.move(pos.x, pos.y, { steps: 5 });
      await page.waitForTimeout(500);
      await page.mouse.click(pos.x, pos.y);
      await page.waitForTimeout(2000);

      // Check body text for the menu (more reliable than element visibility)
      let checkText = await page.locator('body').first().innerText().catch(() => '');
      if (checkText.includes('删除\n') || checkText.includes('删除')) {
        // Find and click the "删除" x-menu-item using evaluate
        const delClicked = await page.evaluate(() => {
          const items = document.querySelectorAll('.x-menu-item, .x-popover .x-menu-item');
          for (const item of items) {
            if ((item as HTMLElement).innerText?.trim() === '删除') {
              (item as HTMLElement).click();
              return true;
            }
          }
          return false;
        });

        if (delClicked) {
          console.log(`  [DELETE] ${itemName}: clicked 删除`);
          await page.waitForTimeout(1500);

          // Check body text for the confirmation dialog
          checkText = await page.locator('body').first().innerText().catch(() => '');

          if (checkText.includes('确定要删除')) {
            // Type the form name to confirm - input is in .x-alert .alert-body
            const confirmInput = page.locator('.x-alert .alert-body input, .alert-content input, .x-window-mask input').first();
            if (await confirmInput.count() > 0 && await confirmInput.isVisible({ timeout: 1000 }).catch(() => false)) {
              await confirmInput.click({ force: true });
              await page.waitForTimeout(300);
              await confirmInput.fill(itemName);
              console.log(`  [TYPE] Entered: ${itemName}`);
              await page.waitForTimeout(2500); // Wait for countdown + button enable
            } else {
              console.log(`  [TYPE] Input not found`);
            }
          }

          // Now click the delete button (it should be enabled after typing)
          const clickedConfirm = await page.evaluate(() => {
            const btns = document.querySelectorAll('button');
            for (const btn of btns) {
              const text = (btn as HTMLButtonElement).innerText?.trim();
              if (text && text.startsWith('删除') && !(btn as HTMLButtonElement).disabled) {
                (btn as HTMLButtonElement).click();
                return 'delete button';
              }
            }
            return null;
          });

          if (clickedConfirm) {
            console.log(`  [CONFIRM] ${itemName}: confirmed`);
            await page.waitForTimeout(3000);
          } else {
            console.log(`  [CONFIRM] ${itemName}: delete button not enabled`);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
          }
          return true;
        }
      }

      // If we got here, something went wrong
      retries++;
      console.log(`  [RETRY] ${itemName}: menu interaction failed, retry ${retries}`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } catch (e: any) {
      retries++;
      console.log(`  [ERROR] ${itemName}: ${e.message}, retry ${retries}`);
      await page.waitForTimeout(500);
    }
  }
  return false;
}

async function main() {
  console.log('[STAGE 0 v2] DELETING ALL OLD ITEMS\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    let bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log('Initial state:');
    console.log(bodyText.split('\n').filter((l: string) => l.length > 1 && l.length < 30).join('\n'));

    // Delete each old item - keep same page session, don't reload between items
    let deletedCount = 0;
    for (const itemName of OLD_ITEMS) {
      // Skip if already gone
      const currentText = await page.locator('body').first().innerText().catch(() => '');
      const count = (currentText.match(new RegExp(itemName, 'g')) || []).length;

      if (count === 0) {
        console.log(`  ${itemName}: already gone`);
        continue;
      }

      // Delete ALL instances of this item (handles duplicates like 订单数据概览 x3)
      for (let i = 0; i < count; i++) {
        console.log(`\nDeleting: ${itemName} (instance ${i + 1}/${count})`);
        const result = await deleteMenuItem(page, itemName);
        if (result) {
          deletedCount++;
          // Reload to refresh menu state
          await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
          await waitForStableDOM(page);
          await page.waitForTimeout(2000);
        }
      }
    }

    // Final state
    bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log('\n\n[VALIDATION] Final app state:');
    const menuItems = bodyText.split('\n').filter((l: string) => l.length > 1 && l.length < 30);
    menuItems.forEach(l => console.log('  ' + l));

    const remaining = OLD_ITEMS.filter(i => bodyText.includes(i));
    console.log(`\nRemaining old items: ${remaining.length > 0 ? remaining.join(', ') : 'NONE - ALL CLEANED!'}`);

    await page.screenshot({ path: 'screenshots/stage0-all-cleaned.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
