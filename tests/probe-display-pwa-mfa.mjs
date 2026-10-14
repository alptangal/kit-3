// Probe: PWA manifest + /display TV dashboard + passkey (WebAuthn) E2E.
// Chạy qua domain RP (192-168-2-30.sslip.io — trùng env webauthn_rp_id) với
// host-resolver-rules MAP về 127.0.0.1, vì WebAuthn yêu cầu RP ID là registrable
// domain suffix của origin hiện tại (localhost ≠ sslip.io →NotAllowedError).
// Flow:
//   A. PWA — GET /manifest.webmanifest (200 + JSON hợp lệ + icons 200 + sw 200).
//   B. /display — login → goto /display → 6 stat cards + 2 panels render, no pageerror;
//      ảnh 1920x1080 (poll hết Loading). PROBE_LONG_WAIT=1 → đợi 65s verify refresh 60s.
//   C. Passkey — CDP virtual authenticator:
//      1. /profile → click đăng ký → credential xuất hiện (E2E thật: VA ký challenge).
//      2. Logout → /login → click "Đăng nhập bằng Passkey" → session mới → vào /.
//      (Login passkey là verify E2E đầy đủ — không cần probe API riêng.)
// Chạy: node tests/probe-display-pwa-mfa.mjs
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const RP_HOST = '192-168-2-30.sslip.io'; // phải trùng env webauthn_rp_id
const BASE = `https://${RP_HOST}:3000`;
const ENABLE_LONG_WAIT = process.env.PROBE_LONG_WAIT === '1';
const results = [];
let page;

function ok(name, extra) {
  results.push({ name, pass: true });
  console.log(`  PASS ${name}${extra ? ' — ' + extra : ''}`);
}
function fail(name, msg) {
  results.push({ name, pass: false, msg: String(msg).slice(0, 300) });
  console.log(`  FAIL ${name} — ${msg}`);
}
function summary() {
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n=== ${passed}/${results.length} PASS ===`);
  process.exit(results.length - passed);
}

async function settle(ms) {
  await page.waitForTimeout(ms);
}

async function login() {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  const inputs = page.locator('.auth-input-wrapper input');
  await inputs.first().fill('admin');
  await inputs.nth(1).fill('123123_Qwe');
  await page.locator('button[type="submit"], button:not([type])').first().click();
  await page.waitForURL(BASE + '/', { timeout: 30000 });
  await settle(500);
}

async function main() {
  console.log('=== probe display + pwa + mfa (RP domain) ===');
  const browser = await chromium.launch({
    args: [
      '--ignore-certificate-errors',
      `--host-resolver-rules=MAP ${RP_HOST} 127.0.0.1`,
    ],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
  });
  page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  // ── A. PWA manifest ──
  // Fetch qua page.evaluate (browser context) — page.request API không đi qua
  // host-resolver-rules của Chromium → EACCES với sslip.io trên máy dev.
  console.log('\n[A] PWA');
  async function fetchInPage(path) {
    return await page.evaluate(
      async ({ base, p }) => {
        const res = await fetch(base + p, { cache: 'no-store' });
        let body = null;
        try {
          body = await res.json();
        } catch {
          body = null; // asset binary/HTML — chỉ cần status
        }
        return { status: res.status, body };
      },
      { base: BASE, p: path }
    );
  }
  try {
    const { status, body } = await fetchInPage('/manifest.webmanifest');
    if (status !== 200) {
      fail('A1 manifest 200', `status=${status}`);
    } else {
      const okName = body.name === 'PhuongDoMega' && body.short_name === 'PhuongDoMega';
      const okIcons = Array.isArray(body.icons) && body.icons.length >= 2;
      if (okName && okIcons && body.display === 'standalone' && body.start_url === '/') {
        ok('A1 manifest 200 + JSON hợp lệ (name/standalone/start_url/2+ icons)');
      } else {
        fail('A1 manifest shape', JSON.stringify(body).slice(0, 200));
      }
    }
  } catch (e) {
    fail('A1 manifest 200 + JSON', e.message);
  }
  for (const icon of ['/icons/icon-192.png', '/icons/icon-512.png']) {
    try {
      const { status } = await fetchInPage(icon);
      if (status === 200) ok(`A2 ${icon} 200`);
      else fail(`A2 ${icon}`, `status=${status}`);
    } catch (e) {
      fail(`A2 ${icon}`, e.message);
    }
  }
  for (const asset of ['/offline.html', '/sw.js']) {
    try {
      const { status } = await fetchInPage(asset);
      if (status === 200) ok(`A3 ${asset} 200`);
      else fail(`A3 ${asset}`, `status=${status}`);
    } catch (e) {
      fail(`A3 ${asset}`, e.message);
    }
  }

  // ── B. /display TV dashboard ──
  console.log('\n[B] /display');
  try {
    await login();
    ok('B1 login admin');
  } catch (e) {
    fail('B1 login admin', e.message);
    summary();
  }

  try {
    await page.goto(BASE + '/display', { waitUntil: 'domcontentloaded', timeout: 30000 });
    // API dashboard lần đầu compile + query có thể ~10-20s (memory: "/stats chậm")
    await page
      .locator('[data-test="display-stat-today-orders"]')
      .waitFor({ state: 'visible', timeout: 60000 });
    ok('B2 /display render stat card đầu tiên');
  } catch (e) {
    fail('B2 /display render', e.message);
  }

  const statTests = [
    'display-stat-today-orders',
    'display-stat-revenue',
    'display-stat-total-orders',
    'display-stat-pending-payments',
    'display-stat-low-stock',
    'display-stat-open-pos',
  ];
  let statOk = 0;
  for (const t of statTests) {
    const count = await page.locator(`[data-test="${t}"]`).count();
    if (count === 1) statOk++;
    else fail(`B3 ${t}`, `count=${count}`);
  }
  if (statOk === statTests.length) ok('B3 đủ 6/6 stat cards');
  for (const t of ['display-panel-pos', 'display-panel-lowstock']) {
    const count = await page.locator(`[data-test="${t}"]`).count();
    if (count === 1) ok(`B4 panel ${t}`);
    else fail(`B4 panel ${t}`, `count=${count}`);
  }

  try {
    const val = await page
      .locator('[data-test="display-stat-today-orders"] .stat-value')
      .textContent();
    if (val && val.trim().length > 0) ok(`B5 stat value = "${val.trim()}"`);
    else fail('B5 stat value', `textContent="${val}"`);
  } catch (e) {
    fail('B5 stat value', e.message);
  }

  const clock = await page.locator('[data-test="display-clock"]').count();
  if (clock === 1) ok('B6 display-clock hiển thị');
  else fail('B6 display-clock', `count=${clock}`);

  try {
    await page.waitForFunction(() => !document.querySelector('.display-loading'), {
      timeout: 10000,
    });
    await settle(800);
    await page.screenshot({ path: 'tests/_ui-shots/display-tv.png' });
    if (existsSync('tests/_ui-shots/display-tv.png')) ok('B7 ảnh display-tv.png 1920x1080');
    else fail('B7 ảnh display-tv.png', 'file không tồn tại sau screenshot');
  } catch (e) {
    fail('B7 ảnh display-tv.png', e.message);
  }

  if (ENABLE_LONG_WAIT) {
    try {
      const before = await page.locator('.display-updated').textContent();
      await settle(65000);
      const after = await page.locator('.display-updated').textContent();
      if (before !== after) ok('B8 refresh data 60s (updated-time đổi)');
      else fail('B8 refresh data 60s', `updated không đổi: "${before}"`);
    } catch (e) {
      fail('B8 refresh data 60s', e.message);
    }
  } else {
    console.log('  SKIP B8 (đặt PROBE_LONG_WAIT=1 để đợi 65s verify refresh 60s)');
  }

  // ── C. Passkey (WebAuthn) — CDP virtual authenticator ──
  console.log('\n[C] Passkey');
  try {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        attachment: 'platform',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });
    ok('C1 virtual authenticator (ctap2 platform, UV=true)');
  } catch (e) {
    fail('C1 virtual authenticator', e.message);
    summary();
  }

  try {
    await page.goto(BASE + '/profile', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('.passkey-section').first().waitFor({ state: 'visible', timeout: 15000 });
    // Chờ list load XONG: item hoặc empty-message render (section render trước
    // với empty state trong khi loadCredentials async — đếm sớm sẽ sai 0)
    await page
      .locator('.passkey-item, .passkey-empty')
      .first()
      .waitFor({ state: 'visible', timeout: 15000 });
    const listBefore = await page.locator('.passkey-item').count();
    ok(`C2 /profile passkey section hiện (credentials trước: ${listBefore})`);
  } catch (e) {
    fail('C2 /profile passkey section', e.message);
  }

  // Dọn credentials test cũ qua UI (AlertDialog confirm) — bắt buộc để C5 ổn định:
  // credential cũ trong DB không tồn tại trong VA context hiện tại → nếu dùng
  // username login, allowCredentials chứa id mà VA không có → browser chờ
  // hết 60s timeout → probe timeout. Discoverable cũng vậy khi VA nhiều credential.
  try {
    let guard = 0;
    let removed = 0;
    while ((await page.locator('.passkey-item').count()) > 0 && guard++ < 15) {
      // Nút "Xoá" (link error) là nút thứ 2 trong actions row
      await page.locator('.passkey-item .passkey-item-actions button').nth(1).click();
      // AlertDialog Action: KHÔNG có container class .alert-dialog — nút chính
      // mang data-ad-action (see alert-dialog/Action.svelte).
      // Dialog animate 200ms (--ad-duration) → click ngay = "not stable" →
      // settle 300ms trước click.
      const actBtn = page.locator('[data-ad-action]').last();
      await actBtn.waitFor({ state: 'visible', timeout: 8000 });
      await settle(300);
      await actBtn.click({ timeout: 8000 });
      await settle(1500);
      removed++;
    }
    ok(`C2.1 dọn ${removed} credential test cũ (DB sạch trước register)`);
  } catch (e) {
    fail('C2.1 dọn credentials cũ', e.message);
  }

  // Đăng ký passkey với virtual authenticator — credential DUY NHẤT trong VA.
  // Verify bằng count tăng đúng +1 (không đợi .passkey-item visible — item cũ
  // render trễ sẽ pass nhầm khi register chưa xong)
  try {
    const regBtn = page.locator('.passkey-register-btn');
    await regBtn.waitFor({ state: 'visible', timeout: 8000 });
    await regBtn.click();
    await page
      .locator('.passkey-item')
      .first()
      .waitFor({ state: 'visible', timeout: 30000 });
    const listAfter = await page.locator('.passkey-item').count();
    if (listAfter !== 1) {
      fail('C3 đăng ký passkey E2E', `sau register còn ${listAfter} credential (kỳ vọng 1 — register có thể chưa hoàn tất)`);
    } else {
      ok('C3 đăng ký passkey E2E — VA ký challenge thật (credentials sau: 1)');
    }
  } catch (e) {
    fail('C3 đăng ký passkey E2E', e.message);
  }

  // Đăng nhập bằng passkey: logout → /login → nút passkey → session mới
  try {
    // Logout qua UI không chắc có nút ở mọi layout — dùng cookie clear + goto
    await ctx.clearCookies();
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
    const passkeyBtn = page.locator('.auth-btn-passkey');
    await passkeyBtn.waitFor({ state: 'visible', timeout: 15000 });
    ok('C4 nút "Đăng nhập bằng Passkey" hiện trên login');
  } catch (e) {
    fail('C4 nút passkey hiện', e.message);
  }

  try {
    // Discoverable (KHÔNG username): VA đang giữ đúng 1 credential vừa register
    // → auto chọn nó → assertion → verify → session. Timeout 70s > options 60s.
    await page.locator('.auth-btn-passkey').click();
    await page.waitForURL(BASE + '/', { timeout: 70000 });
    // Xác nhận session sống: /profile load được (không bị đá về login)
    await page.goto(BASE + '/profile', { waitUntil: 'domcontentloaded' });
    await page.locator('.passkey-section').first().waitFor({ state: 'visible', timeout: 15000 });
    // Chờ list load xong rồi đếm (đếm sớm trả 0 — loadCredentials async)
    await page
      .locator('.passkey-item, .passkey-empty')
      .first()
      .waitFor({ state: 'visible', timeout: 15000 });
    const creds = await page.locator('.passkey-item').count();
    ok(`C5 đăng nhập bằng passkey E2E → session mới (credentials: ${creds})`);
  } catch (e) {
    // in alert text nếu có để debug
    const alertText = await page
      .locator('.auth-alert')
      .first()
      .textContent()
      .catch(() => '(không đọc được alert)');
    fail('C5 login passkey E2E', `${e.message} | alert="${String(alertText).trim().slice(0, 120)}"`);
  }

  // pageerror — cả 3 phần phải 0 lỗi runtime
  if (pageErrors.length === 0) ok('C6 0 pageerror toàn probe');
  else fail('C6 0 pageerror', pageErrors.join(' | ').slice(0, 300));

  await browser.close();
  summary();
}

main().catch((e) => {
  console.error('probe crash:', e);
  process.exit(99);
});
