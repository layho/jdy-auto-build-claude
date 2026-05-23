/**
 * Phase 24 v10 - Properly commit trigger action + configure action + save
 *
 * Key: Multi-select dropdown needs to be properly closed after selection
 * to commit the change. Also, use evaluate(el.click()) for save button.
 */
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const EDITOR_URL = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/automation/6a110c3d63fbb50f9e104db2/edit';

async function main() {
  console.log('[PHASE 24 v10 - PROPER TRIGGER + ACTION + SAVE]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(EDITOR_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    let bodyText = await page.locator('body').first().innerText().catch(() => '');

    // ====== Step 1: Open trigger config and select trigger action ======
    console.log('[1] Opening trigger config...');
    await page.locator('.clickable-text:has-text("订单管理")').first().click({ force: true });
    await page.waitForTimeout(1500);
    await waitForStableDOM(page);

    const drawerText = await page.locator('.fx-automation-node-config-drawer').first().innerText().catch(() => '');
    console.log('  Drawer:', drawerText.substring(0, 300));

    if (drawerText.includes('请选择触发动作')) {
      console.log('  Selecting trigger action...');

      // The dropdown options are in a visible popup (.x-select-dropdown).
      // Use the scoped selector to avoid matching the hidden listbox options.
      const option = page.locator('.x-select-dropdown .x-select-item-option:has-text("新增数据时")').first();
      if (await option.count() > 0 && await option.isVisible({ timeout: 3000 }).catch(() => false)) {
        await option.click({ force: true });
        console.log('  Clicked 新增数据时');
        await page.waitForTimeout(500);
      } else {
        // Fallback: try clicking the "添加动作" button to open dropdown
        console.log('  Trying via 添加动作 button...');
        await page.locator('.fx-automation-design-trigger-actions button:has-text("添加动作")').first().click({ force: true });
        await page.waitForTimeout(800);
        const option2 = page.locator('.x-select-dropdown .x-select-item-option:has-text("新增数据时")').first();
        if (await option2.isVisible({ timeout: 2000 }).catch(() => false)) {
          await option2.click({ force: true });
          console.log('  Clicked via button');
          await page.waitForTimeout(500);
        }
      }

      // Press Escape to close dropdown and commit selection
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      const updatedDrawerText = await page.locator('.fx-automation-node-config-drawer').first().innerText().catch(() => '');
      console.log('  Result:', updatedDrawerText.includes('请选择触发动作') ? 'STILL HAS ERROR' : 'OK');
    }

    await page.screenshot({ path: 'screenshots/master24-v10-1-trigger.png', fullPage: true });

    // ====== Step 2: Save trigger config first ======
    console.log('\n[2] Saving trigger config first...');
    const saved = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.innerText?.includes('仅保存') && !(btn as HTMLButtonElement).disabled) {
          (btn as HTMLButtonElement).click();
          return '仅保存';
        }
      }
      for (const btn of buttons) {
        if (btn.innerText?.includes('保存并启用') && !(btn as HTMLButtonElement).disabled) {
          (btn as HTMLButtonElement).click();
          return '保存并启用';
        }
      }
      return null;
    });
    console.log(`  Clicked: ${saved}`);
    await page.waitForTimeout(5000);
    await waitForStableDOM(page);

    // Check for errors
    bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log('  Has 异常节点:', bodyText.includes('异常节点'));
    console.log('  Has 未发布变更:', bodyText.includes('有未发布变更'));

    await page.screenshot({ path: 'screenshots/master24-v10-2-trigger-saved.png', fullPage: true });

    // ====== Step 3: Add action node ======
    bodyText = await page.locator('body').first().innerText().catch(() => '');
    if (!bodyText.includes('目标表单') && !bodyText.includes('设置字段值')) {
      console.log('\n[3] Adding action node...');
      await page.locator('.fx-automation-design-plus-icon').first().click({ force: true });
      await page.waitForTimeout(800);
      await page.locator('.popover-content :text-is("新增数据")').first().click({ force: true });
      console.log('  Added');
      await page.waitForTimeout(2000);
      await waitForStableDOM(page);
    } else {
      console.log('\n[3] Action node already open');
    }

    // ====== Step 4: Select target form ======
    bodyText = await page.locator('body').first().innerText().catch(() => '');
    if (bodyText.includes('请选择表单')) {
      console.log('[4] Selecting target form...');
      const actionNodes = page.locator('[class*="node-container"]');
      const cnt = await actionNodes.count();
      if (cnt >= 2) {
        await actionNodes.nth(cnt - 1).click({ force: true });
        await page.waitForTimeout(800);
      }
      await page.locator('.fx-automation-node-config-drawer .x-biz-dropdown-label').first().click({ force: true });
      await page.waitForTimeout(800);
      await page.locator('[class*="popover"] .entry-item:has-text("产品信息")').first().click({ force: true });
      console.log('  产品信息');
      await page.waitForTimeout(2000);
      await waitForStableDOM(page);
    }

    await page.screenshot({ path: 'screenshots/master24-v10-3-form.png', fullPage: true });

    // ====== Step 5: Map all fields ======
    console.log('\n[5] Mapping fields...');
    let iteration = 0;
    while (iteration < 20) {
      iteration++;
      const placeholders = page.locator('.fx-automation-node-config-drawer .placeholder:has-text("请选择字段")');
      const phCount = await placeholders.count();
      if (phCount === 0) break;

      const ph = placeholders.first();
      await ph.scrollIntoViewIfNeeded();
      await ph.click({ force: true });
      await page.waitForTimeout(1000);

      const leaves = page.locator('.tree-item-leaf');
      const leafCount = await leaves.count();
      if (leafCount > 0) {
        const pickIdx = (iteration - 1) % leafCount;
        const leaf = leaves.nth(pickIdx);
        const leafText = await leaf.innerText();
        await leaf.click({ force: true });
        console.log(`  [${iteration}] "${leafText}"`);
        await page.waitForTimeout(500);
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    console.log(`  Done, mapped ${iteration - 1} fields`);

    await page.screenshot({ path: 'screenshots/master24-v10-4-mapped.png', fullPage: true });

    // ====== Step 6: Close drawer and save ======
    console.log('\n[6] Closing drawer...');
    await page.locator('[class*="scale-inner"]').first().click({ force: true });
    await page.waitForTimeout(1000);
    await waitForStableDOM(page);

    console.log('[7] Saving...');
    const saveResult = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.innerText?.includes('保存并启用') && !(btn as HTMLButtonElement).disabled) {
          (btn as HTMLButtonElement).click();
          return '保存并启用';
        }
      }
      for (const btn of buttons) {
        if (btn.innerText?.includes('仅保存') && !(btn as HTMLButtonElement).disabled) {
          (btn as HTMLButtonElement).click();
          return '仅保存';
        }
      }
      return null;
    });
    console.log(`  Clicked: ${saveResult}`);
    await page.waitForTimeout(5000);
    await waitForStableDOM(page);

    await page.screenshot({ path: 'screenshots/master24-v10-5-saved.png', fullPage: true });

    // Final check
    bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log('\nFinal state:');
    const keyLines = bodyText.split('\n').filter((l: string) =>
      l.includes('异常') || l.includes('未发布') || l.includes('保存成功') || l.includes('失败')
    );
    keyLines.forEach(l => console.log(`  ${l}`));

    if (bodyText.includes('异常节点')) {
      console.log('\n⚠ Still has abnormal nodes - trigger might need additional config');
    } else if (!bodyText.includes('有未发布变更')) {
      console.log('\n✓ Save successful - no unpublished changes!');
    } else {
      console.log('\n⚠ Save may have failed - checking...');
    }

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
