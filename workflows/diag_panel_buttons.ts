/**
 * 专门诊断面板的按钮和交互方式
 * 重点：在面板打开后，找到所有可能的确认按钮
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
  console.log('[DIAG PANEL BUTTONS]\n');
  const wd = startWatchdog({ hardTimeoutMs: 180_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 进入录入表单 ======
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // 切换到管理全部数据
    let text = await page.locator('body').first().innerText().catch(() => '');
    if (text.includes('仅添加数据')) {
      await page.locator('text=仅添加数据').first().click({ force: true });
      await page.waitForTimeout(1000);
      const manageAll = page.locator('[class*="option"]:has-text("管理全部数据")').first();
      if (await manageAll.count() > 0) await manageAll.click({ force: true });
      await page.waitForTimeout(2000);
    }

    // 点击"添加"
    const addBtn = page.locator('button:has-text("添加")').first();
    if (await addBtn.count() > 0) await addBtn.click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // ====== 打开关联数据面板 ======
    console.log('打开关联面板...');
    const assocBtn = page.locator('button:has-text("关联数据")').first();
    await assocBtn.click({ force: true });
    await page.waitForTimeout(3000);

    // 详细分析面板中的所有按钮和交互元素
    const panelDetails = await page.evaluate(() => {
      // 查找所有可见的包含"选择数据"或"确定"或"取消"的元素
      const results: any[] = [];

      // 方法1: 通过文本找"选择数据"面板区域
      const allDivs = [...document.querySelectorAll('div, section, aside')];
      const panelDiv = allDivs.find(el => {
        const txt = el.textContent || '';
        return txt.includes('选择数据') && txt.includes('数据标题') && (el as HTMLElement).offsetWidth > 200;
      });

      if (panelDiv) {
        results.push({
          type: 'panel_container',
          class: (panelDiv as HTMLElement).className?.substring(0, 200),
          innerHTML: panelDiv.innerHTML?.substring(0, 3000),
        });

        // 面板内所有按钮
        const buttons = [...panelDiv.querySelectorAll('button')];
        results.push({
          type: 'panel_buttons',
          buttons: buttons.map(b => ({
            text: b.textContent?.trim(),
            class: b.className?.substring(0, 100),
            rect: JSON.stringify(b.getBoundingClientRect()),
            visible: (b as HTMLElement).offsetHeight > 0,
          })),
        });

        // 面板footer
        const footer = panelDiv.querySelector('[class*="footer"]');
        if (footer) {
          results.push({
            type: 'panel_footer',
            html: footer.outerHTML?.substring(0, 1000),
          });
        }
      }

      // 方法2: 查找所有固定的/绝对定位的包含按钮的元素
      const fixedElements = [...document.querySelectorAll('[style*="position"]')]
        .filter(el => {
          const style = window.getComputedStyle(el);
          return (style.position === 'fixed' || style.position === 'absolute') &&
            (el as HTMLElement).offsetWidth > 200;
        });

      results.push({
        type: 'fixed_elements',
        count: fixedElements.length,
        elements: fixedElements.map(el => ({
          class: (el as HTMLElement).className?.substring(0, 200),
          html: el.outerHTML?.substring(0, 500),
          rect: JSON.stringify(el.getBoundingClientRect()),
        })).slice(0, 5),
      });

      // 方法3: 直接在body下查找高z-index的元素
      const bodyChildren = [...document.body.children];
      const highZElements = bodyChildren.filter(el => {
        const style = window.getComputedStyle(el);
        const zIndex = parseInt(style.zIndex);
        return zIndex > 100 && (el as HTMLElement).offsetWidth > 200;
      });

      results.push({
        type: 'high_zindex',
        count: highZElements.length,
        elements: highZElements.map(el => ({
          tag: el.tagName,
          class: (el as HTMLElement).className?.substring(0, 200),
          text: (el.textContent || '').trim().substring(0, 200),
          buttons: [...el.querySelectorAll('button')].map(b => ({
            text: b.textContent?.trim(),
            class: b.className?.substring(0, 80),
          })),
        })),
      });

      return results;
    });

    console.log(JSON.stringify(panelDetails, null, 2));

    await page.screenshot({ path: 'screenshots/diag-panel-buttons.png', fullPage: true });

    // ====== 也检查子表区域的"添加"按钮 ======
    console.log('\n====== 检查子表区域 ======');
    text = await page.locator('body').first().innerText().catch(() => '');

    // 找"订单明细"文本附近的HTML
    const subTableInfo = await page.evaluate(() => {
      const allEls = [...document.querySelectorAll('*')];
      const subTitle = allEls.find(el => {
        const txt = (el.textContent || '').trim();
        return txt === '订单明细' && (el as HTMLElement).offsetHeight > 0 && (el as HTMLElement).offsetHeight < 50;
      });

      if (!subTitle) return { error: 'no 订单明细 element found' };

      const parent = subTitle.parentElement;
      const grandparent = parent?.parentElement;

      return {
        titleTag: subTitle.tagName,
        titleClass: (subTitle as HTMLElement).className?.substring(0, 200),
        parentTag: parent?.tagName,
        parentClass: parent?.className?.substring(0, 200),
        parentHTML: parent?.outerHTML?.substring(0, 1000),
        grandparentTag: grandparent?.tagName,
        grandparentClass: grandparent?.className?.substring(0, 200),
        grandparentHTML: grandparent?.outerHTML?.substring(0, 2000),
        // 找grandparent中的所有按钮
        buttons: [...(grandparent?.querySelectorAll('button') || [])].map(b => ({
          text: b.textContent?.trim(),
          class: b.className?.substring(0, 100),
        })),
      };
    });

    console.log(JSON.stringify(subTableInfo, null, 2));

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
