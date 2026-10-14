// ============================================================
// Import MongoDB backup (mongo_database_backup/alpha_corp) -> Couchbase Capella
// Bucket phuongdomega, scope _default — dùng HTTP Query service (giống app).
// Chạy: node tests/import-mongo-backup.mjs
// Đọc credentials từ .env (cb_clusterId, cb_username, cb_password, cb_bucketName, cb_scopeName)
// ============================================================
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';

const require = createRequire(fileURLToPath(new URL('../package.json', import.meta.url)));
const BSON = require('bson');

const ROOT = fileURLToPath(new URL('../', import.meta.url));

// ---------- ENV ----------
const envText = readFileSync(`${ROOT}.env`, 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*['"]?([^'"]*?)['"]?\s*$/);
  if (m) env[m[1]] = m[2].trim();
}
const CLUSTER = env.cb_clusterId;
const USER = env.cb_username;
const PASS = env.cb_password;
const BUCKET = env.cb_bucketName || 'phuongdomega';
const SCOPE = env.cb_scopeName || '_default';
const BASIC = Buffer.from(`${USER}:${PASS}`).toString('base64');

// ---------- Query helper (HTTP Query service — cùng cách app gọi) ----------
let reqCount = 0;
async function q(statement) {
  reqCount++;
  const r = await fetch(`https://${CLUSTER}.data.cloud.couchbase.com/_p/query/query/service`, {
    method: 'POST',
    headers: { authorization: `Basic ${BASIC}`, 'content-type': 'application/json' },
    body: JSON.stringify({ statement })
  });
  const j = await r.json().catch(() => ({}));
  if (r.status !== 200 || (j.errors && j.errors.length)) {
    throw new Error(`Query failed (${r.status}): ${JSON.stringify(j.errors ?? j).slice(0, 300)}`);
  }
  return j;
}

// ---------- BSON reader (stream nối tiếp theo int32LE size prefix) ----------
function readBsonDocs(filePath) {
  const buf = readFileSync(filePath);
  const docs = [];
  let off = 0;
  while (off + 4 < buf.length) {
    const size = buf.readUInt32LE(off);
    if (size < 5 || off + size > buf.length) break;
    docs.push(BSON.deserialize(buf.subarray(off, off + size)));
    off += size;
  }
  return docs;
}

// ---------- Date normalizer (BSON Date | ISO string | epoch-ms number | bọc {value}) ----------
function normDate(v) {
  if (v == null) return null;
  let x = v;
  if (x && typeof x === 'object' && !(x instanceof Date) && !Array.isArray(x) && 'value' in x) x = x.value;
  if (x == null) return null;
  let d = null;
  if (x instanceof Date) d = x;
  else if (typeof x === 'number') d = new Date(x);
  else if (typeof x === 'string') d = /^\d+$/.test(x) ? new Date(Number(x)) : new Date(x);
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// ---------- Bóc wrapper {value, previous_value, ...} ----------
function unwrap(v) {
  if (v == null) return null;
  if (Array.isArray(v)) return v;
  if (typeof v === 'object' && !(v instanceof Date) && 'value' in v) return v.value;
  return v;
}
function asText(v) {
  const x = unwrap(v);
  if (x == null) return '';
  if (Array.isArray(x)) return x.map((s) => String(s)).filter((s) => s.trim() !== '').join(', ');
  if (typeof x === 'object') return '';
  return String(x);
}
function oneId(v) {
  const x = unwrap(v);
  if (x == null) return null;
  if (Array.isArray(x)) return x.length ? String(x[0]) : null;
  return String(x);
}
function num(v) {
  const x = unwrap(v);
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x))) return Number(x);
  return 0;
}

// ---------- N1QL helpers ----------
function esc(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}
function sha256hex(s) {
  return createHash('sha256').update(String(s), 'utf8').digest('hex');
}

// ---------- File registry (thế hệ mới nhất, bỏ debts/session_login/thế hệ cũ) ----------
const DIR = `${ROOT}mongo_database_backup/alpha_corp`;
const FILES = {
  suppliers: '67ef89199ab39a089de46fdd.bson',
  products: '68348abb46ae47450a196cff.bson',
  variants: '683eba3a46ae47450a196d9e.bson',
  warehouse: '683d210446ae47450a196d66.bson',
  customers: '6852542850002bcaca9fcc62.bson',
  customers2: '683d63bb46ae47450a196d68.bson',
  orders: '6857aefc50002bcaca9fcc7b.bson'
};

// ---------- Bộ nhớ: legacyId -> documentKey mới ----------
const idMap = { supplier: new Map(), product: new Map(), variant: new Map(), inventory: new Map(), user: new Map(), order: new Map() };
const stats = {
  suppliers: { imported: 0, skipped: 0, failed: 0, errors: [] },
  products: { imported: 0, skipped: 0, failed: 0, errors: [] },
  variants: { imported: 0, skipped: 0, failed: 0, errors: [] },
  warehouse: { imported: 0, skipped: 0, failed: 0, errors: [] },
  customers: { imported: 0, skipped: 0, failed: 0, errors: [] },
  customers2: { imported: 0, skipped: 0, failed: 0, errors: [] },
  orders: { imported: 0, skipped: 0, failed: 0, errors: [] }
};
const FAIL_LIST = [];
function fail(group, legacyId, message) {
  stats[group].failed++;
  const entry = { group, legacyId: String(legacyId), message: String(message).slice(0, 200) };
  stats[group].errors.push(entry);
  FAIL_LIST.push(entry);
}

// ---------- Batch UPSERT (N1QL object literal — giá trị JSON inline) ----------
async function upsertBatch(collection, group, docs) {
  if (!docs.length) return;
  for (let i = 0; i < docs.length; i += 200) {
    const slice = docs.slice(i, i + 200);
    const values = slice.map((d) => `(${JSON.stringify(d.key)}, ${JSON.stringify(d.doc)})`).join(', ');
    await q(`UPSERT INTO \`${BUCKET}\`.\`${SCOPE}\`.\`${collection}\` (KEY, VALUE) VALUES ${values}`);
    stats[group].imported += slice.length;
  }
}

// ---------- Load ----------
console.log('== Loading BSON files ==');
const data = {};
for (const [name, file] of Object.entries(FILES)) {
  const p = `${DIR}/${file}`;
  if (!existsSync(p)) {
    console.log(`  MISSING: ${file}`);
    data[name] = [];
    continue;
  }
  data[name] = readBsonDocs(p);
  console.log(`  ${name}: ${data[name].length} docs (${file})`);
}

// ---------- 1. SUPPLIERS ----------
console.log('\n== 1/6 suppliers ==');
{
  const docs = [];
  for (const d of data.suppliers) {
    try {
      const legacyId = String(d._id);
      const name = asText(d._1772639999985695);
      if (!name) {
        fail('suppliers', legacyId, 'empty name');
        continue;
      }
      const phone = asText(d._12957900000000001) || asText(d._142759) || '';
      const key = `supplier::imp_${legacyId}`;
      idMap.supplier.set(legacyId, key);
      docs.push({
        key,
        doc: {
          legacyId,
          name,
          contactPerson: '',
          phoneEncrypted: '',
          phoneBlindIndex: phone ? sha256hex(phone) : '',
          address: asText(d._12207000000000001),
          status: 'active',
          createdAt: normDate(d.created_at) ?? new Date().toISOString(),
          updatedAt: normDate(d.updated_at) ?? normDate(d.created_at) ?? new Date().toISOString()
        }
      });
    } catch (e) {
      fail('suppliers', d._id ?? '?', e.message);
    }
  }
  await upsertBatch('suppliers', 'suppliers', docs);
  console.log(`  suppliers: ${stats.suppliers.imported} imported, ${stats.suppliers.failed} failed`);
}

// ---------- 2. PRODUCTS ----------
console.log('\n== 2/6 products ==');
{
  const docs = [];
  for (const d of data.products) {
    try {
      const legacyId = String(d._id);
      const name = asText(d.name);
      if (!name) {
        fail('products', legacyId, 'empty name');
        continue;
      }
      const key = `product::imp_${legacyId}`;
      idMap.product.set(legacyId, key);
      docs.push({
        key,
        doc: {
          legacyId,
          name,
          description: asText(d.description),
          categoryId: '',
          brandId: '',
          hasVariants: false,
          variantAttributes: {},
          imageUrl: '',
          status: 'active',
          createdBy: asText(d.created_by) || 'import',
          createdAt: normDate(d.created_at) ?? new Date().toISOString(),
          updatedAt: normDate(d.updated_at) ?? normDate(d.created_at) ?? new Date().toISOString(),
          deletedAt: null
        }
      });
    } catch (e) {
      fail('products', d._id ?? '?', e.message);
    }
  }
  await upsertBatch('products', 'products', docs);
  console.log(`  products: ${stats.products.imported} imported, ${stats.products.failed} failed`);
}

// ---------- 3. PRODUCT VARIANTS ----------
console.log('\n== 3/6 product_variants ==');
{
  const docs = [];
  for (const d of data.variants) {
    try {
      const legacyId = String(d._id);
      const productKey = idMap.product.get(oneId(d.product_id));
      if (!productKey) {
        fail('variants', legacyId, `product ref not found: ${oneId(d.product_id)}`);
        continue;
      }
      const key = `variant::imp_${legacyId}`;
      idMap.variant.set(legacyId, key);
      const code = asText(d.code);
      const name = asText(d.name);
      const price = num(d.selling_price ?? d.price);
      docs.push({
        key,
        doc: {
          legacyId,
          productId: productKey,
          sku: code ? `IMP-${legacyId.slice(-8).toUpperCase()}` : `IMP-${legacyId.slice(-8).toUpperCase()}`,
          barcode: code,
          attributes: {},
          displayName: name,
          price,
          costPrice: num(d.import_price ?? d.cost_price),
          weight: 0,
          trackLot: false,
          trackExpiry: false,
          lowStockThreshold: 0,
          imageUrl: '',
          status: 'active',
          createdAt: normDate(d.created_at) ?? new Date().toISOString(),
          updatedAt: normDate(d.updated_at) ?? normDate(d.created_at) ?? new Date().toISOString(),
          deletedAt: null
        }
      });
    } catch (e) {
      fail('variants', d._id ?? '?', e.message);
    }
  }
  await upsertBatch('product_variants', 'variants', docs);
  console.log(`  product_variants: ${stats.variants.imported} imported, ${stats.variants.failed} failed`);
}

// ---------- 4. WAREHOUSE -> inventory_stock ----------
console.log('\n== 4/6 inventory_stock ==');
{
  const docs = [];
  for (const d of data.warehouse) {
    try {
      const legacyId = String(d._id);
      const variantKey = idMap.variant.get(oneId(d.variant_id));
      if (!variantKey) {
        fail('warehouse', legacyId, `variant ref not found: ${oneId(d.variant_id)}`);
        continue;
      }
      // Gom theo (variantKey, branchId='main') — nếu trùng thì cộng dồn quantity
      const qty = num(d.quantity);
      const existing = docs.find((x) => x.doc.variantId === variantKey);
      if (existing) {
        existing.doc.quantityOnHand += qty;
      } else {
        const key = `inventory::imp_${legacyId}`;
        idMap.inventory.set(legacyId, key);
        docs.push({
          key,
          doc: {
            legacyId,
            variantId: variantKey,
            branchId: 'main',
            quantityOnHand: qty,
            quantityReserved: 0,
            updatedAt: normDate(d.updated_at) ?? normDate(d.created_at) ?? new Date().toISOString()
          }
        });
      }
    } catch (e) {
      fail('warehouse', d._id ?? '?', e.message);
    }
  }
  await upsertBatch('inventory_stock', 'warehouse', docs);
  console.log(`  inventory_stock: ${stats.warehouse.imported} imported, ${stats.warehouse.failed} failed`);
}

// ---------- 5. CUSTOMERS -> users (role-customer) ----------
console.log('\n== 5/6 users (customers + customers2) ==');
{
  const docs = [];
  const mkCustomer = (d, group) => {
    const legacyId = String(d._id);
    const name = asText(d.name);
    if (!name) {
      fail(group, legacyId, 'empty name');
      return;
    }
    const email = asText(d.email);
    const phones = unwrap(d.phones) ?? unwrap(d.phone);
    const phone = Array.isArray(phones) ? String(phones[0] ?? '') : String(phones ?? '');
    const key = `users::imp_${legacyId}`;
    idMap.user.set(legacyId, key);
    docs.push({
      key,
      doc: {
        legacyId,
        firstname: name,
        midname: null,
        lastname: '',
        description: asText(d.note) || '',
        roleId: 'role-customer',
        statusId: 'status-active',
        emailBlindIndex: email ? sha256hex(email) : '',
        phoneBlindIndex: phone ? sha256hex(phone) : '',
        usernameBlindIndex: '',
        emailEncrypted: '{}',
        phoneEncrypted: '{}',
        profileEncrypted: '{}',
        vaultSaltB64: '',
        vaultDekIvB64: '',
        vaultWrappedDekB64: '',
        authMethod: 'imported',
        webauthnCredentials: [],
        webauthnUserHandle: randomUUID(),
        mfaEnabled: false,
        remember: false,
        loyaltyPoints: 0,
        branchId: null,
        createdAt: normDate(d.created_at) ?? new Date().toISOString(),
        updatedAt: normDate(d.updated_at) ?? normDate(d.created_at) ?? new Date().toISOString(),
        deletedAt: null
      }
    });
  };
  for (const d of data.customers) {
    try {
      mkCustomer(d, 'customers');
    } catch (e) {
      fail('customers', d._id ?? '?', e.message);
    }
  }
  for (const d of data.customers2) {
    try {
      mkCustomer(d, 'customers2');
    } catch (e) {
      fail('customers2', d._id ?? '?', e.message);
    }
  }
  // UPSERT vào users nhưng stats tách nhóm theo nguồn
  const customersDocs = docs.filter((x) => data.customers.some((c) => x.key === `users::imp_${c._id}`));
  const customers2Docs = docs.filter((x) => !customersDocs.includes(x));
  await upsertBatch('users', 'customers', customersDocs);
  await upsertBatch('users', 'customers2', customers2Docs);
  console.log(`  users: ${stats.customers.imported + stats.customers2.imported} imported, ${stats.customers.failed + stats.customers2.failed} failed`);
}

// ---------- 6. ORDERS ----------
console.log('\n== 6/6 orders ==');
{
  const docs = [];
  for (const d of data.orders) {
    try {
      const legacyId = String(d._id);
      const key = `order::imp_${legacyId}`;
      idMap.order.set(legacyId, key);
      const items = (Array.isArray(unwrap(d.items)) ? unwrap(d.items) : []).map((line) => {
        const variantLegacy = oneId(line?.variant_id);
        return {
          variantId: idMap.variant.get(variantLegacy) ?? null,
          quantity: num(line?.quantity),
          price: num(line?.selling_price)
        };
      });
      const amount = num(d.amount);
      docs.push({
        key,
        doc: {
          legacyId,
          orderCode: `ORD-IMP-${legacyId.slice(-6).toUpperCase()}`,
          customerId: idMap.user.get(oneId(d.customer_id)) ?? '',
          staffId: 'users-admin',
          branchId: null,
          status: amount > 0 && num(d.debt_amount) === 0 ? 'confirmed' : 'pending',
          items,
          totalAmount: amount,
          createdAt: normDate(d.created_at) ?? new Date().toISOString(),
          updatedAt: normDate(d.updated_at) ?? normDate(d.created_at) ?? new Date().toISOString(),
          deletedAt: null
        }
      });
    } catch (e) {
      fail('orders', d._id ?? '?', e.message);
    }
  }
  await upsertBatch('orders', 'orders', docs);
  console.log(`  orders: ${stats.orders.imported} imported, ${stats.orders.failed} failed`);
}

// ---------- VERIFICATION ----------
console.log('\n== VERIFICATION ==');
const verify = {};
for (const col of ['suppliers', 'products', 'product_variants', 'inventory_stock', 'users', 'orders']) {
  const j = await q(`SELECT COUNT(1) AS c FROM \`${BUCKET}\`.\`${SCOPE}\`.\`${col}\` WHERE legacyId IS NOT MISSING`);
  const total = await q(`SELECT COUNT(1) AS c FROM \`${BUCKET}\`.\`${SCOPE}\`.\`${col}\``);
  verify[col] = { imported: j.results?.[0]?.c ?? 0, total: total.results?.[0]?.c ?? 0 };
  console.log(`  ${col}: imported=${verify[col].imported}, total=${verify[col].total}`);
}

// Sample 3 docs mỗi collection (USE KEYS)
console.log('\n== SAMPLE DOCS ==');
for (const [col, map] of [['suppliers', idMap.supplier], ['products', idMap.product], ['product_variants', idMap.variant], ['inventory_stock', idMap.inventory], ['users', idMap.user], ['orders', idMap.order]]) {
  const keys = [...map.values()].slice(0, 3);
  if (!keys.length) continue;
  const j = await q(`SELECT META().id AS docKey, * FROM \`${BUCKET}\`.\`${SCOPE}\`.\`${col}\` USE KEYS ${JSON.stringify(keys)}`);
  console.log(`  ${col}:`);
  for (const row of j.results ?? []) {
    console.log(`    ${JSON.stringify(row).slice(0, 400)}`);
  }
}

// ---------- SUMMARY ----------
console.log('\n== SUMMARY ==');
let totalImported = 0;
let totalFailed = 0;
for (const [g, s] of Object.entries(stats)) {
  console.log(`  ${g}: imported=${s.imported}, failed=${s.failed}`);
  totalImported += s.imported;
  totalFailed += s.failed;
}
console.log(`  TOTAL: imported=${totalImported}, failed=${totalFailed}`);
console.log(`  HTTP requests: ${reqCount}`);
if (FAIL_LIST.length) {
  console.log('\n== ERRORS (max 30) ==');
  for (const e of FAIL_LIST.slice(0, 30)) console.log(`  [${e.group}] ${e.legacyId}: ${e.message}`);
}
console.log('\nDONE');
