// Probe: per-user preferences (theme + language persist DB) — WIP completion.
// Flow: login admin → đọc theme client → toggle theme → chờ debounce 500ms →
// reload page → theme phải KHÔI PHỤC từ DB (không từ localStorage) → language
// chain → 0 pageerror. Chạy: node tests/user-prefs-probe.mjs
import { chromium } from 'playwright';

const BASE = 'https://localhost:3000';
const results = [];
let page;

function ok(name) {
  results.push({ name, pass: true });
  console.log(`  PASS ${name}`);
}
function fail(name, msg) {
  results.push({ name, pass: false, msg: String(msg).slice(0, 300) });
  console.log(`  FAIL ${name} — ${msg}`);
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
  // Login OK → goto('/') (không phải /admin trực tiếp)
  await page.waitForURL(BASE + '/', { timeout: 20000 });
  await page.goto(BASE + '/admin', { waitUntil: 'networkidle' });
  await settle(500);
}

// 1. Theme trước khi toggle (mặc định light hoặc system → attr trên <html>)
async function readThemeAttr() {
  return await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
}

// 2. Bấm theme toggle ở /ui/theme (data-test="theme-toggle" wrapper + button)
async function toggleTheme() {
  const btn = page.locator('[data-test="theme-toggle"] button').first();
  await btn.waitFor({ state: 'visible', timeout: 8000 });
  await btn.click();
}

async function main() {
  console.log('=== user-prefs probe (theme + language persist DB) ===');
  const browser = await chromium.launch({
    args: ['--ignore-certificate-errors'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  });
  page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  try {
    // ── Login ──
    try {
      await login();
      ok('login → /admin');
    } catch (e) {
      fail('login → /admin', e.message);
      return;
    }

    // NOTE: ThemeToggle chỉ có ở demo page /ui/theme (app chrome không có nút).
    // /ui ngoài (authorized) → vào /admin trước để applyUserPrefsFromLayout
    // đăng ký theme-persist sink, rồi client-side goto /ui/theme (không reload
    // → đăng ký sink còn nguyên trên cùng JS runtime).

    // ── UP1: applyUserPrefsFromLayout chạy, không crash ──
    const themeBefore = await readThemeAttr();
    if (['light', 'dark', 'system', null].includes(themeBefore)) {
      ok(`UP1 theme attr ban đầu = ${themeBefore ?? '(none)'} (layout load, 0 crash)`);
    } else {
      fail('UP1 theme attr ban đầu', `attr = ${themeBefore}`);
    }

    // ── UP2: toggle theme (từ /ui/theme — client-side nav, sink còn đăng ký)
    // → attr đổi + debounce 500ms → POST update ──
    let requestSeen = null;
    const onReq = (req) => {
      if (req.url().includes('/api/admin/user-preferences/update')) requestSeen = req;
    };
    page.on('request', onReq);
    try {
      // Client-side nav (không reload — giữ JS runtime + sink đăng ký):
      // inject <a href="/ui/theme"> có text để visible rồi click.
      await page.evaluate(() => {
        const a = document.createElement('a');
        a.href = '/ui/theme';
        a.id = 'probe-nav-link';
        a.textContent = 'probe-nav';
        document.body.appendChild(a);
      });
      await page.locator('#probe-nav-link').click({ force: true });
      await page.waitForURL('**/ui/theme', { timeout: 8000 });
      await settle(300);
      await toggleTheme();
      await settle(400); // chờ transition + debounce 500ms
      const themeAfterToggle = await readThemeAttr();
      if (themeAfterToggle !== themeBefore) {
        ok(`UP2a theme attr sau toggle = ${themeAfterToggle} (khác ${themeBefore})`);
      } else {
        fail('UP2a theme attr sau toggle', `không đổi (${themeAfterToggle})`);
      }
      await settle(600); // tổng ~1s ≥ debounce 500ms
      if (requestSeen) {
        ok('UP2b POST /api/admin/user-preferences/update đã gửi (debounce)');
      } else {
        fail('UP2b POST update', 'không thấy request nào trong 1s sau toggle');
      }
    } catch (e) {
      fail('UP2 toggle + POST', e.message);
    } finally {
      page.off('request', onReq);
    }

    // ── UP3: reload → theme giữ nguyên TỪ DB. Về /admin (authorized layout
    //    chạy lại applyUserPrefsFromLayout), XÓA localStorage trước reload →
    //    nếu theme vẫn đúng → chắc chắn prefs.theme từ DB thắng. ──
    try {
      await page.goto(BASE + '/admin', { waitUntil: 'networkidle' });
      await page.evaluate(() => localStorage.removeItem('theme'));
      await page.reload({ waitUntil: 'networkidle' });
      await settle(600);
      const themeReload = await readThemeAttr();
      const expected = themeBefore === 'dark' ? 'light' : 'dark';
      if (themeReload === expected) {
        ok(`UP3 theme sau reload (localStorage đã xóa) = ${themeReload} → từ DB ✓`);
      } else {
        fail('UP3 theme sau reload', `expected ${expected}, got ${themeReload}`);
      }
    } catch (e) {
      fail('UP3 reload', e.message);
    }

    // ── UP4: language chain — prefs.language ?? system.defaultLang ?? navigator
    //    (admin user prefs chỉ có theme → language fallback system default 'vi'
    //    → UI phải tiếng Việt dù navigator=en-US) ──
    try {
      const navLang = await page.evaluate(() => navigator.language);
      const brandText = await page.locator('[data-test="admin-nav-brands"]').innerText();
      if (brandText.includes('Thương hiệu')) {
        ok(`UP4a UI language = vi (nav label "Thương hiệu", navigator=${navLang})`);
      } else {
        fail('UP4a UI language', `label = "${brandText}"`);
      }
    } catch (e) {
      fail('UP4a UI language', e.message);
    }

    // ── UP5: server load trả prefs + system (layout data) ──
    try {
      const hasPrefs = await page.evaluate(() => {
        // (authorized)/+layout.svelte chỉ apply; data qua __sveltekit — không
        // thể đọc trực tiếp. Thay vào đó verify qua hiệu ứng: prefs đã load
        // khi userPrefs.loaded = true → theme attr được set ngay SSR.
        return document.documentElement.hasAttribute('data-theme');
      });
      if (hasPrefs) {
        ok('UP5 data-theme attr được set (SSR/client apply chain)');
      } else {
        fail('UP5 data-theme attr', 'không có attr');
      }
    } catch (e) {
      fail('UP5 data-theme attr', e.message);
    }

    // ── UP6: 0 pageerror toàn flow ──
    if (pageErrors.length === 0) {
      ok('UP6 0 pageerror toàn flow');
    } else {
      fail('UP6 0 pageerror', pageErrors.join(' | '));
    }
  } finally {
    const passed = results.filter((r) => r.pass).length;
    console.log(`\n=== KẾT QUẢ: ${passed}/${results.length} PASS ===`);
    for (const r of results.filter((r) => !r.pass)) {
      console.log(`  ✗ ${r.name}: ${r.msg}`);
    }
    await browser.close();
    process.exitCode = passed === results.length ? 0 : 1;
  }
}

function redirect() {} // placeholder chống typo — không dùng

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});

