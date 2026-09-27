## Trạng thái công việc tại thời điểm ghi chú (Cập nhật 2026-09-27)

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

### Task 2: Merge phase 2 worktrees vào master
- Trạng thái: **HOÀN THÀNH** (6dc0a8d merge fast-forward, 52 files)

### Task 3: Phase 3 (UI/UX Design Foundation) — Bắt đầu
- Trạng thái: **ĐANG LÀM**
- Đã tạo `DESIGN.md` — nền tảng thiết kế: design tokens, component patterns, a11y guidelines
- Đã khám phá component library: Button, Input, Tooltip, Checkbox (compound component pattern)
- Bước tiếp theo: audit component library, migrate tokens, TV/kiosk design language

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