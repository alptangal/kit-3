# HANDOFF

## 1. Mục tiêu & Phase
- Phase: **4 — Core Retail Data Model & Operations** — BACKEND + UI ADMIN PHASE 4: xem section 8.
- Phase 6 tính năng bán hàng hiện đại (nhập hàng/expiry/chi phí/camera/thống kê/agent catalog): **HOÀN THÀNH** — xem section 9.

## 2. Trạng thái task (theo todo list)
| Task | Trạng thái |
|------|------------|
| #27 Multi-branch Inventory System | ✅ Service + 6 API routes (stock list/get/adjust, lots list/create, branches) |
| #28 Order Management API & UI | ✅ API xong: 5 routes (list/create/get/update-status/cancel) — **UI chưa có** |
| #29 Supplier & Purchasing (PO) System | ✅ API xong: suppliers 3 routes + purchase-orders — **UI chưa có** |
| #30 Pricing Engine & Promotions | ✅ API xong: 3 routes + customer apply — **UI chưa có** |
| #31 POS Sessions (Cash Drawer Management) | ✅ API xong: 5 routes — **UI chưa có** |
| #32 Stock Takes (Inventory Audit) | ✅ API xong: 6 routes — **UI chưa có** |
| #40 InventoryService (server db layer) | ✅ committed |

## 3. File đã tạo/sửa trong phiên này
| File | Mô tả |
|------|-------|
| `src/lib/server/db/inventory.ts` | InventoryService mới (≈450 dòng): `listStock`, `getStock`, `adjustStock` (atomic update with race-condition handling), `recordStockMovement` (internal), `listLots`, `createLot`, `listBranches`. Dùng pattern y như `products.ts`: `ActorContext`, `PermissionChecker.can/getScope`, safe-field sanitizers, TranslateContent i18n messages. Chưa có type exports của InventoryStock/InventoryLot/StockMovement từ schema (dùng inline interface). |

## 4. Quyết định thiết kế & ràng buộc đã chốt
- **Schema** (schema.ts lines 392-435): `inventory_stock` keyed by `variantId + branchId` (không dùng productId). Fields: `quantityOnHand`, `quantityReserved`, `updatedAt`. `inventory_lots` theo lotNumber, có `expiresAt`, `manufacturedAt`. `stock_movements` log mọi in/out/reserve/release kèm `quantityBefore/After` để audit.
- **Phân quyền**: `inventory:read`, `inventory:adjust`, `inventory:manage` — scope `own_branch` hoặc `all` (PermissionChecker).
- **Race condition**: `adjustStock` dùng N1QL UPDATE có điều kiện `WHERE quantityOnHand = $current` để tránh lost update khi nhiều chi nhánh bán cùng variant. Nếu conflict → trả lỗi `updateFailed` (caller retry).
- **Document key convention**: `inventory_stock` dùng compound key tự sinh (N1QL select META().id). `inventory_lots` key: `${variantId}_${branchId}_${lotNumber}_${timestamp}`. `stock_movements` key: `${variantId}_${branchId}_${Date.now()}_${random}`.
- **Tên method**: consistent với `ProductAdminService` (list/get/create/update/delete prefix).
- **Lý do chọn**: giữ monolith, pattern đã verify ở ProductAdminService, Couchbase Data API, atomic conditional update cho race-condition.

## 5. Vấn đề / lỗi / TODO/FIXME
- ✅ Đã xử lý: schema.ts export types `InventoryStock`/`InventoryLot`/`StockMovement` (dòng 858-860); `InventoryService` export qua `index.ts`; 6 inventory routes đã có.
- ✅ Đã sửa (commit 68eb621f): 15 route phase4 (pos/sessions, promotions, stock-takes, customer/promotions/apply) từng import module không tồn tại `$modules/api/request-response` → viết lại theo pattern `$lib/server/admin/api` (readAdminRequest + getActorContext + respondEncrypted + statusForServiceFailure), thống nhất POST. svelte-check: 495 errors = baseline noise, 0 lỗi phase4.
- Còn mở: `recordStockMovement` dùng `lotId` = `lotNumber` (string) thay vì `_id` thật — cần thống nhất.
- Còn mở (thiết kế): `adjustStock` không retry tự động khi conflict — trả lỗi để client retry; cân nhắc thêm retry loop sau.

## 6. Bước tiếp theo (có thứ tự)
1. ✅ Export types + export service + API routes + type-check — HOÀN THÀNH (commits bf5ab942 → 2821a8ba + route fix 68eb621f).
2. **UI admin Phase 4** (việc còn lại duy nhất): inventory stock, orders, suppliers + purchase-orders, POS sessions, promotions, stock-takes — theo pattern trang admin hiện có (brands/products: DataTable + modal).
3. Smoke test runtime khi làm UI (dev server port 3001) — curl trần không dùng được vì `readAdminRequest` yêu cầu encrypted payload + actor context.

## 7. Lệnh kiểm tra & trạng thái git
```bash
# Type-check
npm run check

# Dev server (port 3001 tránh conflict main 3000)
npm run dev -- --port 3001 --host

# Test API (ví dụ)
# LƯU Ý: readAdminRequest yêu cầu encrypted payload + actor session — curl trần trả 4xx.
# Test qua UI admin hoặc probe Playwright (pattern tests/*.spec.ts có sẵn login + decrypt).

# Git
git status
git diff --stat
```

### Trạng thái git hiện tại (worktree phase4-multi-branch-inventory)
```
branch worktree-phase4-multi-branch-inventory, 7 commits:
2821a8ba feat: pricing engine, pos sessions, and stock takes - phase 4 complete
68eb621f fix(api): rewrite phase 4 routes to real admin api pattern  ← HEAD
(services: bf5ab942 → 9073c0d1 → 0ab3d1a4 → 0e7db5e4)
Working tree clean. svelte-check 495 errors = baseline noise, 0 lỗi phase4.

## B9 draft-store (autosave + restore form draft) — HOÀN THÀNH probe xanh 15/15
**Kết quả cuối (master 5986a918 + B9 WIP):** tests/draft-store-probe.mjs 15/15 PASS (DF0–DF10, 3 run liên tiếp ổn định, 0 pageerror).
**Root cause DF1–DF5 (autosave chết):** effect autosave B9 dùng `void formData;` — Svelte 5 KHÔNG track (đọc tham chiếu, không đọc property) → effect không re-run khi gõ → draft không bao giờ ghi localStorage → DF5 reopen không có dialog. FIX 5 file (brands/products/categories/variants +page.svelte + UserFormModal.svelte): thay `void formData;` bằng `void JSON.stringify(formData);` (stringify đọc từng property deep → track đúng) + comment giải thích. Settings page chạy đúng sẵn vì track qua `modified` ($derived JSON.stringify).
**Root cause DF2 (probe đo sai):** sau reload, settings-page hydrate ~3ms nhưng dialog mount sau ~800–1600ms (chờ API get chậm ~4s + draftAsked) → waitForSelector match settings-page trả NGAY, sleep(800) thua → probe đo `:visible` lúc 0 dialog. FIX probe: poll `[role="alertdialog"]:visible` timeout 10s thay sleep cứng.
**Bẫy DF6:** restore KHÔNG clear draft (hành vi cố ý — khớp settings page; save/discard mới clear) → lần mở đầu DF6 dialog hiện ngay; Discard mở modal create sạch (discardDraft đặt modalOpen=true) → probe KHÔNG click addBtn lần nữa sau Discard (modal-root intercepts pointer), fill trực tiếp.
**Bẫy môi trường:** dev server dễ chết (Couchbase ECONNRESET crash process / background task killed theo time limit) → restart `npm run dev -- --port 3000 --host` từ MAIN repo + warm 2 request trước probe; port 3000 có thể bị vite worktree chiếm (netstat -ano + Stop-Process PID). PartyKit :1999 không chạy chỉ ra console WebSocket error — vô hại với B9.
**Script debug:** tests/_scratch/df5-instrument.mjs (verify DF5+DF5a độc lập 2/2 PASS) + df2-*.mjs (chứng minh timing dialog) giữ lại tham khảo; tests/debug-df4.mjs + tests/debug-df5-modal.mjs xóa trước commit.
**Còn lại:** ui-checker screenshot dialog restore → commit B9 (app + tests tách commit, KHÔNG commit mongo_database_backup/ + test-results/).

m03701–m03706 B9 probe re-run (CŨ — ĐÃ GIẢI QUYẾT, xem section "B9 draft-store" phía trên): DF5 crash modal intercepts là modal create brand chưa đóng giữa các bước + draft còn sau restore; instrument df5-instrument.mjs đã chạy, root cause `void formData` không track Svelte 5. KHÔNG còn mở.

## 9. Đợt 6 tính năng bán hàng hiện đại — HOÀN THÀNH (2026-10-19, master d87ed1f6)

3 agents song song (A nhập hàng+expiry, B chi phí+camera, C analytics+catalog) + tôi đóng backlog liên kết.

| Nhóm | Kết quả | Trang admin |
|---|---|---|
| Nhập hàng đa kiểu | `receivePurchaseOrder` + `createQuickPurchase` (3 mode supplier/product/category) + `receiptImages` base64 ≤5 | `/admin/purchases` |
| Hạn sử dụng | `ExpiryService.listExpiringLots` (quá hạn/≤7/≤15/≤30) + `createClearancePromotion` | `/admin/expiry` |
| Chi phí vận hành | `ExpenseService` + collection `operating_expenses`, breakdown theo nhóm, ảnh hóa đơn nén ≤300KB | `/admin/expenses` |
| Camera MVP | `CameraService` Hikvision ISAPI (digest RFC2617 tự viết) / Dahua CGI / Ezviz unsupported; password AES-GCM; snapshot base64 không lưu DB | `/admin/cameras` |
| Thống kê | `AnalyticsService` (cost/supplier/volume/stock + forecast linear regression R²); collection `price_history`; 1 route `/api/admin/analytics/query` | `/admin/analytics` |
| Agent/LLM | `GET /api/agent/schema` owner-only sinh từ collectionSchemas + `AGENT-CATALOG.md` | — |

Sidebar: nhóm mới "Vận hành" (expenses/cameras) + "Nhập hàng" + "Hạn sử dụng" + "Thống kê". Permissions mới: `purchases:read/manage`, `expenses:read/manage`, `cameras:read/manage`, `analytics:read`.

**Kiểm tra:** svelte-check 367/148 (baseline 366/144, 0 lỗi mới), build PASS, hook analytics `d87ed1f6` (recordFromPurchase vào receive + quick purchase).

**Backlog mở:** lọc categoryId trong listExpiringLots (cần join products); seed `promotions:*` permissions rồi chuyển createClearancePromotion qua PricingService; HLS stream camera + Ezviz OpenAPI + scheduler test định kỳ; dự báo ML/seasonality; webhook/API key agent ngoài.

**Bẫy đợt này:** `InventoryService.createLot` không cộng `inventory_stock` → receive tự tạo lot + upsert stock + 1 movement (tránh double-log); `@undecaf/barcode-detector-polyfill` thiếu trong package.json (build vỡ sau reinstall) — đã cài `5fcdc119`; khi Edit chuỗi return legacy trùng 2 chỗ → thêm context xung quanh.

## 10. Sửa lỗi svelte-check + UI trực quan — XONG (2026-10-20, master 81d1041d)

**svelte-check: 367 → 195 errors** (12 commits). 195 còn lại là noise có chủ đích: `_old`/`Main_` ~110, test files ~24, 4 layout cũ (MenuBar/NavigationBar/FooterEnhanced/AppShell — đã vô hiệu hóa export trong `layout/index.ts` vì không còn caller). Build PASS.

**2 bug runtime thật (81d1041d):**
1. Login vỡ hoàn toàn: `public-key/+server.ts` cast `'system_secrets'` sai — vault thật ở env `cb_collectionName_vault` ('vaults') → CollectionNotFound → client không lấy được RSA key. Fix theo pattern initSystemVault.ts:20.
2. Seed thiếu 9 permission key services dùng: `inventory:read/:manage`, `stock_takes:read/:manage`, `suppliers:read`, `pos:read/:manage`, `promotions:read/:manage` (mismatch do service Phase 4 + seed viết riêng). Đã sửa seed-data.ts + seed trực tiếp DB qua N1QL UPSERT (20/20 grants). Backlog cũ "seed promotions:*" ĐÃ ĐÓNG.

**UI check 10/10 trang admin ĐẠT** (ui-checker, ảnh v3 trong tests/_ui-shots/): purchases/expiry/expenses/cameras/analytics/inventory/suppliers/promotions/pos-sessions/stock-takes — hết Loading, đúng empty state hoặc dữ liệu thật (inventory 8+ dòng, suppliers 11+, pos 1 phiên Open). Bẫy: chụp sau networkidle 3.5s vẫn quá sớm (5/10 trang còn Loading) → phải poll body text hết "Loading" rồi chụp; ui-checker max 8 ảnh/prompt → chia 5 ảnh/đợt.

## 11. Hoàn thiện chức năng còn thiếu + đồng bộ UI/UX toàn hệ thống — XONG (2026-10-21, master 67abc554)

Task user: chia 5 agents hoàn thành toàn bộ chức năng thiếu, đồng bộ UI/UX, tái sử dụng component có sẵn. **Cả 5 xong, check 195 baseline, build PASS.**

- **A — Chuyển kho + Đổi trả** (6 commits `ef584448`…`715fa9fe`): schema thêm originBranchId/returnBranchId, transfers.ts 602d + returns.ts 569d + 12 routes, UI /admin/transfers + /admin/returns, seed 14/14, probe 13/13 PASS (approve trừ kho FROM conditional N1QL, complete cộng kho TO, return hoàn kho, movement log đủ). db-broadcast thêm stock_transfers|order_returns.
- **B/B2 — POS Terminal /admin/pos** (4 commits `0f063750`…`67abc554`): search barcode/tên, giỏ, 7 phương thức thanh toán (bank_transfer→payment pending, loyalty_points/cod OK), tiền thừa numpad, checkout tạo order paid + trừ tồn CAS + payment doc + session totals. Probe 24/24 PASS idempotent (tồn 6→5, ORD-...-8899 paid, PAY-...-95E9, session +50.000). B chết do transcript nhiễm ảnh (400 model nvidia) → B2 transcript sạch hoàn thiện nốt.
- **C/C2 — Storefront** (C chết như B → C2 verify + fix 5 bug commit `77b792fb`): guard `/storefront`→`/store` (hooks.server.ts:107), `p._id`→`META(p).id` (products.ts:1100 + api get), search fan-out 24 query→1 batch IN (32 variants 817ms), CartDocument.branchId nullable. Probe 18/18 PASS 2 lần. [id] detail, /store/account, /store/search, homepage featured 8.
- **D — Đồng bộ 14 trang admin → DataTable** (12 commits `713b114`…`0401bb75`): promotions/payments/shipments/fulfillment/notifications/posts/social/campaigns/suppliers(2 tab)/purchases/expiry(selection API selectable+getRowId)/pos-sessions/stock-takes/inventory(2 tab). messages giữ chat layout chỉ thay Pagination. Bẫy: bỏ nhánh empty bọc bảng (purchases), actions width:1%+min-width:fit-content, error→danger map, shared Pagination qua currentPagingPage + armed-guard.
- **E — PWA + TV /display + passkey UI** (4 commits `d969aaea`…`63dcc588`): manifest+sw+icons+offline, /display auto-refresh 60s + reload 30p + session-guard + 1920px, passkey i18n. Probe 20/20 PASS.

**Infra ui-checker chết toàn phần đợt này** (9+3 lần thử: "Part of the response never arrived" cả 1 ảnh lẫn 8 ảnh) → mọi agent dùng DOM-probe thay thế làm bằng chứng. 19 ảnh giữ trong `tests/_ui-shots/` chờ infra hồi phục đọc lại.

Backlog mới: notifications mất row-unread bold (DataTable không hỗ trợ custom row class); PartyKit ws console noise (HTTP fallback chạy); search storefront còn chậm ~15s (encrypt+couchbase).

## 12. Hoàn thiện 8 mục bán hàng hiện đại — đợt 1+2 XONG (2026-10-16, master c3ea687f)

Task user (8 mục): công nợ, admin UX, QR payment, nhập hàng nâng cấp, PartyServer, ecommerce đa kênh, POS cửa hàng, UI-check lại. 7 agents (F/G/I/H2/J/K/L), check 217 = toàn noise nền (0 lỗi file mới, xác minh bằng snapshot grep), build PASS.

**ĐỢT 1 (4 agents):**
- **F — Công nợ 2 chiều** (4 commits `84ccaa5f`…`dc45bd7c`): collections debts + debt_payments, DebtService (conditional N1QL chống race), 6 API, trang /admin/debts 1 trang 2 tab AR/AP + 4 summary cards + modal trả dần. Probe 12/12 (partial/settled/chặn xóa khi có payment). Bẫy: customers nằm trong collection users (không có 'customers'); Playwright locale en-US → set vi-VN; skeleton DataTable 6-8s poll waitForRealRow.
- **G — Admin UX** (10 commits `4566aeb0`…`4294b442`): header thu gọn khi scroll (threshold 80px, title 1.75→1.25rem, subtitle collapse max-height+opacity, 200ms, không sticky — 1 rule :global qua .admin-inset.is-scrolled); xoá page-info 28 file (grep 0 match); 20 trang DataTable bật sortable+searchable vi/en+resizable {enabled,fit}. Probe 17/17 đo computed style 3 pha.
- **I — Nhập hàng nâng cấp** (4 commits `03c11b8d`…`e4eb6c00`): voucher NCC money/gift theo dòng + money theo phiếu, quà tặng cộng tồn (lot suffix -gift), phân bổ giá vốn unitCostEffective = netCost/tổng đơn vị thực nhận, backward compat. UI modal 3 bước accordion STT + search variant + barcode scan tự điền + tạo-mới Lark-style. Probe 25/25 (giá vốn 1000 = (170k−50k−100k)/20). Bẫy: HMR full-reload reset $state → probe retry ≤3.
- **H2 — QR payment** (4 commits `1df93902`…`178735a9`, H chết dở do session end, H2 hoàn thiện + sửa 3 bug của H: method e_wallet bị sót trong QR_PAYMENT_METHODS/QR_CHECK_METHODS — payment POS momo không bao giờ được poll; body stream consumed → text() 1 lần; momo POS giờ pending chờ đối soát): QrPaymentService adapter config-driven .env QR_CHECKER_* (URL/AUTH/AUTH_HEADER/METHOD/QUERY_FIELD/RESPONSE_MAP/SUCCESS_VALUES/CONTENT_FIELD/AUTO_POLL/POLL_INTERVAL_MS/POLL_BATCH), QR sinh qrcode data URL tại POS+storefront, auto-poll server setInterval guard config, nút Check QR admin payments, conditional pending→completed KHÔNG bao giờ ngược. Probe 13/13 (idempotent re-check, tool PENDING giữ pending). Cần user điền URL tool Python khi sẵn sàng.

**ĐỢT 2 (3 agents):**
- **J — PartyServer** (2 commits `d1ba6098`+`9eb16f1a` + main dọn index `9eaa5887`): migrate partykit/server → partyserver@0.5.10 (class Main extends Server, wrangler.jsonc DO binding, routePartykitRequest /parties/main/:room), client partysocket KHÔNG đổi, server push đổi URL /parties/main/*. Local e2e 10/10 (wrangler dev 8787: 401/400/POST key/WS broadcast/GET key/db-change broadcast/key-update bị ignore giữ bảo mật). Unit 22/22. **Deploy CHỜ TOKEN Cloudflare mới** (token .env:41 hết hạn code 9109) — 7 bước deploy ghi trong báo cáo J (wrangler deploy → secret put PARTYKIT_INTERNAL_TOKEN → test prod → update .env:45-46 → restart server). .env hiện trỏ 127.0.0.1:8787 (cần restart server để reload).
- **K — Ecommerce đa kênh** (4 commits `672cbefa`…`1774a50e`): collections channel_accounts (credentials AES-GCM, API chỉ trả hasCredentials) + channel_orders, ChannelService 639d, 9 adapters mock-mode (shopee/tiktok_shop/facebook/lazada/threads/instagram/telegram/discord/google, env CHANNEL_<NAME>_* điền khi có key — mock tự tắt), import match channelSku→variant tạo order CH-YYYYMMDD-XXXX pending không trừ kho, dedup. UI /admin/channels card grid + form động + DataTable + nút Import. Probe 16/16 (RBAC staff/read-only, credentials không lộ). Bẫy LỚN: init-indexes.ts thiếu IF NOT EXISTS → thêm collection crash-loop N1QL 4360 (đã fix); Data API KHÔNG nhận named args object (positional $1/$2 + array); N1QL fail ÂM THẦM (HTTP 200 ok:true nhưng errors[] trong body — phải truyền args kèm statement); LIMIT/OFFSET không nhận named param.
- **L — POS nghiệp vụ cửa hàng** (3 commits `eed63ceb`…`c3ea687f`, 2 lần API upstream truncated → resume): 8/8 gap — search LIKE + Enter thêm giỏ + tồn kho variant batch N1QL IN, giỏ sửa SL + giảm giá dòng/đơn VND + cảnh báo quá tồn + notes, **split payments max 4 line** (Σ khớp mới submit, mỗi line 1 payment doc, QR→pending), receipt khổ 58/80mm window.print @media print, phím tắt F2/F3/F4/Ctrl+Enter/Esc, chip session, picker khách (API pos/customers permission-free staff). Bug thật: getCurrentSession KHÔNG match khi actor.branchId null (Data API drop args null → tách 2 nhánh query + ORDER BY openedAt DESC). Probe v2 32/32 + regression cũ 24/24 (3 lần). GIỮ 100% data-test cũ.

**Backlog mở:** deploy PartyServer chờ token CF; adapters 9 kênh chờ API keys thật; QR_CHECKER_URL chờ tool Python user; ui-checker chết infra lại (L thử 3 lần 400 model nvidia + hết quota aihubmix) → ảnh pos-v2-*.png + channel-*.png + debt-*.png chờ đọc lại; combo trừ tồn theo thành phần; loyalty_transactions không service; login chưa cấp refresh token.

## 13. Upload e2c + sticky wide-screen + webhook QR — XONG (2026-10-20, master 78c5ca97)

Task user 4 mục: (1) file/image upload e2c giống hệ thống, (2) admin wide-screen giữ header datatable khi scroll tối đa rows, (3) IMAGE_HOST_TOKEN đã điền, (4) việc còn lại (webhook QR). Check 218 = baseline noise (0 lỗi file mới), build PASS.

- **Upload e2c** (commit `4647291e` + sticky batch): host HF Space trả `{"data":"[{'__typename':'ImageModule',...'src':'https://...'}]"}` — data là STRING python-dict (single quotes) không parse JSON được → route /api/admin/upload thêm nhánh regex trích src/url/link/image. e2e: upload PNG 400x300 → 200 URL behance CDN render công khai. ImageUpload (upload + preview + xoá) gắn đủ 5 form: products imageUrl, posts coverImageUrl, brands logoUrl, variants imageUrl (2 form cuối mới đổi từ Input URL tay).
- **Sticky wide-screen** (commit `a5dd7637`, 24 files): BẪY LỚN 1 — rule sticky thead scoped trong datatable/Main.svelte lồng `.datatable-th` compile với hash Main KHÔNG match th (th mang hash Head) → đổi `:global(.datatable-th)` cả 2 media. BẪY 2 — Select filter scoped trang không match (element mang hash Select) → width 100% mặc định thắng wrap 4 hàng → nhắm qua anchor `.admin-filters :global(.admin-filter-select)` width auto/16rem (products+purchases). BẪY 3 — `.admin-table-wrap` overflow-x:auto tạo scroll context → th sticky bám wrap trượt mất → 20 trang `&:has(:global(.datatable-sticky-head)) { overflow-x: visible; }` media 768+ (cú pháp `:global(...) &` SAI HƯỚNG — wrap là CHA của datatable-root, phải &:has). Debts fix tay overflow:auto→visible. Kết quả products: thTop 124 = filtersBottom 124 gap 0, 20 rows hiển thị; brands +24 / orders −24 chấp nhận; inventory 0.
- **Webhook QR** (commit `78c5ca97`): POST /api/webhooks/qr-payment — tool đối soát user PUSH kết quả vào app (chiều ngược qr/check). Header QR_WEBHOOK_HEADER (default Authorization) Bearer QR_WEBHOOK_TOKEN (rỗng → 404 ẩn route); payload linh hoạt {paymentCode|id|reference, amount?, status?, paidAt?} + responseMap; lookup N1QL theo paymentCode (documentKey KHÔNG phải paymentCode); conditional pending→completed + order paymentStatus=paid; idempotent already_confirmed; sai amount 409; hooks publicPaths thêm /api/webhooks/qr-payment. Probe tests/probe-qr-webhook.mjs 10/10 (token test qt_qrwebhook_9f4c2a71 trong .env). BẪY: env load lúc server start — thêm env mới phải restart server; probe networkidle timeout khi cold compile lần đầu (chạy lại thì pass).
- **UI-check (ui-checker):** 3/3 ĐẠT — products (thead dính dưới filter, 13 dòng, subtitle collapse OK), inventory (filter 1 hàng, 13 dòng), purchases v2 (date fix xong filtersH 140→40px). Ảnh zoom đỉnh: 'dải chữ cắt đôi' KHÔNG tái hiện — hành vi cuộn bình thường. Fix theo phát hiện ui-checker: purchases date input full-width vì `.admin-input` (width:100%) viết SAU `.admin-date` cùng specificity (0,1,0) → `.admin-input.admin-date` tăng specificity (commit `d2313ade`).
- Còn mở: S4–S7 re-probe sticky khi Capella ổn định; API keys 9 kênh chờ user; login chưa cấp refresh token.

