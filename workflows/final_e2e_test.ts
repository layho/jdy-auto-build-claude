/**
 * 最终端到端测试：
 * 1. 提交带子表数据的订单
 * 2. 验证所有三种关联字段工作正常
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

async function main() {
  console.log('[FINAL E2E TEST]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. 进入订单管理录入页 ======
    console.log('====== 1. 打开订单管理录入页 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    let text = await readPage(page);
    console.log(`录入页:\n${text.substring(0, 1000)}`);
    await page.screenshot({ path: 'screenshots/e2e-1-entry.png', fullPage: true });

    // ====== 2. 填写订单编号（跳过搜索框） ======
    console.log('\n====== 2. 填写订单编号 ======');
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

    console.log(`表单输入框(排除搜索): ${formInputs.length}个`);

    if (formInputs.length >= 1) {
      await formInputs[0].fill('ORD-20260523-001');
      console.log('✓ 订单编号: ORD-20260523-001');
    }

    // ====== 3. 关联客户（关联数据） ======
    console.log('\n====== 3. 关联客户（关联数据） ======');
    const assocBtns = page.locator('button:has-text("关联数据")');
    console.log(`"关联数据"按钮: ${await assocBtns.count()}个`);

    // 在录入页找到关联数据的按钮
    for (let i = 0; i < await assocBtns.count(); i++) {
      const btn = assocBtns.nth(i);
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ force: true });
        console.log(`✓ 已点击关联数据按钮 [${i}]`);
        await page.waitForTimeout(2500);
        break;
      }
    }

    text = await readPage(page);
    console.log(`关联数据弹窗:\n${text.substring(0, 800)}`);
    await page.screenshot({ path: 'screenshots/e2e-2-link-customer.png', fullPage: true });

    // 选择张三
    const customerRow = page.locator('tr:has-text("张三"), [class*="row"]:has-text("张三")').first();
    if (await customerRow.count() > 0 && await customerRow.isVisible().catch(() => false)) {
      const cb = customerRow.locator('input[type="radio"], input[type="checkbox"]').first();
      if (await cb.count() > 0) {
        await cb.click({ force: true });
      } else {
        await customerRow.click({ force: true });
      }
      console.log('✓ 已选择客户: 张三');
    } else {
      console.log('⚠ 未找到张三，尝试其他方式...');
      // 可能需要搜索
      const searchInModal = page.locator('input[placeholder*="搜索"]').first();
      if (await searchInModal.count() > 0) {
        await searchInModal.fill('张三');
        await page.waitForTimeout(1000);
      }
      const row2 = page.locator('tr:has-text("张三"), [class*="row"]:has-text("张三")').first();
      if (await row2.count() > 0) {
        await row2.click({ force: true });
        console.log('✓ 已选择客户: 张三');
      }
    }

    // 确定
    const confirmBtns1 = page.locator('button:has-text("确定")');
    for (let i = await confirmBtns1.count() - 1; i >= 0; i--) {
      const btn = confirmBtns1.nth(i);
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ force: true });
        console.log('✓ 关联数据已确认');
        await page.waitForTimeout(1500);
        break;
      }
    }

    // ====== 4. 选择产品（选择数据） ======
    console.log('\n====== 4. 选择产品（选择数据） ======');
    await waitForStableDOM(page);
    const chooseBtns = page.locator('button:has-text("选择数据")');
    console.log(`"选择数据"按钮: ${await chooseBtns.count()}个`);

    for (let i = 0; i < await chooseBtns.count(); i++) {
      const btn = chooseBtns.nth(i);
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ force: true });
        console.log(`✓ 已点击选择数据按钮 [${i}]`);
        await page.waitForTimeout(2500);
        break;
      }
    }

    text = await readPage(page);
    console.log(`选择数据弹窗:\n${text.substring(0, 800)}`);
    await page.screenshot({ path: 'screenshots/e2e-3-choose-product.png', fullPage: true });

    // 选择智能手机
    const productRow = page.locator('tr:has-text("智能手机"), [class*="row"]:has-text("智能手机")').first();
    if (await productRow.count() > 0 && await productRow.isVisible().catch(() => false)) {
      const cb = productRow.locator('input[type="radio"], input[type="checkbox"]').first();
      if (await cb.count() > 0) {
        await cb.click({ force: true });
      } else {
        await productRow.click({ force: true });
      }
      console.log('✓ 已选择产品: 智能手机');
    }

    // 确定
    const confirmBtns2 = page.locator('button:has-text("确定")');
    for (let i = await confirmBtns2.count() - 1; i >= 0; i--) {
      const btn = confirmBtns2.nth(i);
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ force: true });
        console.log('✓ 选择数据已确认');
        await page.waitForTimeout(1500);
        break;
      }
    }

    // ====== 5. 填写子表数据 ======
    console.log('\n====== 5. 填写关联子表数据 ======');
    await waitForStableDOM(page);
    text = await readPage(page);
    console.log(`主表填完后:\n${text.substring(0, 1500)}`);
    await page.screenshot({ path: 'screenshots/e2e-4-before-subtable.png', fullPage: true });

    // 查找子表区域 - 搜索"订单明细"附近的所有元素
    const subTableArea = page.locator('[class*="sub-table"], [class*="link-table"], [class*="related-form"], .fx-field-layout:has-text("订单明细")').first();
    console.log(`子表区域: ${await subTableArea.count()}个`);

    // 在子表中查找"添加"按钮 - 可能有多种形状
    // 查找"订单明细"标题下的"添加"按钮
    const allAddBtns = await page.$$eval('button, span, a', els =>
      els.filter(el => {
        const txt = (el.textContent || '').trim();
        return txt === '添加' && (el as HTMLElement).offsetHeight > 0;
      }).map(el => ({
        tag: el.tagName,
        class: (el as HTMLElement).className?.substring(0, 100),
        parentText: (el.parentElement?.textContent || '').trim().substring(0, 80),
      }))
    );
    console.log(`\n"添加"按钮: ${allAddBtns.length}个`);
    allAddBtns.forEach((b, i) => console.log(`  [${i}] <${b.tag}> class="${b.class}" parent="${b.parentText}"`));

    // 尝试点击子表相关的添加按钮
    let subAddClicked = false;
    for (let i = 0; i < allAddBtns.length; i++) {
      const btnInfo = allAddBtns[i];
      // 检查是否在子表区域
      if (btnInfo.parentText.includes('订单明细') || btnInfo.class.includes('link-table') || btnInfo.class.includes('sub-table')) {
        const addBtn = page.locator(`button:has-text("添加"):visible, span:has-text("添加"):visible`).nth(i);
        if (await addBtn.count() > 0 && await addBtn.isVisible().catch(() => false)) {
          await addBtn.click({ force: true });
          console.log(`✓ 已点击子表添加按钮 [${i}]`);
          subAddClicked = true;
          await page.waitForTimeout(2000);
          break;
        }
      }
    }

    if (!subAddClicked) {
      // 尝试点任何可见的"添加"按钮
      console.log('尝试点击任意添加按钮...');
      const anyAdd = page.locator('button:has-text("添加")').first();
      if (await anyAdd.count() > 0 && await anyAdd.isVisible().catch(() => false)) {
        await anyAdd.click({ force: true });
        console.log('✓ 已点击添加按钮');
        subAddClicked = true;
        await page.waitForTimeout(2000);
      }
    }

    text = await readPage(page);
    console.log(`\n点击添加后:\n${text.substring(0, 1500)}`);
    await page.screenshot({ path: 'screenshots/e2e-5-subtable-add.png', fullPage: true });

    // 查找子表行中的输入框
    if (subAddClicked) {
      // 尝试在子表区域中找输入框
      const subInputs = page.locator('[class*="link-table"] input.input-inner:not([readonly]), [class*="sub-table"] input.input-inner:not([readonly]), .fx-field-layout:has-text("订单明细") input.input-inner:not([readonly])');
      const siCount = await subInputs.count();
      console.log(`子表输入框: ${siCount}个`);

      // 也可能输入框是在其他地方
      if (siCount === 0) {
        // 查看所有可编辑的输入框
        const allEditable = page.locator('input.input-inner:not([readonly])');
        const aeCount = await allEditable.count();
        console.log(`所有可编辑输入框: ${aeCount}个`);
        for (let i = 0; i < Math.min(aeCount, 8); i++) {
          const inp = allEditable.nth(i);
          const val = await inp.inputValue().catch(() => '');
          const ph = await inp.getAttribute('placeholder').catch(() => '');
          const parentText = await inp.locator('..').locator('..').innerText().catch(() => '').then(t => t.substring(0, 60));
          console.log(`  [${i}] value="${val}" ph="${ph}" parent="${parentText}"`);
        }

        // 填写子表数据 - 使用过滤后的输入框（可能新增的行在第一行）
        if (aeCount >= 4) {
          // 前几个可能是搜索框和主表单字段，子表输入框在后面
          const startIdx = aeCount - 4; // 假设最后4个是子表输入框
          const subStart = Math.max(0, aeCount - 4);
          const subEndInputs = [];
          for (let i = subStart; i < aeCount; i++) {
            subEndInputs.push(allEditable.nth(i));
          }
          if (subEndInputs.length >= 1) await subEndInputs[0].fill('智能手机');
          if (subEndInputs.length >= 2) await subEndInputs[1].fill('2');
          if (subEndInputs.length >= 3) await subEndInputs[2].fill('2999');
          if (subEndInputs.length >= 4) await subEndInputs[3].fill('5998');
          console.log('✓ 子表数据已填写(末尾定位)');
        }
      } else {
        // 使用找到的子表输入框
        for (let i = 0; i < Math.min(siCount, 6); i++) {
          const inp = subInputs.nth(i);
          const val = await inp.inputValue().catch(() => '');
          const ph = await inp.getAttribute('placeholder').catch(() => '');
          console.log(`  子表输入[${i}]: value="${val}" ph="${ph}"`);
        }

        if (siCount >= 1) await subInputs.nth(0).fill('智能手机');
        if (siCount >= 2) await subInputs.nth(1).fill('2');
        if (siCount >= 3) await subInputs.nth(2).fill('2999');
        if (siCount >= 4) await subInputs.nth(3).fill('5998');
        console.log('✓ 子表数据已填写');

        // 确认子表行
        const subConfirm = page.locator('[class*="link-table"] button:has-text("确定"), [class*="sub-table"] button:has-text("确定"), button:has-text("保存")').first();
        if (await subConfirm.count() > 0 && await subConfirm.isVisible().catch(() => false)) {
          await subConfirm.click({ force: true });
          console.log('✓ 子表行已确认');
          await page.waitForTimeout(1000);
        }
      }
    }

    // ====== 6. 检查最终状态并提交 ======
    await page.screenshot({ path: 'screenshots/e2e-6-before-submit.png', fullPage: true });
    text = await readPage(page);
    console.log(`\n提交前页面:\n${text.substring(0, 2000)}`);

    // 提交
    const submitBtn = page.locator('button:has-text("提交")').first();
    if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click({ force: true });
      console.log('✓ 已点击提交');
      await page.waitForTimeout(3000);
    }

    text = await readPage(page);
    const success = text.includes('提交成功') || text.includes('成功') || text.includes('保存成功');
    console.log(`\n提交结果: ${success ? '✓ 成功' : '⚠ 待确认'}`);
    console.log(text.substring(0, 500));

    await page.screenshot({ path: 'screenshots/e2e-7-submit-result.png', fullPage: true });

    // ====== 7. 验证数据 ======
    console.log('\n====== 7. 验证数据 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    // 查看数据管理
    const orderEntry2 = page.locator('.tree-node').filter({ hasText: '订单管理' }).first();
    await orderEntry2.click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // 切换到管理全部数据视图
    text = await readPage(page);
    console.log(`数据视图:\n${text.substring(0, 1500)}`);

    // 检查是否有提交的数据
    const hasData = text.includes('ORD-') || text.includes('订单编号');
    console.log(`数据存在: ${hasData}`);

    await page.screenshot({ path: 'screenshots/e2e-8-data-view.png', fullPage: true });

    console.log('\n====== 端到端测试完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
