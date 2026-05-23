/**
 * Phase 24 v3 - Smart Assistant action node: properly expand tree, map all fields, save
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const EDITOR_URL = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/automation/6a110c3d63fbb50f9e104db2/edit';

async function expandAllTreeNodes(page: Page) {
  // Expand all collapsed tree nodes
  let expanded = true;
  while (expanded) {
    expanded = false;
    const collapsed = page.locator('.tree-item-switcher:not(.tree-item-switcher-expanded), [class*="tree"] [class*="switcher"]:not([class*="expanded"])');
    const count = await collapsed.count();
    for (let i = 0; i < count; i++) {
      const sw = collapsed.nth(i);
      if (await sw.isVisible().catch(() => false)) {
        await sw.click({ force: true });
        await page.waitForTimeout(200);
        expanded = true;
      }
    }
    if (!expanded) break;
  }
}

async function getLeafFields(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const leaves = document.querySelectorAll('.tree-item-leaf');
    return [...leaves]
      .filter(el => el.getBoundingClientRect().width > 0)
      .map(el => (el as HTMLElement).innerText?.trim() || '')
      .filter(t => t.length > 0);
  });
}

async function main() {
  console.log('[PHASE 24 v3 - SMART ACTION CONFIG]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(EDITOR_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    let bodyText = await page.locator('body').first().innerText().catch(() => '');

    // Check if we need to add action node
    if (!bodyText.includes('设置字段值')) {
      // Check if action node exists
      if (!bodyText.includes('目标表单')) {
        console.log('Adding "新增数据" action node...');
        await page.locator('.fx-automation-design-plus-icon').first().click({ force: true });
        await page.waitForTimeout(1500);
        await page.locator('[class*="popover"] button:has-text("新增数据")').first().click({ force: true });
        await page.waitForTimeout(3000);
        await waitForStableDOM(page);
      }

      // Select target form
      bodyText = await page.locator('body').first().innerText().catch(() => '');
      if (bodyText.includes('请选择表单')) {
        console.log('Selecting target form: 产品信息');
        await page.locator('.fx-automation-node-config-drawer .x-biz-dropdown-label').first().click({ force: true });
        await page.waitForTimeout(1500);
        await page.locator('[class*="popover"] .entry-item:has-text("产品信息")').first().click({ force: true });
        await page.waitForTimeout(2500);
        await waitForStableDOM(page);
      }
    }

    await page.screenshot({ path: 'screenshots/master24-v3-1-ready.png', fullPage: true });

    // ====== Map fields ======
    const placeholderSelector = '.fx-automation-node-config-drawer .placeholder:has-text("请选择字段")';
    let unmappedCount = await page.locator(placeholderSelector).count();
    console.log(`\nFields to map: ${unmappedCount}`);

    if (unmappedCount > 0) {
      // First, explore the trigger fields available by clicking the first placeholder
      console.log('\n--- Exploring trigger fields ---');
      await page.locator(placeholderSelector).first().click({ force: true });
      await page.waitForTimeout(1500);

      // Expand ALL tree nodes
      await expandAllTreeNodes(page);
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'screenshots/master24-v3-2-tree-expanded.png', fullPage: true });

      // Get all available leaf fields
      const allFields = await getLeafFields(page);
      console.log(`Available trigger fields (${allFields.length}):`);
      allFields.forEach(f => console.log(`  "${f}"`));

      if (allFields.length > 0) {
        // Map first placeholder to first available field
        console.log(`\nMapping: "${allFields[0]}" → first target`);
        await page.locator(`.tree-item-leaf:has-text("${allFields[0]}")`).first().click({ force: true });
        await page.waitForTimeout(300);
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Map remaining fields
      for (let i = 1; i < Math.min(unmappedCount, allFields.length); i++) {
        const ph = page.locator(placeholderSelector).nth(i);
        if (await ph.count() === 0) break;

        await ph.scrollIntoViewIfNeeded();
        await ph.click({ force: true });
        await page.waitForTimeout(1500);
        await expandAllTreeNodes(page);
        await page.waitForTimeout(300);

        const fieldName = allFields[i] || allFields[0];
        console.log(`Mapping field ${i}: "${fieldName}"`);

        const leaf = page.locator(`.tree-item-leaf:has-text("${fieldName}")`).first();
        if (await leaf.isVisible().catch(() => false)) {
          await leaf.click({ force: true });
        }
        await page.waitForTimeout(300);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }

    await page.screenshot({ path: 'screenshots/master24-v3-3-mapped.png', fullPage: true });

    // Verify mapping state
    bodyText = await page.locator('body').first().innerText().catch(() => '');
    unmappedCount = await page.locator(placeholderSelector).count();
    console.log(`\nAfter mapping - unmapped: ${unmappedCount}`);

    // ====== Save ======
    console.log('\n--- Saving ---');

    // Try save buttons in order of preference
    for (const btnText of ['保存并启用', '仅保存', '保存']) {
      const btn = page.locator(`button:has-text("${btnText}")`).first();
      if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
        await btn.click({ force: true });
        console.log(`✓ Clicked "${btnText}"`);
        await page.waitForTimeout(4000);
        await waitForStableDOM(page);
        break;
      }
    }

    await page.screenshot({ path: 'screenshots/master24-v3-4-saved.png', fullPage: true });

    // Final check
    bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log(`\nFinal state (first 800):\n${bodyText.substring(0, 800)}`);

    const errors = ['错误', '失败', '必填', '请选择'];
    const foundErrors = errors.filter(e => bodyText.includes(e));
    if (foundErrors.length > 0) {
      console.log(`\n⚠ Issues found: ${foundErrors.join(', ')}`);
    } else {
      console.log('\n✓ No issues detected');
    }

    console.log('\n✓ Phase 24 complete!');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
