# jdy-auto-build-claude

完全掌握简道云的使用 — 通过 Playwright + TypeScript E2E 自动化测试覆盖所有功能模块，记录交互模式和踩坑经验。

## 快速开始

```bash
git clone git@github.com:layho/jdy-auto-build-claude.git
cd jdy-auto-build-claude
npm install
```

创建 `.env`：

```env
JDY_USERNAME=your_email
JDY_PASSWORD=your_password
JDY_API_KEY=your_api_key
BROWSER_HEADLESS=false
```

运行脚本：

```bash
npx tsx workflows/<script>.ts
```

## 项目结构

```
.env                    # 凭据（不提交）
CLAUDE.md               # 项目指南（下一个 Claude 的入口）
README.md               # 本文件
docs/                   # 16 份简道云核心文档
memory/                 # 学习笔记（DOM 交互模式、E2E 测试模式）
  project_jiandaoyun_agent_learnings.md
runtime/                # 浏览器启动/登录/DOM稳定等待/看门狗
selectors/              # 登录页选择器配置
workflows/              # 各阶段自动化脚本
  master_phase*.ts      # 主线脚本
  diag_*.ts             # 诊断/探索脚本
screenshots/            # 运行截图
```

## 当前进度

### 已完成

- 表单创建与配置（字段添加、属性设置、发布）
- 关联数据 / 关联子表 / 选择数据
- 子表单完整 E2E（提交流程通过）
- 权限设置（表单权限组配置）
- 聚合表：清理垃圾表、创建"订单销量统计"（含 CodeMirror 公式编辑器）
- 智能助手 Pro：创建触发 + 添加动作节点 + 部分字段映射

### 进行中

- 智能助手动作节点字段映射完善
- 仪表盘创建

### 待完成

- 数据工厂完整数据流
- 流程表单端到端
- 前端事件配置

## 应用信息

- App ID: `6a0aa9d82c4789aa80588d06`
- 表单：客户信息、产品信息、订单管理（含子表订单明细表）
- 聚合表：订单销量统计
- 智能助手：自动同步订单数据（ID: `6a110c3d63fbb50f9e104db2`）

## 关键技术点

- **Vue 框架**：必须用 Playwright `click({ force: true })`，`evaluate` 和 `dispatchEvent` 无效
- **确认弹窗**：`.fx-nav-message` / `.message`，不是标准 `.dialog`
- **SPA 路由**：URL hash 模式（`#/app_aggregate`、`#/app_trigger`）
- **CodeMirror**：公式编辑需从树插入 token，不能直接输入文本
- **会话持久化**：`.temp/session.json` 避免重复登录
