/**
 * Set all dropdown options across all forms
 */
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const FORM_CONFIGS = [
  {
    id: '6a1160d5ecf402533ddb0862', name: '商品资料',
    fields: [
      { name: '商品分类', options: '手机\n笔记本\n家电' },
      { name: '单位', options: '件\n箱\n个' },
      { name: '状态', options: '启用\n停用' },
    ]
  },
  {
    id: '6a1160f47743a586fab06ce3', name: '客户资料',
    fields: [
      { name: '客户等级', options: 'VIP\nA级\nB级\nC级' },
      { name: '状态', options: '启用\n停用' },
    ]
  },
  {
    id: '6a11610f23a9b83c9dbfafbd', name: '供应商资料',
    fields: [
      { name: '结算方式', options: '月结30天\n月结60天\n现结' },
      { name: '状态', options: '启用\n停用' },
    ]
  },
  {
    id: '6a11616d0ae602c1e08008a9', name: '采购订单',
    fields: [
      { name: '状态', options: '待审批\n已审批\n已完成\n已取消' },
    ]
  },
  {
    id: '6a1161900ae602c1e0802318', name: '销售订单',
    fields: [
      { name: '状态', options: '待审批\n已审批\n已完成\n已取消' },
    ]
  },
  {
    id: '6a1173664242e8826b8feb0f', name: '采购入库单',
    fields: [
      { name: '仓库', options: '主仓库\n次仓库\n退货仓' },
      { name: '入库状态', options: '待入库\n已入库\n已取消' },
    ]
  },
  {
    id: '6a117380567db19ff271c15b', name: '销售出库单',
    fields: [
      { name: '仓库', options: '主仓库\n次仓库\n退货仓' },
      { name: '状态', options: '待出库\n已出库\n已取消' },
    ]
  },
];

async function setOptions(page: any, fieldName: string, options: string) {
  await page.locator(`.field-name:text-is("${fieldName}")`).first().click({ force: true });
  await page.waitForTimeout(800);

  const batchBtn = page.locator('button:has-text("批量编辑")').first();
  if (await batchBtn.count() > 0 && await batchBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await batchBtn.click({ force: true });
    await page.waitForTimeout(500);

    const textarea = page.locator('textarea').first();
    if (await textarea.count() > 0 && await textarea.isVisible({ timeout: 500 }).catch(() => false)) {
      await textarea.fill(options);
      await page.waitForTimeout(300);

      const confirmBtn = page.locator('button:has-text("确定")').first();
      if (await confirmBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await confirmBtn.click({ force: true });
        await page.waitForTimeout(300);
      }
    }
    return true;
  }
  return false;
}

async function main() {
  console.log('[SET ALL OPTIONS]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    for (const form of FORM_CONFIGS) {
      console.log(`\n[${form.name}]`);
      await page.goto(`https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/form/${form.id}/edit#/edit`, { waitUntil: 'domcontentloaded' });
      await waitForStableDOM(page); await page.waitForTimeout(3000);

      for (const field of form.fields) {
        const ok = await setOptions(page, field.name, field.options);
        console.log(`  ${field.name}: ${ok ? 'SET' : 'FAIL'}`);
      }

      // Save
      await page.evaluate(() => {
        for (const btn of document.querySelectorAll('button')) {
          if (btn.innerText?.trim() === '保存' && !(btn as HTMLButtonElement).disabled) (btn as HTMLButtonElement).click();
        }
      });
      await page.waitForTimeout(3000); await waitForStableDOM(page);
      console.log('  Saved');
    }

    await page.screenshot({ path: 'screenshots/erp-all-options-set.png', fullPage: true });
    console.log('\n[DONE] All options configured');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
