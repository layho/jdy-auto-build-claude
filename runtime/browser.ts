import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const SESSION_FILE = path.resolve('.temp/session.json');
// Session is valid for 7 days
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

/**
 * Launch browser, optionally restoring a saved session to skip login.
 */
export async function launchBrowser(): Promise<BrowserSession> {
  const headless = process.env.BROWSER_HEADLESS !== 'false';
  const browser = await chromium.launch({ headless });

  let context: BrowserContext;

  const restored = restoreSessionSync();
  if (restored) {
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'zh-CN',
      storageState: restored,
    });
    console.log('[BROWSER] 会话已恢复，跳过登录');
  } else {
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'zh-CN',
    });
    console.log('[BROWSER] 新会话');
  }

  const page = await context.newPage();
  return { browser, context, page };
}

/**
 * Save current browser session (cookies, localStorage) to disk.
 */
export async function saveSession(context: BrowserContext): Promise<void> {
  const dir = path.dirname(SESSION_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const state = await context.storageState();
  // Persist with timestamp so we can check expiry later
  const payload = { savedAt: Date.now(), state };
  fs.writeFileSync(SESSION_FILE, JSON.stringify(payload));
  console.log('[SESSION] 已保存会话');
}

/**
 * Delete saved session file.
 */
export function clearSession(): void {
  if (fs.existsSync(SESSION_FILE)) {
    fs.unlinkSync(SESSION_FILE);
    console.log('[SESSION] 已清除会话');
  }
}

function restoreSessionSync(): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(SESSION_FILE)) return null;
    const raw = fs.readFileSync(SESSION_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    // Support both old format (plain state) and new format (with savedAt)
    if (parsed.savedAt !== undefined) {
      if (Date.now() - parsed.savedAt > SESSION_MAX_AGE_MS) {
        console.log('[SESSION] 会话已过期，清除');
        fs.unlinkSync(SESSION_FILE);
        return null;
      }
      return parsed.state;
    }
    // Old format - return as-is
    return parsed;
  } catch {
    console.log('[SESSION] 会话文件损坏，清除');
    try { fs.unlinkSync(SESSION_FILE); } catch { /* ignore */ }
    return null;
  }
}

/**
 * Always call this in finally block to prevent memory leaks.
 */
export async function closeBrowser(session: BrowserSession): Promise<void> {
  // Save session before closing so next run can skip login
  await saveSession(session.context).catch(() => {});
  await session.page.close().catch(() => {});
  await session.context.close().catch(() => {});
  await session.browser.close().catch(() => {});
  console.log('[BROWSER] 已关闭');
}

/**
 * Login to 简道云 with credentials from .env.
 * Skips login if already authenticated (e.g. session restored).
 */
export async function login(page: Page): Promise<void> {
  const username = process.env.JDY_USERNAME;
  const password = process.env.JDY_PASSWORD;

  if (!username || !password) {
    throw new Error('[LOGIN] JDY_USERNAME or JDY_PASSWORD not set in .env');
  }

  // Navigate to workspace first to check if session is valid
  console.log('[LOGIN] 检查登录状态...');
  try {
    await page.goto('https://www.jiandaoyun.com/dashboard', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
  } catch {
    console.log('[LOGIN] networkidle timeout, continuing...');
  }

  await page.waitForTimeout(1000);
  const url = page.url();

  // If not on login page, session is valid — skip login
  if (!url.includes('/login') && !url.includes('/signin')) {
    console.log('[LOGIN] 会话有效，跳过登录');
    return;
  }

  console.log('[LOGIN] 需要重新登录...');

  const { smartLocate } = await import('./smartLocate');
  const { waitForStableDOM } = await import('./dom');
  const selectors = await import('../selectors/form.json');

  await waitForStableDOM(page);

  const usernameInput = await smartLocate(page, selectors.default.login.username_input);
  await usernameInput.fill(username);

  const passwordInput = await smartLocate(page, selectors.default.login.password_input);
  await passwordInput.fill(password);

  const loginBtn = await smartLocate(page, selectors.default.login.login_button);
  await loginBtn.click();

  // Wait for navigation away from login page instead of just DOM stability
  await page.waitForURL((url) => !url.includes('/login') && !url.includes('/signin'), {
    timeout: 30000,
  }).catch(async () => {
    // Fallback: check for error message
    const errorEl = page.locator('[data-testid="login-error"], .error-message, .login-error');
    if ((await errorEl.count()) > 0) {
      const msg = await errorEl.first().textContent();
      throw new Error(`[LOGIN] 登录失败: ${msg}`);
    }
    console.log('[LOGIN] waitForURL timeout, continuing...');
  });

  await waitForStableDOM(page);
  console.log('[LOGIN] 登录完成');
}

/**
 * Navigate to the target app on the dashboard.
 */
export async function navigateToApp(page: Page, appName: string): Promise<void> {
  const { smartLocate } = await import('./smartLocate');
  const { waitForStableDOM } = await import('./dom');

  const currentUrl = page.url();
  console.log(`[NAV] 当前URL: ${currentUrl}`);

  // If not on dashboard, navigate there first
  if (!currentUrl.includes('/dashboard') || currentUrl.includes('/login')) {
    console.log('[NAV] 导航到仪表盘...');
    try {
      await page.goto('https://www.jiandaoyun.com/dashboard', {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
    } catch {
      console.log('[NAV] dashboard networkidle timeout, continuing...');
    }
  }

  await waitForStableDOM(page);
  await page.waitForTimeout(1000);

  const appLink = await smartLocate(page, [
    `.fx-app-item:has-text('${appName}') a.app-visit-area`,
    `a:has-text('${appName}')`,
  ]);
  await appLink.click();
  console.log(`[NAV] 已进入应用: ${appName}`);

  await waitForStableDOM(page);
  console.log(`[NAV] URL: ${page.url()}`);
}

/**
 * Check if the page is already logged in (not on login page).
 */
export function isLoggedIn(page: Page): boolean {
  const url = page.url();
  return !url.includes('/login') && !url.includes('/xiongzhan') && url.includes('jiandaoyun.com');
}
