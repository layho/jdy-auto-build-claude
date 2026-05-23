/**
 * 修复详情视图中子表"没有显示字段"的问题
 * 在字段属性中配置查看/编辑模式下的显示字段
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

async function main() {
  console.log('[FIX DETAIL DISPLAY]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 进入编辑器 ======
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    const entry = page.locator('.tree-node').filter({ hasText: '订单管理' }).first();
    await entry.hover({ force: true });
    await page.waitForTimeout(600);
    await entry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);
    console.log('✓ 已进入编辑器');

    // ====== 点击订单明细字段 ======
    const orderDetailField = page.locator('.fx-field-layout.field').filter({ hasText: '订单明细' }).first();
    await orderDetailField.click({ force: true });
    console.log('✓ 已点击订单明细字段');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'screenshots/fixdetail-1-property.png', fullPage: true });

    // ====== 分析属性面板 ======
    const panelState = await page.evaluate(() => {
      const panel = document.querySelector('[class*="property-panel"], [class*="props-panel"], [class*="field-property"], [class*="widget-setting"]');
      if (!panel) return { error: 'no property panel found' };

      // Find all config sections
      const sections = [...panel.querySelectorAll('[class*="section"], [class*="group"], [class*="config"], [class*="item"]')];

      // Find tabs (field settings / form settings)
      const tabs = [...panel.querySelectorAll('[class*="tab"], [role="tab"]')];

      // Find all buttons, checkboxes, inputs
      const interactives = [...panel.querySelectorAll('button, input[type="checkbox"], [class*="switch"], [class*="radio"]')];

      return {
        panelClass: (panel as HTMLElement).className?.substring(0, 200),
        panelText: (panel as HTMLElement).innerText?.trim()?.substring(0, 3000),
        tabCount: tabs.length,
        tabs: tabs.map(t => ({
          text: (t as HTMLElement).innerText?.trim(),
          class: (t as HTMLElement).className?.substring(0, 100),
          selected: (t as HTMLElement).classList.contains('active') || (t as HTMLElement).getAttribute('aria-selected') === 'true',
        })),
        sectionCount: sections.length,
        sections: sections.slice(0, 20).map(s => ({
          text: (s as HTMLElement).innerText?.trim()?.substring(0, 200),
          class: (s as HTMLElement).className?.substring(0, 100),
        })),
        interactives: interactives.map(el => ({
          tag: el.tagName,
          type: (el as HTMLInputElement).type || '',
          text: (el as HTMLElement).innerText?.trim()?.substring(0, 100),
          class: (el as HTMLElement).className?.substring(0, 100),
          checked: (el as HTMLInputElement).checked,
        })),
      };
    });

    console.log(`属性面板分析:`);
    console.log(`  Tabs: ${(panelState.tabs || []).map(t => `${t.text}(${t.selected ? 'active' : ''})`).join(', ')}`);
    console.log(`  Sections: ${panelState.sectionCount}`);
    console.log(`  Panel text:\n${panelState.panelText}`);
    console.log(`  Full state:\n${JSON.stringify(panelState, null, 2).substring(0, 5000)}`);

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
