# jdy-auto-build-claude

简道云自动化构建学习项目 — 通过 Playwright + TypeScript E2E 测试完全掌握简道云所有功能模块。

## 目标

完全掌握简道云的使用。通过实战 E2E 自动化测试覆盖所有功能模块，记录每个模块的交互模式、DOM 结构和踩坑经验。

## 运行

```bash
npx tsx workflows/<script>.ts
```

浏览器会话保存在 `.temp/session.json`，首次运行会登录，后续跳过。

## 项目结构

```
.env                    # JDY_USERNAME / JDY_PASSWORD
runtime/                # browser.ts(浏览器/登录), dom.ts(waitForStableDOM), watchdog.ts
selectors/form.json     # 登录页选择器
workflows/              # 各阶段的自动化脚本
  master_phase*.ts      # 主线脚本
  diag_*.ts             # 诊断/探索脚本
memory/                 # 学习笔记
  project_jiandaoyun_agent_learnings.md  # 完整的 DOM 交互模式和模块文档
screenshots/            # 运行截图
```

## 当前进度（2026-05-23）

### 已完成
- 表单创建与配置（字段添加、属性设置、发布）
- 关联数据 / 关联子表 / 选择数据 配置
- 子表单 E2E 测试（完整提交流程通过）
- 权限设置（表单权限组配置）
- 聚合表：清理 13 个垃圾表，创建"订单销量统计"（含 CodeMirror 公式编辑器交互）
- 智能助手 Pro：触发(表单触发:订单管理, 新增数据时) → 新增数据到产品信息，5字段完整映射

### 进行中
- Phase 25: 仪表盘创建（入口：应用顶部 tab 的"仪表盘"或从工作台创建）

### 待完成
- 数据工厂完整数据流
- 流程表单端到端
- 前端事件配置

## 关键 DOM 模式

- **点击事件**: 简道云使用 Vue 框架，基本UI操作需用 Playwright `click({ force: true })`。但 **Vue 组件的保存按钮** 需用 `evaluate(el.click())`，Playwright click 无法触发 Vue 事件处理器
- **确认弹窗**: `.fx-nav-message` / `.message` 组件，不是标准 `.dialog`
- **表单选择**: `.x-biz-dropdown-label` 点击 → popover `.entry-item` 选择
- **SPA 路由**: URL hash 模式，如 `#/app_aggregate`、`#/app_trigger`
- **CodeMirror**: 公式编辑需从树插入 token，不能直接输入文本
- **多选下拉提交**: `.x-select-multiple` 选中选项后需用 Escape 关闭下拉框才会提交变更到数据模型
- **保存按钮**: 需 `page.evaluate(() => { document.querySelectorAll('button')...click() })` 而非 Playwright click

## 应用信息

- App ID: `6a0aa9d82c4789aa80588d06`
- 表单: 客户信息, 产品信息, 订单管理(含子表订单明细表)
- 聚合表: 订单销量统计
- 智能助手: 自动同步订单数据 (automation ID: `6a110c3d63fbb50f9e104db2`)
