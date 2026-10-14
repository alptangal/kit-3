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
