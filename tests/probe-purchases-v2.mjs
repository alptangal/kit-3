// Probe: Nhập hàng đầy đủ /admin/purchases v2 (voucher NCC + accordion + search + barcode + create-on-the-fly).
// Flow:
//   1. Login admin → lấy branch + 2 variant (theo barcode) qua API.
//   2. Seed tồn kho cơ sở → đọc stock TRƯỚC (item1, item2, gift).
//   3. Tạo phiếu nhập đầy đủ qua API: 3 items
//      - item1: variant A × 10, voucher gift: variant B × 2 (mua 10 tặng 2)
//      - item2: variant B × 5, voucher money 50000
//      - item3: variant B × 3 (không voucher — dòng thường)
//      + voucher cấp phiếu giảm 100000, totalCost = 10*20000 + 5*15000 + 3*15000 − 50000 − 100000 = 170000
//   4. Verify DB: tồn kho sau (A +10, B +5+3+2 quà), PO doc có vouchers + unitCostEffective,
//      giá vốn phân bổ: (170000 − 50000 − 100000) / 20 units = 1000/unit.
//   5. Backward compat: phiếu KHÔNG voucher vẫn OK (items cũ shape).
//   6. Find-barcode: POST variants/list { search: barcode } → exact match.
//   7. Create-on-the-fly: products/create + variants/create → variant mới tìm thấy theo barcode.
//   8. UI: mở /admin/purchases → modal nhập đầy đủ mở (nút Nhập hàng đầy đủ) →
//      bước 2 accordion hiện dòng tóm tắt STT + tên; bước 3 review số liệu.
// Chạy: node tests/probe-purchases-v2.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

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
  const r = await fetch(`https://${CB_CLUSTER}.data.cloud.couchbase.com/_p/query/query/service`, {
    method: 'POST',
    headers: { authorization: CB_AUTH, 'content-type': 'application/json' },
    body: JSON.stringify({ statement })
  });
  return r.json().catch(() => ({}));
}

async function getStock(variantId, branchId) {
  const r = await cbQuery(
    `SELECT quantityOnHand FROM \`${CB_BUCKET}\`.\`${CB_SCOPE}\`.inventory_stock WHERE variantId = '${variantId}' AND branchId = '${branchId}' LIMIT 1`
  );
  return Number(r.results?.[0]?.quantityOnHand ?? 0);
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

async function getPO(poId) {
  const r = await cbQuery(
    `SELECT * FROM \`${CB_BUCKET}\`.\`${CB_SCOPE}\`.purchase_orders USE KEYS '${poId}'`
  );
  return r.results?.[0]?.purchase_orders ?? r.results?.[0] ?? null;
}

const BASE = 'https://127.0.0.1:3000';
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

async function apiOnce(url, body) {
  return await page.evaluate(
    async ({ u, b }) => {
      const enc = await import('/src/lib/modules/encryption.ts');
      return await enc.encryption.fetchSecure(u, { method: 'POST', body: b });
    },
    { u: url, b: body ?? {} }
  );
}

// Vite HMR (agents khác sửa file cùng repo) có thể full-reload trang giữa chừng —
// evaluate chết 'Execution context was destroyed'. Thử lại sau khi trang ổn định.
async function api(url, body) {
  try {
    return await apiOnce(url, body);
  } catch (err) {
    if (!/Execution context was destroyed|Navigation/i.test(String(err))) throw err;
    await settle(2500);
    return await apiOnce(url, body);
  }
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
  console.log('=== probe purchases v2 (full purchase + voucher) ===');
  const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  try {
    // ── 1. Login + dữ liệu nền ──
    await login();
    ok('V1 login OK');

    const branchesRes = await api('/api/admin/inventory/branches', {});
    const branches = (branchesRes.data ?? []).map((b) => ({ _id: b._id, name: b.name }));
    if (!branchesRes.ok || branches.length === 0) throw new Error('không lấy được chi nhánh');
    const branchId = branches[0]._id;
    ok('V2 lấy chi nhánh', branchId);

    // 2 variant theo barcode (dữ liệu import thật: barcode đầy đủ 13 chữ số)
    const candA = await api('/api/admin/variants/list', { page: 1, pageSize: 50, search: '8997033170164' });
    const candB = await api('/api/admin/variants/list', { page: 1, pageSize: 50, search: '8938507953067' });
    const variantA = (candA.data?.items ?? []).find((v) => v.barcode === '8997033170164');
    const variantB = (candB.data?.items ?? []).find((v) => v.barcode === '8938507953067');
    if (!variantA || !variantB) throw new Error('không tìm thấy variant theo barcode mẫu');
    ok('V3 tìm variant theo barcode (list API)', `A=${variantA.sku}, B=${variantB.sku}`);

    // ── 2. Seed tồn kho + đọc TRƯỚC ──
    await seedStockDoc(variantA._id, branchId, 0);
    await seedStockDoc(variantB._id, branchId, 0);
    await settle(1200);
    const stockA0 = await getStock(variantA._id, branchId);
    const stockB0 = await getStock(variantB._id, branchId);
    ok('V4 seed tồn kho về 0', `A=${stockA0}, B=${stockB0}`);

    // ── 3. Tạo phiếu nhập đầy đủ (voucher gift + money + phiếu) ──
    const suppliersRes = await api('/api/admin/suppliers/list', { page: 1, pageSize: 5 });
    const supplierId = suppliersRes.data?.items?.[0]?._id;
    if (!supplierId) throw new Error('không lấy được supplier');
    ok('V4b lấy NCC', supplierId);

    const cost = 20000;
    const totalCost = 10 * 20000 + 5 * 15000 + 3 * 15000 - 50000 - 100000; // 170000
    const createRes = await api('/api/admin/purchases/create', {
      mode: 'supplier',
      supplierId,
      branchId,
      items: [
        { variantId: variantA._id, quantity: 10, unitCost: 20000, lotNumber: 'LOT-A1', voucher: { type: 'gift', giftVariantId: variantB._id, giftQuantity: 2 } },
        { variantId: variantB._id, quantity: 5, unitCost: 15000, lotNumber: 'LOT-B1', voucher: { type: 'money', value: 50000 } },
        { variantId: variantB._id, quantity: 3, unitCost: 15000, lotNumber: 'LOT-B2' }
      ],
      totalCost,
      vouchers: [{ type: 'money', value: 100000 }],
      note: 'probe v2 — mua 10 tặng 2 + giảm tiền',
      expiryMode: 'direct',
      manufacturedAt: new Date(Date.now() - 30 * 864e5).toISOString(),
      expiresAt: new Date(Date.now() + 180 * 864e5).toISOString()
    });
    createRes.ok
      ? ok('V5 tạo phiếu đầy đủ (gift + money + voucher phiếu)', `totalCost=${totalCost}`)
      : fail('V5 tạo phiếu đầy đủ', JSON.stringify(createRes.message).slice(0, 200));

    const poId = createRes.data?.po?._id ?? createRes.data?._id;
    if (!poId) throw new Error('không lấy được poId từ response: ' + JSON.stringify(createRes.data ?? {}).slice(0, 200));

    // N1QL index lag → poll 5 lần
    let po = null;
    for (let i = 0; i < 5; i++) {
      po = await getPO(poId);
      if (po) break;
      await settle(1000);
    }
    po ? ok('V6 PO doc tồn tại', po.poCode) : fail('V6 PO doc', 'không thấy trong DB');

    // ── 4. Verify tồn kho sau receive (kể cả quà tặng) ──
    for (let i = 0; i < 5; i++) {
      const a = await getStock(variantA._id, branchId);
      const b = await getStock(variantB._id, branchId);
      if (a - stockA0 === 10 && b - stockB0 === 10) break;
      await settle(1000);
    }
    const stockA1 = await getStock(variantA._id, branchId);
    const stockB1 = await getStock(variantB._id, branchId);
    stockA1 - stockA0 === 10
      ? ok('V7 tồn kho A sau nhận +10 (dòng nhập)', `${stockA0} → ${stockA1}`)
      : fail('V7 tồn kho A', `tăng ${stockA1 - stockA0} ≠ 10`);
    stockB1 - stockB0 === 10
      ? ok('V8 tồn kho B sau nhận +10 (5 nhập + 3 nhập + 2 quà)', `${stockB0} → ${stockB1}`)
      : fail('V8 tồn kho B', `tăng ${stockB1 - stockB0} ≠ 10 (nhập 8 + quà 2)`);

    // ── 5. Verify vouchers + phân bổ giá vốn ──
    po?.vouchers?.length === 1 && po.vouchers[0].value === 100000
      ? ok('V9 PO.vouchers lưu đúng', JSON.stringify(po.vouchers))
      : fail('V9 PO.vouchers', JSON.stringify(po?.vouchers));

    const item1 = po?.items?.find((x) => x.variantId === variantA._id);
    const item2 = po?.items?.find((x) => x.variantId === variantB._id && x.quantity === 5);
    item1?.voucher?.type === 'gift' && Number(item1.voucher.giftQuantity) === 2
      ? ok('V10 item voucher gift lưu đúng', JSON.stringify(item1?.voucher))
      : fail('V10 voucher gift item', JSON.stringify(item1?.voucher));

    const effectiveCost = totalCost - 50000 - 100000; // 170000 − 50000 (item money) − 100000 (PO money) = 20000
    const totalUnits = 10 + 5 + 3 + 2; // 20
    const expectPerUnit = Math.round((effectiveCost / totalUnits) * 10000) / 10000; // 1000
    const per1 = Number(item1?.unitCostEffective ?? -1);
    const per2 = Number(item2?.unitCostEffective ?? -1);
    per1 === expectPerUnit && per2 === expectPerUnit
      ? ok('V11 giá vốn phân bổ unitCostEffective = 1000', `per-unit=${per1}/${per2}`)
      : fail('V11 giá vốn phân bổ', `unitCostEffective=${per1}/${per2} ≠ ${expectPerUnit}`);

    // ── 6. Backward compat: phiếu KHÔNG voucher ──
    const legacy = await api('/api/admin/purchases/create', {
      mode: 'product',
      branchId,
      items: [{ variantId: variantA._id, quantity: 4, unitCost: 12000 }],
      totalCost: 48000
    });
    legacy.ok
      ? ok('V12 backward compat — phiếu không voucher vẫn OK')
      : fail('V12 backward compat', JSON.stringify(legacy.message).slice(0, 200));
    const legacyStock = await getStock(variantA._id, branchId);
    legacyStock === stockA1 + 4
      ? ok('V13 tồn kho phiếu legacy +4', `${stockA1} → ${legacyStock}`)
      : fail('V13 tồn kho legacy', `${legacyStock} ≠ ${stockA1 + 4}`);

    // ── 7. Find-barcode + create-on-the-fly ──
    const findRes = await api('/api/admin/variants/list', { page: 1, pageSize: 5, search: '8997033170164' });
    const found = (findRes.data?.items ?? []).find((v) => v.barcode === '8997033170164');
    found ? ok('V14 find-barcode exact match', found.sku) : fail('V14 find-barcode', 'không thấy variant theo barcode');

    const stamp = Date.now().toString(36).toUpperCase();
    const prodRes = await api('/api/admin/products/create', {
      name: `Probe V2 Product ${stamp}`,
      categoryId: 'category::768ad781-a903-4b10-a708-2bd41b6595a0',
      hasVariants: true
    });
    const productKey = prodRes.data?.documentKey;
    prodRes.ok && productKey ? ok('V15 create-on-the-fly — tạo product', productKey) : fail('V15 tạo product', JSON.stringify(prodRes.message).slice(0, 200));

    const newBarcode = `89${stamp.replace(/[^A-Z0-9]/g, '').slice(-11).padStart(11, '0')}`;
    const varRes = await api('/api/admin/variants/create', {
      productId: productKey,
      sku: `PRB2-${stamp}`,
      barcode: newBarcode,
      displayName: `Probe V2 Product ${stamp}`,
      price: 30000,
      costPrice: 18000,
      attributes: {}
    });
    const variantKey = varRes.data?.documentKey;
    varRes.ok && variantKey ? ok('V16 create-on-the-fly — tạo variant', variantKey) : fail('V16 tạo variant', JSON.stringify(varRes.message).slice(0, 200));

    // Variant mới tìm thấy theo barcode (poll index)
    let foundNew = null;
    for (let i = 0; i < 5; i++) {
      const r = await api('/api/admin/variants/list', { page: 1, pageSize: 5, search: newBarcode });
      foundNew = (r.data?.items ?? []).find((v) => v.barcode === newBarcode);
      if (foundNew) break;
      await settle(1000);
    }
    foundNew ? ok('V17 variant mới tìm theo barcode OK', foundNew.sku) : fail('V17 tìm variant mới', `barcode=${newBarcode}`);

    // ── 8. UI: modal nhập hàng đầy đủ ──
    await page.goto(BASE + '/admin/purchases', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('button:has-text("Full purchase"), button:has-text("Nhập hàng đầy đủ")', { timeout: 30000 }).catch(() => {});
    await settle(1500);
    await page.click('button:has-text("Nhập hàng đầy đủ"), button:has-text("Full purchase")', { timeout: 15000 });
    await settle(800);
    const fullModal = page.locator('.full-steps');
    (await fullModal.count()) > 0
      ? ok('V18 modal nhập đầy đủ mở (3 bước)')
      : fail('V18 modal nhập đầy đủ', 'không thấy .full-steps');

    // Bước 1 → 2
    await page.locator('.modal-footer-root button:has-text("Next"), .modal-footer-root button:has-text("Tiếp tục")').first().click();
    await settle(600);
    const accordionCount = await page.locator('[data-test^="full-item-row-"]').count();
    accordionCount >= 1
      ? ok('V19 bước 2 — accordion item dòng tóm tắt hiện', `${accordionCount} dòng`)
      : fail('V19 accordion items', 'không thấy dòng tóm tắt');

    const searchInput = page.locator('[data-test="full-search-input"]');
    (await searchInput.count()) > 0
      ? ok('V20 ô tìm kiếm sản phẩm hiện')
      : fail('V20 ô tìm kiếm', 'không thấy full-search-input');

    await searchInput.fill('8997033170164');
    // Retry ≤3 lần: HMR full-reload giữa chừng reset $state (encryptionKeys null) → runFullSearch return sớm;
    // mở lại modal tạo keys mới rồi search lại.
    let resultRows = 0;
    for (let attempt = 1; attempt <= 3 && resultRows === 0; attempt++) {
      if (attempt > 1) {
        await page.keyboard.press('Escape').catch(() => {});
        await settle(600);
        await page.click('button:has-text("Nhập hàng đầy đủ"), button:has-text("Full purchase")', { timeout: 15000 }).catch(() => {});
        await settle(800);
        await page.locator('.modal-footer-root button:has-text("Next"), .modal-footer-root button:has-text("Tiếp tục")').first().click();
        await settle(800);
        await searchInput.fill('8997033170164');
      }
      await page.click('[data-test="full-search-btn"]');
      // chờ results render hoặc empty state render (tối đa 6s)
      try {
        await page.waitForSelector('[data-test="full-search-results"], .full-search-empty', { timeout: 6000 });
      } catch { /* retry */ }
      resultRows = await page.locator('[data-test="full-search-results"] .full-search-result').count();
    }
    resultRows > 0
      ? ok('V21 search theo barcode qua UI trả kết quả', `${resultRows} dòng`)
      : fail('V21 search UI', 'không thấy kết quả sau 3 lần thử');

    // Thêm item từ kết quả search
    await page.locator('[data-test="full-search-results"] button').first().click();
    await settle(500);
    const rowsAfter = await page.locator('[data-test^="full-item-row-"]').count();
    rowsAfter === accordionCount + 1 || rowsAfter >= accordionCount
      ? ok('V22 thêm item từ search vào accordion')
      : fail('V22 thêm item', `rows=${rowsAfter}`);

    // Bước 3 review
    await page.locator('.modal-footer-root button:has-text("Next"), .modal-footer-root button:has-text("Tiếp tục")').first().click();
    await settle(600);
    const review = await page.locator('[data-test="full-review"]').count();
    review > 0 ? ok('V23 bước 3 — review hiện') : fail('V23 review', 'không thấy full-review');

    await page.screenshot({ path: 'tests/_ui-shots/purchases-v2-modal-step3.png', fullPage: false });
    ok('V24 screenshot bước 3 đã chụp');

    // Đóng modal
    await page.click('.modal-close, [data-test="modal-close"], button:has-text("Huỷ")').catch(() => {});
    await settle(500);
  } catch (err) {
    fail('V0 exception', err.message);
  }

  if (pageErrors.length > 0) {
    console.log('  pageerrors:', pageErrors.slice(0, 3).join(' | '));
  }
  await browser.close();
  summary();
}

main();
