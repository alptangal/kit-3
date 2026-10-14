// Probe: POS terminal /admin/pos E2E (API + UI).
// Flow:
//   1. Login admin → goto /admin/pos → sidebar link + session badge render.
//   2. Lấy branchId qua API branches; lấy tồn kho trước qua inventory stock list.
//   3. Search 'variant' qua UI → click kết quả đầu → giỏ có 1 line, total đúng giá.
//   4. Numpad: bật → bấm phím số xây 500000 → tiền thừa = 500000 − total.
//   5. Xác nhận → API checkout chạy → modal kết quả hiện orderCode + tiền thừa.
//   6. Verify DB: tồn kho sau giảm đúng số lượng; order + payment tồn tại;
//      session totals tăng (nếu session mở) hoặc bán không gắn ca.
// Chạy: node tests/probe-pos-terminal.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

// ── Kết nối Couchbase trực tiếp (chỉ dùng để seed inventory_stock ban đầu) ──
const env = {};
for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*['"]?([^'"]*?)['"]?\s*$/);
  if (m) env[m[1]] = m[2].trim();
}
const CB_CLUSTER = env.cb_clusterId;
const CB_AUTH = `Basic ${Buffer.from(`${env.cb_username}:${env.cb_password}`).toString('base64')}`;
const CB_BUCKET = env.cb_bucketName;
const CB_SCOPE = env.cb_scopeName;

async function cbQuery(statement) {
  const r = await fetch(
    `https://${CB_CLUSTER}.data.cloud.couchbase.com/_p/query/query/service`,
    {
      method: 'POST',
      headers: { authorization: CB_AUTH, 'content-type': 'application/json' },
      body: JSON.stringify({ statement })
    }
  );
  return r.json().catch(() => ({}));
}

async function seedStockDoc(variantId, branchId, qty) {
  const key = `stock_${variantId}_${branchId}`;
  const now = new Date().toISOString();
  const doc = JSON.stringify({
    variantId,
    branchId,
    quantityOnHand: qty,
    quantityReserved: 0,
    createdAt: now,
    updatedAt: now
  });
  await cbQuery(
    `UPSERT INTO \`${CB_BUCKET}\`.\`${CB_SCOPE}\`.inventory_stock (KEY, VALUE) VALUES ('${key}', ${doc})`
  );
  return key;
}

const BASE = 'https://localhost:3000';
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

async function api(url, body) {
  return await page.evaluate(
    async ({ u, b }) => {
      const enc = await import('/src/lib/modules/encryption.ts');
      return await enc.encryption.fetchSecure(u, { method: 'POST', body: b });
    },
    { u: url, b: body ?? {} }
  );
}

async function login() {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  const inputs = page.locator('.auth-input-wrapper input');
  await inputs.first().fill('admin');
  await inputs.nth(1).fill('123123_Qwe');
  await page.locator('button[type="submit"], button:not([type])').first().click();
  await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 60000 });
  await settle(500);
}

async function main() {
  console.log('=== probe POS terminal /admin/pos ===');
  const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true
  });
  page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  try {
    // ── 1. Login + goto /admin/pos ──
    await login();
    await page.goto(BASE + '/admin/pos', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-test="pos-search-input"]', { timeout: 30000 });
    await settle(800);
    ok('P1 trang /admin/pos mở, ô tìm kiếm hiện');

    const sidebarLink = page.locator('[data-test="admin-nav-pos-terminal"]');
    (await sidebarLink.count()) > 0
      ? ok('P2 sidebar link Bán hàng POS tồn tại')
      : fail('P2 sidebar link', 'không thấy admin-nav-pos-terminal');

    // ── 2. Chuẩn bị dữ liệu: branch + tồn kho trước + tìm variant ──
    const branchesRes = await api('/api/admin/inventory/branches', {});
    const branches = (branchesRes.data ?? []).map((b) => ({ _id: b._id, name: b.name }));
    if (!branchesRes.ok || branches.length === 0) {
      fail('P3 lấy chi nhánh', 'API branches không trả chi nhánh nào');
    } else {
      ok('P3 lấy chi nhánh', `${branches[0]._id}`);
    }
    const branchId = branches[0]?._id;

    // Lấy variant đầu từ API để biết keyword search cụ thể (SKU), rồi mới gõ vào UI
    const searchApi = await api('/api/admin/pos/search', { search: 'IMP', limit: 20 });
    const items = searchApi.data?.items ?? [];
    if (!searchApi.ok || items.length === 0) {
      fail('P5 API search', 'API search không trả item nào');
      throw new Error('không có variant để test');
    }
    const variant = items[0];
    const variantId = variant._id;
    const variantPrice = Number(variant.price ?? 0);
    const searchKeyword = String(variant.sku ?? 'IMP');
    ok('P5 API search', `items=${items.length}, đầu: ${variant.sku ?? variantId} giá ${variantPrice}`);

    // Search variant qua UI bằng SKU của variant đã chọn
    await page.fill('[data-test="pos-search-input"]', searchKeyword);
    await settle(1200); // debounce 300 + fetch
    const resultRows = page.locator('[data-test="pos-result-row"]');
    let firstRowInfo = null;
    try {
      await resultRows.first().waitFor({ timeout: 10000 });
      firstRowInfo = {
        name: (await resultRows.first().locator('.pos-result-name').innerText()).trim(),
        meta: (await resultRows.first().locator('.pos-result-meta').innerText()).trim()
      };
      ok(
        'P4 search UI trả kết quả',
        `keyword="${searchKeyword}" — ${firstRowInfo.name} / ${firstRowInfo.meta}`
      );
    } catch {
      fail('P4 search UI', `không có kết quả sau khi gõ "${searchKeyword}"`);
    }

    // Tồn kho TRƯỚC — /stock/get trả data = stock trực tiếp (không bọc .stock)
    // Probe tiêu thụ 5 đơn mỗi lần chạy (P15 UI + P19 session + P21-23 method)
    // → nếu tồn < 5 thì UPSERT đè về 10 để idempotent giữa các lần chạy.
    const stockGet = await api('/api/admin/inventory/stock/get', { variantId, branchId });
    let stockBefore = Number(stockGet.data?.quantityOnHand ?? -1);
    if (!stockGet.ok) {
      fail('P6 tồn kho trước', 'API stock/get fail');
    } else if (stockBefore < 5) {
      await seedStockDoc(variantId, branchId, 10);
      await settle(1000);
      // Đọc lại qua chính API get (checkpoint chắc chắn)
      for (let i = 0; i < 5; i++) {
        const re = await api('/api/admin/inventory/stock/get', { variantId, branchId });
        stockBefore = Number(re.data?.quantityOnHand ?? -1);
        if (stockBefore >= 5) break;
        await settle(1000);
      }
      if (stockBefore >= 5) {
        ok('P6 seed tồn kho (UPSERT doc → 10)', `quantityOnHand=${stockBefore}`);
      } else {
        fail('P6 seed tồn kho', 'UPSERT xong nhưng stock/get vẫn không thấy doc');
        throw new Error('không thể seed tồn kho');
      }
    } else {
      ok('P6 tồn kho trước', `quantityOnHand=${stockBefore}`);
    }

    // Session hiện tại (mở ca nhanh nếu chưa có)
    const cur = await api('/api/admin/pos/sessions/current', { deviceId: 'pos-terminal' });
    let sessionId = cur.ok ? (cur.data?.session?._id ?? cur.data?._id) : undefined;
    let sessionBefore = null;
    if (sessionId) {
      sessionBefore = cur.data?.session ?? cur.data;
      ok('P7 session POS đang mở', `totalSales=${sessionBefore?.totalSales ?? 0}`);
    } else {
      const open = await api('/api/admin/pos/sessions/open', {
        deviceId: 'pos-terminal',
        openingBalance: 0
      });
      if (open.ok) {
        sessionId = open.data?._id ?? open.data?.session?._id;
        ok('P7 mở ca nhanh', `sessionId=${String(sessionId).slice(0, 22)}…`);
      } else {
        fail('P7 mở ca nhanh', JSON.stringify(open.message).slice(0, 200));
      }
    }

    // ── 3. Thêm giỏ qua UI ──
    await resultRows.first().click();
    await settle(400);
    const cartLines = page.locator('[data-test="pos-cart-line"]');
    (await cartLines.count()) === 1
      ? ok('P8 thêm vào giỏ', '1 line')
      : fail('P8 thêm vào giỏ', `cart lines = ${await cartLines.count()}`);
    const cartTotalText = (await page.locator('[data-test="pos-cart-total"]').innerText()).trim();
    const cartTotalNum = Number(cartTotalText.replace(/[^\d]/g, ''));
    cartTotalNum === variantPrice
      ? ok('P9 tổng giỏ đúng giá variant', `${cartTotalText} == ${variantPrice}`)
      : fail('P9 tổng giỏ', `${cartTotalText} != ${variantPrice}`);

    // ── 4. Mở modal thanh toán + numpad ──
    await page.click('[data-test="pos-checkout-btn"]');
    await page.waitForSelector('[data-test="pos-payment-method"]', { timeout: 10000 });
    ok('P10 modal thanh toán mở');

    await page.selectOption('[data-test="pos-payment-method"]', 'cash');
    ok('P11 chọn Tiền mặt');

    await page.click('[data-test="pos-toggle-numpad"]');
    await settle(600);
    const kbKeys = page.locator('.keyboard-number-root .button-root');
    const kbCount = await kbKeys.count();
    kbCount >= 16
      ? ok('P12 Keyboard.Number render', `${kbCount} phím`)
      : fail('P12 Keyboard.Number render', `chỉ ${kbCount} phím`);

    // Bấm 5 0 0 0 0 0 = 500000 (numpad dispatch CustomEvent keydown).
    // Numpad là position:fixed ngoài viewport 900px → locator.click() chờ scroll
    // mãi không tới → click bằng tọa độ chuột trực tiếp theo boundingBox.
    for (const digit of '500000'.split('')) {
      const box = await page
        .locator('.keyboard-number-root button', {
          hasText: new RegExp(`^\\s*${digit}\\s*$`)
        })
        .first()
        .boundingBox();
      if (!box) throw new Error(`không tìm thấy phím ${digit}`);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await settle(80);
    }
    await settle(300);
    const cashText = (await page.locator('[data-test="pos-cash-received"]').inputValue()).trim();
    Number(cashText) === 500000
      ? ok('P13 numpad nhập 500000', `cash="${cashText}"`)
      : fail('P13 numpad nhập', `cash="${cashText}" != 500000`);

    const changeText = (await page.locator('[data-test="pos-change"]').innerText()).trim();
    const changeNum = Number(changeText.replace(/[^\d]/g, ''));
    const expectedChange = 500000 - variantPrice;
    changeNum === expectedChange
      ? ok('P14 tiền thừa đúng', `${changeText} = 500000 − ${variantPrice}`)
      : fail('P14 tiền thừa', `${changeText} != ${expectedChange}`);

    // ── 5. Xác nhận thanh toán ──
    await page.click('[data-test="pos-confirm-payment"]');
    try {
      await page.waitForSelector('[data-test="pos-order-result"]', { timeout: 20000 });
      const resultText = (await page.locator('[data-test="pos-order-result"]').innerText()).trim();
      const orderCode = (resultText.match(/ORD-\d{8}-[A-Z0-9]{4}/) ?? [null])[0];
      ok('P15 checkout thành công', orderCode ? `order=${orderCode}` : resultText.slice(0, 80));

      // ── 6. Verify sau checkout ──
      // Tồn kho sau (đọc qua /stock/get — retry 5 lần chờ N1QL index bắt kịp)
      let stockAfter = -1;
      for (let i = 0; i < 5; i++) {
        const re = await api('/api/admin/inventory/stock/get', { variantId, branchId });
        stockAfter = Number(re.data?.quantityOnHand ?? -1);
        if (stockAfter === stockBefore - 1) break;
        await settle(1000);
      }
      stockAfter === stockBefore - 1
        ? ok('P16 tồn kho giảm đúng 1', `${stockBefore} → ${stockAfter}`)
        : fail('P16 tồn kho giảm', `sau=${stockAfter}, kỳ vọng ${stockBefore - 1}`);

      // Order + payment tồn tại
      const ordersList = await api('/api/admin/orders/list', { search: orderCode, page: 1, pageSize: 5 });
      const foundOrder = (ordersList.data?.items ?? []).find((o) => o.orderCode === orderCode);
      if (foundOrder) {
        const orderId = foundOrder._id;
        const paidOk = foundOrder.status === 'paid';
        paidOk
          ? ok('P17 order tạo status=paid', `${orderCode}`)
          : fail('P17 order status', `status=${foundOrder.status}`);
        const paymentsList = await api('/api/admin/payments/list', { orderId, page: 1, pageSize: 5 });
        const foundPayment = (paymentsList.data?.items ?? [])[0];
        foundPayment
          ? ok('P18 payment doc tồn tại', `${foundPayment.paymentCode} ${foundPayment.status} ${foundPayment.method}`)
          : fail('P18 payment doc', 'không tìm thấy payment cho order');
      } else {
        fail('P17 order tạo', `không thấy order ${orderCode} trong orders/list`);
      }

      // Session totals — owner KHÔNG gắn branchId (seed cố ý) nên getCurrentSession
      // không match; verify qua: gọi API checkout trực tiếp VỚI sessionId rồi đọc
      // totalSales session từ DB (cbQuery).
      const sessionBeforeSales = Number(sessionBefore?.totalSales ?? 0);
      // Checkout API lần 2 với unitPrice đè (POS được phép sửa đơn giá) —
      // tổng ca tăng đúng 50.000, khác 0 để chứng minh updateSessionTotals chạy.
      const checkoutApi = await api('/api/admin/pos/checkout', {
        items: [{ variantId, quantity: 1, unitPrice: 50000 }],
        paymentMethod: 'cash',
        cashReceived: 50000,
        branchId,
        sessionId
      });
      if (!checkoutApi.ok) {
        fail('P19 session totals', `checkout kèm sessionId fail: ${JSON.stringify(checkoutApi.message).slice(0, 150)}`);
      } else {
        await settle(1200);
        const sessRows = await cbQuery(
          `SELECT totalSales, totalCash FROM \`${CB_BUCKET}\`.\`${CB_SCOPE}\`.pos_sessions WHERE META().id = "${sessionId}"`
        );
        const sessAfter = sessRows.results?.[0];
        const after = Number(sessAfter?.totalSales ?? -1);
        after === sessionBeforeSales + 50000
          ? ok('P19 session totalSales tăng', `${sessionBeforeSales} → ${after} (checkout kèm sessionId, +50.000)`)
          : fail('P19 session totals', `totalSales ${sessionBeforeSales} → ${after}, kỳ vọng +50000`);
      }

      // Không có page error trong suốt flow
      pageErrors.length === 0
        ? ok('P20 không pageerror')
        : fail('P20 pageerror', pageErrors.join(' | ').slice(0, 250));

      // ── 7. Các phương thức thanh toán còn lại của VALID_PAYMENT_METHODS ──
      // bank_transfer → payment pending (chờ đối soát); cod → payment completed;
      // loyalty_points → payment completed method loyalty_points. Verify qua API
      // payments/list sau mỗi checkout. Không cần session — chỉ check payment doc.
      const methodExpectations = [
        { method: 'bank_transfer', schemaMethod: 'bank_transfer', status: 'pending' },
        { method: 'cod', schemaMethod: 'cash', status: 'completed' },
        { method: 'loyalty_points', schemaMethod: 'loyalty_points', status: 'completed' }
      ];
      let methodIdx = 0;
      for (const exp of methodExpectations) {
        methodIdx += 1;
        const res = await api('/api/admin/pos/checkout', {
          items: [{ variantId, quantity: 1, unitPrice: 10000 }],
          paymentMethod: exp.method,
          branchId
        });
        if (!res.ok) {
          fail(`P2${methodIdx + 0} checkout ${exp.method}`, JSON.stringify(res.message).slice(0, 150));
          continue;
        }
        const orderId = res.data?.documentKey;
        const payList = await api('/api/admin/payments/list', { orderId, page: 1, pageSize: 5 });
        const pay = (payList.data?.items ?? [])[0];
        if (!pay) {
          fail(`P2${methodIdx + 0} payment ${exp.method}`, 'không tìm thấy payment doc');
          continue;
        }
        const pass =
          String(pay.method) === exp.schemaMethod &&
          String(pay.status) === exp.status &&
          Number(pay.amount) === 10000;
        pass
          ? ok(`P2${methodIdx + 0} checkout ${exp.method} → payment ${pay.method}/${pay.status}`, `amount=${pay.amount}`)
          : fail(
              `P2${methodIdx + 0} checkout ${exp.method}`,
              `payment ${pay.method}/${pay.status}/${pay.amount} kỳ vọng ${exp.schemaMethod}/${exp.status}/10000`
            );
      }

      // UI select hiển thị đủ 7 option method — đóng modal kết quả, thêm lại hàng
      // vào giỏ (giỏ đã clear sau checkout P15), mở modal thanh toán, đếm option.
      try {
        const closeBtn = page.locator('button', { hasText: /Đơn mới|New order/ });
        if (await closeBtn.count()) await closeBtn.first().click();
        await settle(400);
      } catch {
        /* modal đã đóng */
      }
      await resultRows.first().click();
      await settle(400);
      await page.click('[data-test="pos-checkout-btn"]');
      await page.waitForSelector('[data-test="pos-payment-method"]', { timeout: 10000 });
      const optionCount = await page.locator('[data-test="pos-payment-method"] option').count();
      optionCount === 7
        ? ok('P24 select đủ 7 phương thức', `${optionCount} option`)
        : fail('P24 select method', `chỉ ${optionCount}/7 option`);
    } catch (e) {
      // Checkout fail — kiểm tra banner lỗi để chẩn đoán
      const errBanner = await page
        .locator('[data-test="pos-checkout-error"]')
        .innerText()
        .catch(() => null);
      fail('P15 checkout', errBanner ? `banner: ${errBanner}` : String(e).slice(0, 200));
    }

    // ── Screenshot (ui-checker đọc sau) ──
    // Modal thanh toán / kết quả còn mở → đóng để chụp trang chính
    try {
      const payCloseBtn = page.locator('button', { hasText: /^Đóng$|^Close$/ });
      if (await payCloseBtn.count()) await payCloseBtn.first().click();
      await settle(300);
    } catch {
      /* modal đã đóng */
    }
    try {
      const closeBtn = page.locator('button', { hasText: /Đơn mới|New order/ });
      if (await closeBtn.count()) await closeBtn.first().click();
      await settle(400);
    } catch {
      /* modal đã đóng */
    }
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'tests/_ui-shots/admin-pos-terminal.png', fullPage: false });
    console.log('  screenshot → tests/_ui-shots/admin-pos-terminal.png');
  } catch (e) {
    fail('flow chính', String(e).slice(0, 300));
  } finally {
    summary();
    await browser.close();
  }
}

main().catch((e) => {
  console.error('probe crash:', e);
  process.exit(1);
});
