// 移动端 Web 端到端 UI 验证（Playwright + Edge，headless，坐标驱动）
// 前提：flutter run -d web-server --web-port 4200 --release；后端 5180 已启动
// 运行：node mobile-ui-check.mjs [baseUrl] [outDir]
//   依赖 playwright-core：npm i playwright-core；或用环境变量 DUBHE_PLAYWRIGHT 指向其 index.mjs
//   测试账号口令通过 DUBHE_TEST_PASSWORD / DUBHE_ADMIN_PASSWORD 传入（见《测试账号文档.md》）
import { fileURLToPath } from 'node:url';
const playwrightEntry = process.env.DUBHE_PLAYWRIGHT ?? 'playwright-core';
const { chromium } = await import(playwrightEntry);

const BASE = process.argv[2] ?? 'http://localhost:4200';
const OUT_DIR = process.argv[3] ?? fileURLToPath(new URL('./shots', import.meta.url));
const TEST_PASSWORD = process.env.DUBHE_TEST_PASSWORD ?? '';
const ADMIN_PASSWORD = process.env.DUBHE_ADMIN_PASSWORD ?? '';
function requirePassword(value, name) {
  if (!value) {
    console.error(`[ui] 缺少环境变量 ${name}，无法登录测试账号`);
    process.exit(1);
  }
  return value;
}

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200));
});
page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 200)));

const log = (...a) => console.log('[ui]', ...a);
const fs = await import('node:fs');
const results = [];
function persist() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    `${OUT_DIR}/report.json`,
    JSON.stringify({ results, consoleErrors }, null, 2),
    'utf8',
  );
  const passed = results.filter((r) => r.ok).length;
  fs.writeFileSync(
    `${OUT_DIR}/progress.txt`,
    `进度 ${passed}/${results.length}\n` +
      results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.name}`).join('\n'),
    'utf8',
  );
}
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  persist();
  log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function enableSemanticsIfNeeded() {
  for (let attempt = 0; attempt < 6; attempt++) {
    const hostLen = await page.evaluate(() => {
      const h = document.querySelector('flt-semantics-host');
      if (h && h.innerHTML.length > 200) return h.innerHTML.length;
      const el = document.querySelector('flt-semantics-placeholder');
      if (el) {
        ['pointerdown', 'pointerup', 'click'].forEach((t) =>
          el.dispatchEvent(
            new PointerEvent(t, { bubbles: true, cancelable: true }),
          ),
        );
        el.click();
        return -1;
      }
      return 0;
    });
    if (hostLen > 200) return;
    await page.waitForTimeout(600);
  }
}

async function tap(x, y, settle = 700) {
  await page.mouse.click(x, y);
  await page.waitForTimeout(settle);
}

async function shot(name) {
  await page.screenshot({ path: `${OUT_DIR}/${name}.png` });
}

async function bodyText() {
  return (await page.locator('body').innerText().catch(() => '')) ?? '';
}

async function gotoRoute(route, settle = 2600) {
  await page.evaluate((r) => {
    location.hash = `#${r}`;
  }, route);
  await page.waitForTimeout(settle);
  await enableSemanticsIfNeeded();
}

async function login(account, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4200);
  await enableSemanticsIfNeeded();
  await tap(195, 276, 500); // 账号
  await page.keyboard.type(account, { delay: 18 });
  await tap(195, 338, 500); // 密码
  await page.keyboard.type(password, { delay: 18 });
  await tap(195, 405, 3200); // 登录按钮
}

async function logoutByStorage() {
  await page.evaluate(() => window.localStorage.clear());
}

// ============ 1. 登录页 ============
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4200);
await enableSemanticsIfNeeded();
await shot('01-login');
let text = await bodyText();
const dbg = await page.evaluate(() => ({
  hostLen: document.querySelector('flt-semantics-host')?.innerHTML.length ?? -1,
  bodyChildren: document.body.children.length,
  bodyTextViaJs: (document.body.innerText || '').slice(0, 60),
}));
results.push({ name: 'DEBUG', ok: true, detail: JSON.stringify(dbg) });
check('登录页渲染', text.includes('注册账号') && text.includes('服务器地址'), text.replace(/\n/g, ' | ').slice(0, 70));

// ============ 2. 客户登录 ============
await login('test_customer', requirePassword(TEST_PASSWORD, 'DUBHE_TEST_PASSWORD'));
await page.waitForTimeout(1500);
text = await bodyText();
await shot('02-customer-home');
check('客户登录进入首页', text.includes('快速下单') || text.includes('最近订单'), text.replace(/\n/g, ' | ').slice(0, 90));

// ============ 3. 底部导航：订单 ============
await enableSemanticsIfNeeded();
await tap(146, 812, 2000);
text = await bodyText();
await shot('03-customer-orders');
check('订单列表', text.includes('我的订单'), text.replace(/\n/g, ' | ').slice(0, 90));

// ============ 4. 消息 ============
await tap(244, 812, 1800);
text = await bodyText();
await shot('04-customer-notifications');
check('消息通知页', text.includes('消息通知') || text.includes('全部已读'), text.replace(/\n/g, ' | ').slice(0, 90));

// ============ 5. 我的 ============
await tap(341, 812, 1800);
text = await bodyText();
await shot('05-customer-profile');
check('个人中心', text.includes('退出登录') || text.includes('服务器地址'), text.replace(/\n/g, ' | ').slice(0, 90));

// ============ 6. 下单页（三步） ============
await gotoRoute('/orders/create', 3200);
text = await bodyText();
await shot('06-order-create');
check('三步下单页', text.includes('寄收地址') || text.includes('运营商家'), text.replace(/\n/g, ' | ').slice(0, 90));

// ============ 7. 订单详情（取列表首单） ============
await gotoRoute('/orders', 2600);
const orderHref = await page.evaluate(() => {
  const evt = document.querySelectorAll('flt-semantics[role="button"]');
  return evt.length;
});
log('订单列表可交互节点数:', orderHref);
await tap(195, 300, 2200); // 点击列表第一张卡片
text = await bodyText();
await shot('07-order-detail');
check('订单详情', text.includes('订单详情') || text.includes('费用明细') || text.includes('寄收信息'), text.replace(/\n/g, ' | ').slice(0, 90));

// ============ 8. 客户工单 ============
await gotoRoute('/tickets', 2600);
text = await bodyText();
await shot('08-customer-tickets');
check('客服工单列表', text.includes('客服工单'), text.replace(/\n/g, ' | ').slice(0, 90));

// ============ 9. 帮助中心 ============
await gotoRoute('/help', 2600);
text = await bodyText();
await shot('09-help');
check('帮助中心', text.includes('帮助中心') || text.includes('搜索帮助文章'), text.replace(/\n/g, ' | ').slice(0, 90));

// ============ 10. 机长登录 ============
await logoutByStorage();
await login('test_pilot', requirePassword(TEST_PASSWORD, 'DUBHE_TEST_PASSWORD'));
await page.waitForTimeout(3000);
await enableSemanticsIfNeeded();
await page.waitForTimeout(1200);
text = await bodyText();
await shot('10-pilot-workbench');
check('机长工作台', text.includes('故障上报') && text.includes('送达'), text.replace(/\n/g, ' | ').slice(0, 100));

// ============ 11. 飞行监控 ============
await tap(146, 812, 3200);
text = await bodyText();
await shot('11-pilot-monitoring');
check('飞行监控页', text.includes('飞行监控') || text.includes('执行任务') || text.includes('飞行仪表'), text.replace(/\n/g, ' | ').slice(0, 100));

// ============ 12. 记录（飞行/故障） ============
await tap(244, 812, 2600);
text = await bodyText();
await shot('12-pilot-records');
check('记录页', text.includes('我的记录') && text.includes('累计完成架次'), text.replace(/\n/g, ' | ').slice(0, 100));

// ============ 13. 故障上报 ============
await gotoRoute('/faults/new', 2800);
text = await bodyText();
await shot('13-fault-report');
check('故障上报页', text.includes('故障上报') || text.includes('故障信息'), text.replace(/\n/g, ' | ').slice(0, 100));

// ============ 14. 应急告警 ============
await gotoRoute('/alerts', 2800);
text = await bodyText();
await shot('14-alerts');
check('应急告警列表', text.includes('应急告警'), text.replace(/\n/g, ' | ').slice(0, 100));

// ============ 15. 告警上报页 ============
await gotoRoute('/alerts/new', 2600);
text = await bodyText();
await shot('15-alert-create');
check('告警上报页', text.includes('上报应急告警') && text.includes('提交告警'), text.replace(/\n/g, ' | ').slice(0, 100));

// ============ 16. 运维：工作台 / 设备 / 场站 / 维保 / 故障 ============
await logoutByStorage();
await login('test_ops', requirePassword(TEST_PASSWORD, 'DUBHE_TEST_PASSWORD'));
await page.waitForTimeout(3000);
await enableSemanticsIfNeeded();
text = await bodyText();
await shot('16-ops-workbench');
check('运维工作台', text.includes('运维工作台') || text.includes('设备列表'), text.replace(/\n/g, ' | ').slice(0, 100));

await gotoRoute('/ops/drones', 3000);
text = await bodyText();
await shot('17-ops-drones');
check('设备列表', text.includes('设备列表') || text.includes('TEST-'), text.replace(/\n/g, ' | ').slice(0, 100));

await gotoRoute('/ops/stations', 3000);
text = await bodyText();
await shot('18-ops-stations');
check('场站管理', text.includes('场站管理') || text.includes('暂无场站'), text.replace(/\n/g, ' | ').slice(0, 100));

// 场站详情（点击列表首项）→ 预约列表（数组接口）
await tap(195, 220, 3200);
text = await bodyText();
await shot('18b-station-detail');
check(
  '场站详情与预约',
  text.includes('场站详情') && (text.includes('预约记录') || text.includes('暂无预约')),
  text.replace(/\n/g, ' | ').slice(0, 100),
);

await gotoRoute('/ops/maintenance', 3000);
text = await bodyText();
await shot('19-ops-maintenance');
check('维保管理', text.includes('维保') && (text.includes('到期') || text.includes('暂无维保')), text.replace(/\n/g, ' | ').slice(0, 100));

// 切换到「维保记录」Tab（数组接口）
await tap(292, 80, 2200);
text = await bodyText();
await shot('19b-maintenance-records');
check(
  '维保记录 Tab',
  text.includes('例行维保') || text.includes('故障维修') || text.includes('暂无维保记录'),
  text.replace(/\n/g, ' | ').slice(0, 100),
);

await gotoRoute('/ops/faults', 3000);
text = await bodyText();
await shot('20-ops-faults');
check('故障处理', text.includes('故障处理') || text.includes('暂无故障'), text.replace(/\n/g, ' | ').slice(0, 100));

// ============ 17. 管理员：工作台 / 审批 / 告警 ============
await logoutByStorage();
await login('admin', requirePassword(ADMIN_PASSWORD, 'DUBHE_ADMIN_PASSWORD'));
await page.waitForTimeout(3000);
await enableSemanticsIfNeeded();
text = await bodyText();
await shot('21-admin-workbench');
check('管理员工作台', text.includes('管理驾驶舱') || text.includes('待审批计划'), text.replace(/\n/g, ' | ').slice(0, 100));

await gotoRoute('/admin/approvals', 3000);
text = await bodyText();
await shot('22-admin-approvals');
check('审批中心', text.includes('审批中心') && (text.includes('暂无待审批飞行计划') || text.includes('飞行计划')), text.replace(/\n/g, ' | ').slice(0, 100));

await gotoRoute('/alerts', 3000);
text = await bodyText();
await shot('23-admin-alerts');
check('管理员告警列表', text.includes('应急告警'), text.replace(/\n/g, ' | ').slice(0, 100));

// ============ 汇总 ============
const failed = results.filter((r) => !r.ok);
persist();
console.log(`report written: ${OUT_DIR}/progress.txt (${results.length - failed.length}/${results.length} passed)`);
if (consoleErrors.length) {
  console.log('console errors (first 5):');
  consoleErrors.slice(0, 5).forEach((e) => console.log('  ' + e.slice(0, 160)));
}
await Promise.race([
  browser.close().catch(() => {}),
  new Promise((resolve) => setTimeout(resolve, 5000)),
]);
process.exit(failed.length ? 1 : 0);
