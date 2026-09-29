# HANDOFF — Phase 4 Multi-branch Inventory System (worktree phase4-multi-branch-inventory)

## 1. Mục tiêu & Phase
- Phase: **4 — Core Retail Data Model & Operations**
- Task hiện tại: **#27 Multi-branch Inventory System** (đang làm)
- Mục tiêu: Build InventoryService (server db layer) + API routes cho tồn kho đa chi nhánh.

## 2. Trạng thái task (theo todo list)
| Task | Trạng thái |
|------|------------|
| #27 Multi-branch Inventory System | **in_progress** |
| #28 Order Management API & UI | pending |
| #29 Supplier & Purchasing (PO) System | pending |
| #30 Pricing Engine & Promotions | pending |
| #31 POS Sessions (Cash Drawer Management) | pending |
| #32 Stock Takes (Inventory Audit) | pending |
| #40 InventoryService (server db layer) | **đã tạo file** |

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
- `inventory.ts` đang import type `InventoryStock`, `InventoryLot`, `StockMovement`, `Branch` từ `$modules/schema` nhưng schema.ts **chưa export** các type này (chỉ export `CollectionName` + `collectionSchemas`). Cần thêm type definitions hoặc export type từ schema.
- `recordStockMovement` dùng `lotId` là `lotNumber` (string) thay vì `_id` thật — cần thống nhất.
- `adjustStock` chưa retry tự động khi conflict (trả lỗi để client retry) — có thể thêm retry loop.
- Chưa tạo API routes (`src/routes/api/admin/inventory/*`) và export service từ `src/lib/server/db/index.ts`.

## 6. Bước tiếp theo (có thứ tự)
1. **Export types từ schema.ts** — thêm `export type InventoryStock = ...` cho 4 collection liên quan.
2. **Export InventoryService** trong `src/lib/server/db/index.ts` (thêm `export { InventoryService } from './inventory';`).
3. **Tạo API routes** (mỗi route 1 file `+server.ts`):
   - `GET  /api/admin/inventory/stock/list` → `InventoryService.listStock` (query: branchId, variantId, page, pageSize, includeZero)
   - `GET  /api/admin/inventory/stock/get` → `InventoryService.getStock` (query: variantId, branchId)
   - `POST /api/admin/inventory/stock/adjust` → `InventoryService.adjustStock` (body: variantId, branchId, change, referenceType, referenceId, note)
   - `GET  /api/admin/inventory/lots/list` → `InventoryService.listLots`
   - `POST /api/admin/inventory/lots/create` → `InventoryService.createLot`
   - `GET  /api/admin/inventory/branches` → `InventoryService.listBranches`
   - Tất cả dùng `readAdminRequest`, `getActorContext`, `PermissionChecker.can`, `respondEncrypted` pattern như products.
4. **Type-check**: `npm run check` (svelte-check) và `npx tsc --noEmit`.
5. **Chạy dev server** test manual: `npm run dev -- --port 3001 --host` → curl API endpoints.
6. **Commit & push** worktree branch.

## 7. Lệnh kiểm tra & trạng thái git
```bash
# Type-check
npm run check

# Dev server (port 3001 tránh conflict main 3000)
npm run dev -- --port 3001 --host

# Test API (ví dụ)
curl -k https://localhost:3001/api/admin/inventory/stock/list

# Git
git status
git diff --stat
```

### Trạng thái git hiện tại (worktree phase4-multi-branch-inventory)
```
$ git status --short
?? src/lib/server/db/inventory.ts
```
Chỉ có file mới `inventory.ts` (chưa commit).