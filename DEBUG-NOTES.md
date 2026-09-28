## Trạng thái công việc tại thời điểm ghi chú (Cập nhật 2026-09-28)

### Task 1: Run Playwright UI check trên port 3000
- Trạng thái: **HOÀN THÀNH** (61 passed, 2 skipped)
- Root cause: webServer block dùng `'echo "Server already running"'` — exit code 0 nhưng không start server → timeout 120s
- Fix: xóa webServer block hoàn toàn (dev server chạy sẵn trên port 3000)
- Playwright config: `playwright.ui-check.config.ts` đã có baseURL đúng (`https://localhost:3000`)
- Chạy test: `npx playwright test tests/ui-check.spec.ts tests/ui-check-v2.spec.ts --reporter=line`
  - 61 passed, 2 skipped (webkit clipboard test)
  - Tất cả browser engines (chromium, firefox, webkit) đều pass
- Screenshot được lưu trong `test-results-ui-check/`
- `NODE_EXTRA_CA_CERTS` cần thiết cho HTTPS self-signed: `C:/Users/Phuon/AppData/Local/mkcert/rootCA.pem`

### Task 1b: Run Playwright UI check trên worktree token-migration (port 3007) — **HOÀN THÀNH 2026-09-28**
- Trạng thái: **HOÀN THÀNH** (33 passed on ui-check.spec.ts, 28 passed + 2 skipped on ui-check-v2.spec.ts)
- Vấn đề: Dev server main repo (port 3007) vẫn dùng file navigation-bar cũ gây lỗi Svelte compile
- Fix: Cập nhật `playwright.ui-check.config.ts` hardcode `baseURL: "https://localhost:3007"` thay vì dùng env var
- Navigation-bar component đã fix ở worktree (filteredItems + hasRole function) nhưng main repo chưa sync
- Tất cả 3 browser engines (chromium, firefox, webkit) pass cho cả 2 test files

### Task 2: Merge phase 2 worktrees vào master
- Trạng thái: **HOÀN THÀNH** (6dc0a8d merge fast-forward, 52 files)

### Task 3: Phase 3 (UI/UX Design Foundation) — Đang làm
- Trạng thái: **HOÀN THÀNH** (2026-09-28)
- Đã tạo `DESIGN.md` — nền tảng thiết kế: design tokens, component patterns, a11y guidelines
- Đã khám phá component library: Button, Input, Tooltip, Checkbox (compound component pattern)
- Đã audit thành phần: `COMPONENT-AUDIT.md` — 8 components audited vs DESIGN.md patterns
  - Button ✅ full compliance, Input ✅ full compliance, Tooltip ✅ full compliance, Checkbox ✅ full compliance
  - Skeleton ✅, Loading ✅, Toast ✅, Icon ✅
  - Gaps: animation tokens, hardcoded values, variant expansion, formal a11y audit
- **Token migration completed (2026-09-28)**: 
  - Layout components: MenuBar, NavigationBar, FooterEnhanced — all hardcoded values replaced with design tokens
  - Core components: Button, Input, Tooltip, Checkbox, Skeleton, Loading, Toast, Icon — all using CSS variables from variables.scss/sizes.scss/colors.scss
  - Worktree: `token-migration` — all changes isolated
- **Files modified/added**:
  - Modified: checkbox/Indicator/Main.svelte (1.25rem → var(--min-height-sm), 2px → var(--border-width-md))
  - Modified: checkbox/Indicator/Checked/Main.svelte (1.25rem → var(--min-height-sm))
  - Modified: toast/Main.svelte (added background/color/box-shadow tokens)
  - Modified: toast/Content/Description/Main.svelte (verified token usage)
  - Modified: checkbox/Main.svelte (verified token usage)
  - New: layout/menu-bar/Main.svelte (full tokenized)
  - New: layout/navigation-bar/Main.svelte (full tokenized, fixed layout thrash)
  - New: layout/footer-enhanced/Main.svelte (full tokenized)
  - New: tests/ui-check.spec.ts, ui-check-v2.spec.ts (UI check test suite)
  - New: playwright.ui-check.config.ts (config for worktree)
  - New: .env (Couchbase credentials for dev server)

### Task 4: Phase 4 (Core Retail Data Model & Operations) — Product Catalog API **HOÀN THÀNH** (2026-09-28)
- Trạng thái: **API HOÀN THÀNH** — 20 endpoints (5 CRUD × 4 entities)
- **ProductAdminService** (`src/lib/server/db/products.ts`): ~1000 lines
  - Products: list, getById, create, update, delete (with validation, soft delete, variant check)
  - Variants: listVariants, getVariantById, createVariant, updateVariant, deleteVariant (SKU unique, inventory check)
  - Categories: listCategories, getCategoryById, createCategory, updateCategory, deleteCategory (slug unique, circular parent check, children/products check)
  - Brands: listBrands, getBrandById, createBrand, updateBrand, deleteBrand (slug unique, products check)
  - All with PermissionChecker (`products:read`, `products:create`, `products:update`, `products:delete`)
  - Input validation: unique SKU/slug, referential integrity, circular reference prevention
  - Soft deletes with deletedAt timestamp
  - Sanitized admin-safe field selection
  - Pagination, search, filtering support
- **API Routes** (20 endpoints):
  - Products: `/api/admin/products/{list,create,detail,update,delete}`
  - Variants: `/api/admin/variants/{list,create,detail,update,delete}`
  - Categories: `/api/admin/categories/{list,create,detail,update,delete}`
  - Brands: `/api/admin/brands/{list,create,detail,update,delete}`
  - Pattern: readAdminRequest → getActorContext → PermissionChecker.can → Service method → respondEncrypted
  - Consistent with users API pattern, hybrid encryption (RSA + AES)
- **Files created/updated**:
  - `src/lib/server/db/products.ts` — ProductAdminService
  - `src/lib/server/db/tokens.ts` — Refresh token management (findRefreshToken, rotateRefreshToken, revokeRefreshToken, createRefreshToken)
  - `src/lib/server/db/index.ts` — Export tokens module
  - `src/lib/server/admin/api.ts` — Admin API helpers (copied from main repo)
  - `src/lib/server/rate-limit.ts` — Rate limiting (copied from main repo)
  - `src/lib/server/db/users.ts` — Export adminMessages, authMessages (fixed export)
  - 20 API route files under `src/routes/api/admin/{products,variants,categories,brands}/`
  - `src/hooks.server.ts` — Fixed top-level await with initPromise pattern
- **Build**: SvelteKit build successful (warnings only, no errors)

### Các fix đã áp dụng trong session này
1. **partysocket missing** → `npm install` fix (Phase 2 merge mất node_modules)
2. **Login "Decryption returned empty"** → `src/routes/api/login/+server.ts` viết lại: detect plain JSON dev login (has username/password) vs encrypted blob; plain JSON path không gọi `decryptWithPrivateKeyHybrid`
3. **Authorized layout trắng** → `src/routes/(authorized)/+layout.svelte` thêm `{@render children()}`
4. **RBAC N1QL reserved words** → `permission-checker.ts`, `users.ts` fix `scope`/`level` reserved words dùng `SELECT *` + unwrap pattern
5. **Playwright webServer timeout** → xóa `webServer` block dùng `echo` command trong `playwright.ui-check.config.ts`

### Commit history liên quan
- `855a617` (worktree): fix(ui-check): remove broken webServer echo command
- `7c8e485` (master): fix(ui-check): remove broken webServer echo command
- `008d7cc`: fix(ui): handle plain JSON login for dev environment
- `6dc0a8d`: docs(phase2): record verification status — 3 root-cause bugs fixed, E2E green
- `8225f95`: fix(rbac,n1ql): reserved words break grants/roles queries; empty authorized layout renders blank pages

### Cấu hình liên quan đã thiết lập trong session này
- Subagent `ui-checker` (.claude/agents/ui-checker.md): dùng model nvidia-vision (combo glm-5.3-flash), CHỈ dùng để đọc/mô tả screenshot đã có sẵn trên đĩa, KHÔNG dùng cho việc grep/đọc code
- Agent chính dùng combo "nvidia" (glm-5.3) cho code/text, có đầy đủ tool Playwright

Ghi đầy đủ, không tóm tắt quá ngắn — đây là để tiếp tục công việc ở session mới.