/**
 * 最终端到端测试 V5：
 * 关键修复：
 * 1. 数据选择对话框点击行自动关闭（不需要Enter）
 * 2. 子表在表单下方需要滚动
 * 3. 子表"添加"按钮需要在子表区域内查找
 * 4. 每个对话框操作后等待关闭再继续
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

async function readPage(page: Page): Promise<string> {
  return await page.locator('body').first().innerText().catch(() => '') || '';
}

async function waitForDialogClose(page: Page, timeoutMs = 5000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const visible = await page.locator('.fx-lookup-dialog').first().isVisible().catch(() => false);
    if (!visible) return true;
    await page.waitForTimeout(300);
  }
  return false;
}

async function selectFromLookup(page: Page, rowText: string): Promise<boolean> {
  // 等待对话框出现
  await page.waitForTimeout(1500);
  const dialog = page.locator('.fx-lookup-dialog').first();
  const dialogVisible = await dialog.isVisible().catch(() => false);
  if (!dialogVisible) {
    console.log(`  ⚠ 对话框未打开`);
    return false;
  }

  // 在对话框tbody中找包含指定文本的行
  const row = dialog.locator('tbody tr').filter({ hasText: rowText }).first();
  if (await row.count() > 0) {
    console.log(`  点击行: ${rowText}`);
    await row.click({ force: true });
    // 等待对话框关闭
    const closed = await waitForDialogClose(page, 3000);
    console.log(`  对话框关闭: ${closed ? '✓' : '✗ (尝试Escape)'}`);
    if (!closed) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }
    return closed;
  } else {
    console.log(`  ⚠ 未找到行: ${rowText}`);
    return false;
  }
}

async function main() {
  console.log('[FINAL E2E V5]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. 进入并切换视图 ======
    console.log('====== 1. 打开录入表单 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    let text = await readPage(page);
    console.log(`当前视图: ${text.includes('仅添加数据') ? '仅添加数据' : text.includes('管理全部数据') ? '管理全部数据' : '未知'}`);

    if (text.includes('仅添加数据')) {
      await page.locator('text=仅添加数据').first().click({ force: true });
      await page.waitForTimeout(1000);
      const manageAll = page.locator('[class*="option"]:has-text("管理全部数据")').first();
      if (await manageAll.count() > 0) await manageAll.click({ force: true });
      await page.waitForTimeout(2000);
      await waitForStableDOM(page);
      console.log('✓ 已切换到管理全部数据');
    }

    // 点击"添加"打开表单
    const addBtn = page.locator('button:has-text("添加")').first();
    if (await addBtn.count() > 0 && await addBtn.isVisible().catch(() => false)) {
      await addBtn.click({ force: true });
      console.log('✓ 已点击添加');
    }
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    text = await readPage(page);
    console.log(`表单已打开: ${text.includes('关联客户') && text.includes('提交') ? '✓' : '⚠'}`);
    await page.screenshot({ path: 'screenshots/e2ev5-1-form-open.png', fullPage: true });

    // ====== 2. 填订单编号 ======
    console.log('\n====== 2. 填写订单编号 ======');
    // 找表单中的输入框（排除搜索框）
    const allInputs = page.locator('input.input-inner:not([readonly])');
    const allCount = await allInputs.count();
    const formInputs: any[] = [];
    for (let i = 0; i < allCount; i++) {
      const inp = allInputs.nth(i);
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      if (!ph || !ph.includes('搜索')) {
        formInputs.push(inp);
      }
    }
    console.log(`表单输入框: ${formInputs.length}个`);

    if (formInputs.length >= 1) {
      await formInputs[0].fill('ORD-20260523-005');
      console.log('✓ 订单编号: ORD-20260523-005');
    }

    // ====== 3. 关联客户（选择张三）======
    console.log('\n====== 3. 关联客户 ======');
    const assocBtn = page.locator('button:has-text("关联数据")').first();
    if (await assocBtn.count() > 0 && await assocBtn.isVisible().catch(() => false)) {
      await assocBtn.click({ force: true });
      console.log('✓ 已点击关联数据');
    }

    await selectFromLookup(page, '张三');
    await page.waitForTimeout(1000);

    text = await readPage(page);
    const hasCustomer = text.includes('张三');
    console.log(`关联客户结果: ${hasCustomer ? '✓ 张三已关联' : '⚠'}`);

    // ====== 4. 选择产品（选择智能手机）======
    console.log('\n====== 4. 选择产品 ======');
    const chooseBtn = page.locator('button:has-text("选择数据")').first();
    if (await chooseBtn.count() > 0 && await chooseBtn.isVisible().catch(() => false)) {
      await chooseBtn.click({ force: true });
      console.log('✓ 已点击选择数据');
    }

    await selectFromLookup(page, '智能手机');
    await page.waitForTimeout(1000);

    text = await readPage(page);
    const hasProduct = text.includes('智能手机');
    console.log(`选择产品结果: ${hasProduct ? '✓ 智能手机已选择' : '⚠'}`);

    await page.screenshot({ path: 'screenshots/e2ev5-2-selections-done.png', fullPage: true });

    // ====== 5. 填写子表 ======
    console.log('\n====== 5. 填写子表 ======');

    // 尝试在表单中滚动找到子表
    // 查找所有可能的表单容器
    const formContainers = await page.evaluate(() => {
      const containers: any[] = [];
      // 查找各种表单容器
      for (const sel of ['.x-dialog', '[class*="drawer"]', '[class*="slide"]', '[class*="form-wrap"]', '[class*="form-body"]']) {
        const els = [...document.querySelectorAll(sel)];
        for (const el of els) {
          if ((el as HTMLElement).offsetHeight > 200) {
            containers.push({
              selector: sel,
              class: (el as HTMLElement).className?.substring(0, 200),
              scrollHeight: el.scrollHeight,
              clientHeight: el.clientHeight,
              scrollTop: el.scrollTop,
              hasOrderDetail: (el as HTMLElement).innerText?.includes('订单明细'),
              hasSubmit: (el as HTMLElement).innerText?.includes('提交'),
            });
          }
        }
      }
      return containers;
    });

    console.log(`表单容器: ${JSON.stringify(formContainers, null, 2)}`);

    // 尝试在body中找到"订单明细"
    const orderDetailInPage = await page.evaluate(() => {
      // 搜索所有可见元素中文本包含"订单明细"的
      const allEls = [...document.querySelectorAll('*')];
      const matches = allEls
        .filter(el => {
          const txt = (el.textContent || '').trim();
          return txt === '订单明细' && (el as HTMLElement).offsetHeight > 0 && (el as HTMLElement).offsetHeight < 80;
        })
        .map(el => ({
          tag: el.tagName,
          class: (el as HTMLElement).className?.substring(0, 150),
          rect: JSON.stringify(el.getBoundingClientRect()),
          parentClass: el.parentElement?.className?.substring(0, 150),
        }));

      // Also search for subtable container elements
      const subtableContainers = [...document.querySelectorAll('[class*="subtable"], [class*="sub-table"], [class*="related-form"], [class*="child-table"]')]
        .filter(el => (el as HTMLElement).offsetHeight > 0)
        .map(el => ({
          tag: el.tagName,
          class: (el as HTMLElement).className?.substring(0, 200),
          rect: JSON.stringify(el.getBoundingClientRect()),
          innerText: (el as HTMLElement).innerText?.substring(0, 200),
        }));

      return { exactMatches: matches, subtableContainers };
    });

    console.log(`订单明细匹配:\n${JSON.stringify(orderDetailInPage, null, 2)}`);

    // 找所有"添加"按钮
    const addBtnInfo = await page.evaluate(() => {
      const allAdds = [...document.querySelectorAll('button')]
        .filter(b => (b.textContent || '').trim() === '添加' && (b as HTMLElement).offsetHeight > 0);
      return allAdds.map(b => ({
        text: b.textContent?.trim(),
        class: b.className?.substring(0, 120),
        rect: JSON.stringify(b.getBoundingClientRect()),
        // Get context: what's the nearby parent text
        nearbyText: b.closest('div, section, [class*="form"]')?.textContent?.trim()?.substring(0, 80),
      }));
    });
    console.log(`所有"添加"按钮: ${JSON.stringify(addBtnInfo, null, 2)}`);

    // 尝试滚动body到底部再截图
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/e2ev5-3-scrolled-bottom.png', fullPage: true });

    text = await readPage(page);
    console.log(`\n页面底部内容:\n${text.substring(text.length - 1500)}`);

    // ====== 6. 点击子表添加按钮 ======
    console.log('\n====== 6. 尝试点击子表添加 ======');

    // 策略: 在"订单明细"附近的"添加"按钮
    let subAddClicked = false;

    // 方法1: 使用page.evaluate找到子表区域的添加按钮
    const subAddBtnInfo = await page.evaluate(() => {
      // 先找"订单明细"的元素
      const allEls = [...document.querySelectorAll('*')];
      const orderDetailEl = allEls.find(el => {
        const txt = (el.textContent || '').trim();
        return txt === '订单明细' && (el as HTMLElement).offsetHeight > 0 && (el as HTMLElement).offsetHeight < 80;
      });

      if (!orderDetailEl) return { error: 'no 订单明细 element' };

      // 向上找到包含子表和添加按钮的容器
      let container = orderDetailEl.parentElement;
      for (let i = 0; i < 10 && container; i++) {
        const buttons = [...container.querySelectorAll('button')]
          .filter(b => (b.textContent || '').trim() === '添加');
        if (buttons.length > 0) {
          return {
            containerTag: container.tagName,
            containerClass: container.className?.substring(0, 200),
            containerRect: JSON.stringify(container.getBoundingClientRect()),
            addButtons: buttons.map(b => ({
              class: b.className?.substring(0, 120),
              rect: JSON.stringify(b.getBoundingClientRect()),
            })),
          };
        }
        container = container.parentElement;
      }
      return { error: 'no add button in ancestors', containerTag: container?.tagName };
    });

    console.log(`子表添加按钮信息: ${JSON.stringify(subAddBtnInfo, null, 2)}`);

    // 方法2: 直接用类名找子表内的添加按钮
    if (subAddBtnInfo.addButtons && subAddBtnInfo.addButtons.length > 0) {
      // 用Playwright点击子表中最可见的"添加"
      const subtAdds = page.locator('button:has-text("添加")');
      const saCount = await subtAdds.count();
      // 遍历找在子表区域内的
      for (let i = 0; i < saCount; i++) {
        const btn = subtAdds.nth(i);
        const rect = await btn.boundingBox().catch(() => null);
        if (rect && rect.y > 300) { // 下方区域的按钮
          console.log(`  点击[${i}] y=${rect.y}`);
          await btn.click({ force: true });
          subAddClicked = true;
          await page.waitForTimeout(2000);
          break;
        }
      }
    }

    if (!subAddClicked) {
      // Fallback: 点击最后一个"添加"
      const allAdds = page.locator('button:has-text("添加")');
      const count = await allAdds.count();
      for (let i = count - 1; i >= 0; i--) {
        const btn = allAdds.nth(i);
        const vis = await btn.isVisible().catch(() => false);
        if (vis) {
          console.log(`  fallback点击[${i}]`);
          await btn.click({ force: true });
          subAddClicked = true;
          await page.waitForTimeout(2000);
          break;
        }
      }
    }

    text = await readPage(page);
    console.log(`子表添加后:\n${text.substring(text.length - 1000)}`);

    if (subAddClicked) {
      // 找新增的子表行输入框
      const allEditable = page.locator('input.input-inner:not([readonly])');
      const aeiCount = await allEditable.count();
      const emptyInputs: any[] = [];
      for (let i = 0; i < aeiCount; i++) {
        const inp = allEditable.nth(i);
        const val = await inp.inputValue().catch(() => '');
        const ph = await inp.getAttribute('placeholder').catch(() => '');
        if (!val && (!ph || !ph.includes('搜索'))) {
          emptyInputs.push(inp);
        }
      }
      console.log(`空输入框: ${emptyInputs.length}个`);

      const fillData = ['智能手机', '2', '2999', '5998'];
      for (let i = 0; i < Math.min(emptyInputs.length, fillData.length); i++) {
        await emptyInputs[i].fill(fillData[i]);
        console.log(`  ✓ [${i}] = ${fillData[i]}`);
      }

      // 确认子表行
      const confirmBtn = page.locator('button:has-text("确定")').last();
      if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click({ force: true });
        console.log('✓ 子表行已确认');
        await page.waitForTimeout(1000);
      }
    }

    await page.screenshot({ path: 'screenshots/e2ev5-4-subtable-filled.png', fullPage: true });

    // ====== 7. 提交 ======
    console.log('\n====== 7. 提交 ======');
    const submitBtn = page.locator('button:has-text("提交")').first();
    if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click({ force: true });
      console.log('✓ 已点击提交');
      await page.waitForTimeout(3000);
    }

    text = await readPage(page);
    console.log(`\n提交结果:\n${text.substring(0, 800)}`);
    const success = text.includes('成功');
    console.log(`状态: ${success ? '✓ 成功' : '⚠ 待确认'}`);

    await page.screenshot({ path: 'screenshots/e2ev5-5-result.png', fullPage: true });
    console.log('\n====== E2E V5 完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
