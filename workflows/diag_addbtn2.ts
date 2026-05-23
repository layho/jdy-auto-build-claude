/**
 * 诊断：点击 add-button 后，再点击"新建表单"
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

async function main() {
  console.log('[DIAG] 测试完整新建流程...\n');
  const wd = startWatchdog({ hardTimeoutMs: 180_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    console.log(`[DIAG] 初始URL: ${page.url()}`);

    // 1. 点击 add-button
    console.log('[DIAG] 步骤1: 点击 .add-button...');
    const addBtn = page.locator('.add-button').first();
    await addBtn.click({ force: true });
    await page.waitForTimeout(1000);

    console.log(`[DIAG] 点击后URL: ${page.url()}`);

    // 2. 查找"新建表单"元素
    console.log('[DIAG] 步骤2: 查找"新建表单"...');
    const newFormEls = page.locator('text=新建表单');
    const count = await newFormEls.count();
    console.log(`[DIAG] "新建表单" 匹配数: ${count}`);

    for (let i = 0; i < count; i++) {
      const el = newFormEls.nth(i);
      const tag = await el.evaluate(el => el.tagName).catch(() => '?');
      const visible = await el.isVisible().catch(() => false);
      const text = await el.innerText().catch(() => '');
      console.log(`  [${i}] <${tag}> visible=${visible} text="${text}"`);
    }

    // 3. 尝试点击"新建表单"
    const newFormBtn = page.locator('text=新建表单').first();
    if (await newFormBtn.count() > 0) {
      console.log('[DIAG] 步骤3: 点击"新建表单"...');
      await newFormBtn.click({ force: true });
      await page.waitForTimeout(1000);

      console.log(`[DIAG] 点击后URL: ${page.url()}`);

      // 读取弹窗内容
      const dialogText = await page.locator('[class*="dialog"], [class*="popup"], [class*="create"]').first().innerText().catch(() => '');
      console.log(`[DIAG] 弹窗内容: "${dialogText?.substring(0, 500)}"`);

      // 4. 点击"创建空白表单"
      const blankItem = page.locator('.create-item.create-empty').first();
      const blankCount = await blankItem.count();
      console.log(`[DIAG] .create-item.create-empty count=${blankCount}`);

      if (blankCount > 0) {
        console.log('[DIAG] 步骤4: 点击"创建空白表单"...');
        await blankItem.waitFor({ state: 'visible', timeout: 5000 });
        await blankItem.click();
        await page.waitForTimeout(3000);

        console.log(`[DIAG] 最终URL: ${page.url()}`);
        await page.screenshot({ path: 'screenshots/diag-after-create.png', fullPage: true });
      }
    }

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
