/**
 * Navigate to app management → 聚合表 → delete "成品库存聚合" → then delete the last form.
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, navigateToApp, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[AGG] 删除聚合表，然后删除最后一个表单...');
  const wd = startWatchdog({ hardTimeoutMs: 240_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);
    await navigateToApp(page, '爱马仕');
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    // Try clicking "应用后台" or app management
    console.log('[AGG] 寻找应用后台入口...');

    // Look for backend/admin navigation
    const adminLinks = await page.$$eval('a, button, [class*="nav"] *, [class*="menu"] *', els =>
      els.filter(el => {
        const text = (el.textContent?.trim() || '');
        return /应用后台|管理|聚合|设置|backend|admin/i.test(text) && text.length < 20;
      }).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim(),
        href: (el as HTMLAnchorElement).href || '',
        class: (el as HTMLElement).className?.substring(0, 100),
      }))
    );
    console.log('[AGG] 管理入口:');
    adminLinks.forEach(l => console.log(`  <${l.tag}> "${l.text}" href="${l.href}" class="${l.class}"`));

    // Try to find the app management button and click it
    const appAdminBtn = page.locator('text=应用后台').first();
    if (await appAdminBtn.count() > 0) {
      await appAdminBtn.click({ force: true });
      console.log('[AGG] 点击"应用后台"');
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);
    }

    console.log(`[AGG] 当前URL: ${page.url()}`);
    await page.screenshot({ path: 'screenshots/app-backend.png', fullPage: true });

    // Look for 聚合表 menu item in the sidebar
    const sidebarItems = await page.$$eval('[class*="nav"] *, [class*="menu"] *, [class*="sidebar"] *, [class*="side"] *', els =>
      els.filter(el => {
        const text = (el.textContent?.trim() || '');
        return text.length > 0 && text.length < 30 && el.children.length === 0;
      }).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim(),
      }))
    );
    const unique = sidebarItems.filter((item, i, arr) =>
      arr.findIndex(t => t.text === item.text) === i
    ).slice(0, 40);
    console.log('[AGG] 侧边栏菜单项:');
    unique.forEach(item => console.log(`  "${item.text}"`));

    // Try to find and click 聚合表
    const aggTableLink = page.locator('a:has-text("聚合表"), [class*="nav"]:has-text("聚合表"), li:has-text("聚合表"), span:has-text("聚合表")').first();
    if (await aggTableLink.count() > 0) {
      await aggTableLink.click({ force: true });
      console.log('[AGG] 点击"聚合表"');
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);
    }

    console.log(`[AGG] 当前URL: ${page.url()}`);
    await page.screenshot({ path: 'screenshots/agg-table-list.png', fullPage: true });

    // Read page content to understand what we see
    const pageText = await page.locator('body').first().innerText().catch(() => '');
    console.log(`[AGG] 页面内容:\n${pageText.substring(0, 1000)}`);

    // Look for "成品库存聚合"
    const aggTableEntry = page.locator('[class*="item"]:has-text("成品库存聚合"), [class*="row"]:has-text("成品库存聚合"), tr:has-text("成品库存聚合")').first();
    if (await aggTableEntry.count() > 0) {
      console.log('[AGG] 找到"成品库存聚合"');

      // Hover to find delete button, or look for context menu
      await aggTableEntry.hover({ force: true });
      await page.waitForTimeout(600);

      // Look for delete/more buttons
      const moreBtns = await aggTableEntry.$$eval('button, [class*="more"], [class*="action"], [class*="operate"]', els =>
        els.map(el => ({ text: el.textContent?.trim(), class: (el as HTMLElement).className?.substring(0, 80) }))
      );
      console.log('[AGG] 操作按钮:', JSON.stringify(moreBtns));

      // Try right-click for context menu
      await aggTableEntry.click({ button: 'right' });
      await page.waitForTimeout(1000);

      await page.screenshot({ path: 'screenshots/agg-context-menu.png', fullPage: true });

      // Look for delete in context menu
      const deleteOpt = page.locator('li:has-text("删除"), [class*="menu"]:has-text("删除")').last();
      if (await deleteOpt.count() > 0 && await deleteOpt.isVisible().catch(() => false)) {
        await deleteOpt.click({ force: true });
        console.log('[AGG] 点击"删除"');
        await page.waitForTimeout(1500);

        // Handle delete confirmation
        const dialogText = await page.locator('[class*="alert"], [class*="dialog"], [class*="confirm"]').first().innerText().catch(() => '');
        console.log(`[AGG] 删除确认弹窗: "${dialogText?.substring(0, 300)}"`);

        // Type name if needed
        const input = page.locator('[class*="alert"] input, [class*="dialog"] input').first();
        if (await input.count() > 0 && await input.isVisible().catch(() => false)) {
          await input.click({ clickCount: 3, force: true });
          await input.fill('成品库存聚合');
          await page.waitForTimeout(300);
        }

        // Confirm delete
        const confirmDel = page.locator('button:has-text("删除"), button:has-text("确定")').last();
        if (await confirmDel.count() > 0 && await confirmDel.isVisible().catch(() => false)) {
          await confirmDel.click({ force: true });
          console.log('[AGG] 已确认删除聚合表');
          await page.waitForTimeout(2000);
        }
      }
    }

    // Now try to navigate back to forms and delete the last form
    console.log('\n[AGG] 返回表单列表...');
    await page.goto(`https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06/form/6a0d1b041da5270989e0908f`, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    const forms = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
    console.log(`[AGG] 剩余表单: ${forms.join(', ') || '(空)'}`);

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
