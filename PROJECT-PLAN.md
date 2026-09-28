# KẾ HOẠCH DỰ ÁN - ROADMAP TỔNG HỢP (Mở rộng)

## Tổng quan

Dự án SvelteKit (SvelteKit 5, Svelte 5, TypeScript) xây dựng webapp đa thiết bị (mobile/PC/TV) phục vụ chuỗi bán lẻ, kết hợp bán hàng truyền thống (POS tại quầy) và thương mại điện tử (omnichannel), có theo dõi hành vi người dùng để tối ưu UX. Dữ liệu lưu trên Couchbase Capella, realtime qua PartyKit. Team hiện tại: 1 người (Alpha) — mọi quyết định kiến trúc ưu tiên đơn giản, dễ bảo trì một mình.

Roadmap được chia theo phase, mỗi phase là 1 nhánh Git/worktree riêng.

---

## Danh sách các phase

### Phase 1: Foundation Authentication — _HOÀN THÀNH_

- User registration/login email/password, JWT, password hashing/salt, route protection cơ bản
- Worktree: `phase1-foundation`
- Commit mẫu: `e1dad61 refactor(email): EmailService interface + dev/smtp transports`, `aba03af feat(auth): reset-password flow with token + dev email outbox`

### Phase 2: Authorization & Role Management — _ĐANG LÀM (verification ongoing)_

- RBAC nhiều role level, permission checking + grants caching, user admin flows, role assignment
- Worktree: `continue-phase2-verification`
- Commit mẫu: `8557e2a docs: phase-2 auth-completion implementation plan`, `37a785e Add auth E2E test suite, Playwright config and CI workflow`, `08eb4c3 Refactor auth: AuthLayout, forgot-password flow, server i18n`
- Thứ tự merge: chỉ cần merge `continue-phase2-verification` → master (`phase1-foundation` đã được salvage vào master qua commit `1706d97`, giữ lại để tham khảo, không cần merge)

### Cross-cutting: Error Handling & i18n Foundation _(chèn trước Phase 3, áp dụng xuyên suốt)_

- **i18n**: `paraglide-js` hoặc `svelte-i18n`, tách namespace theo domain (auth/retail/checkout/admin); quyết định URL-based locale (`/vi/...`, `/en/...`) vì ảnh hưởng SEO storefront
- **Error handling server-side**: Error class hierarchy (`AppError`, `ValidationError`, `AuthError`...), middleware bắt lỗi tập trung trong `hooks.server.ts`, structured logging
- **Error handling client-side**: `<svelte:boundary>`, toast/notification system, error code → message đa ngôn ngữ, tách message hiển thị user khỏi log nội bộ
- Nên hoàn thành trước khi code Phase 3 phình to — sửa sớm rẻ hơn refactor muộn

### Phase 3: UI/UX Design Foundation _(MỚI — làm trước Core Retail Operations)_

- **Mục tiêu**: chốt nền tảng thiết kế trước khi code nghiệp vụ, tránh phải refactor component nhiều lần khi UI thay đổi sau
- **Design system**: quyết định tái dùng Svelte component library (compound-component pattern) đã có làm nền, hay tách biệt cho dự án này; định nghĩa design token (màu, spacing, typography) dùng chung
- **Wireframe/user flow theo từng role**: Owner, Quản lý chi nhánh, Thu ngân, Nhân viên kho, và khách hàng (storefront) — mỗi role có luồng thao tác khác nhau
- **Màn hình TV/kiosk**: thiết kế riêng từ đầu (không tái dùng layout PC) — dashboard cửa hàng, digital signage, tối ưu cho không tương tác chuột
- **Hai design language dùng chung token**: POS (thao tác nhanh, ít bước, ưu tiên tốc độ) và storefront khách hàng (thẩm mỹ, thuyết phục mua hàng) — mục tiêu UX khác nhau
- **Accessibility (a11y)**: contrast, touch target size cho tablet POS, keyboard navigation cho PC admin — tính từ đầu vì phục vụ đa thiết bị
- _Lưu ý_: đây là nơi dữ liệu từ Phase 8 (Analytics/Behavior Tracking) sẽ quay lại phục vụ — vòng lặp theo dõi hành vi → phát hiện điểm nghẽn → thiết kế lại chỉ có ý nghĩa khi có nền tảng thiết kế ban đầu để so sánh

**CẬP NHẬT 2026-09-28**: Token migration completed for all layout and core components. Worktree: `token-migration`

**Files modified (hardcoded values → design tokens)**:
- `src/lib/components/form/checkbox/Indicator/Main.svelte`: `1.25rem` → `var(--min-height-sm)`, `2px` → `var(--border-width-md)`
- `src/lib/components/form/checkbox/Indicator/Checked/Main.svelte`: `1.25rem` → `var(--min-height-sm)`
- `src/lib/components/element/toast/Main.svelte`: added `background: var(--background)`, `color: var(--foreground)`, `box-shadow: var(--box-shadow-md)`
- `src/lib/components/element/toast/Content/Description/Main.svelte`: verified token usage (`var(--font-size)`, `var(--color)`)
- `src/lib/components/form/checkbox/Main.svelte`: verified token usage

**New layout components (fully tokenized from design)**:
- `src/lib/components/layout/menu-bar/Main.svelte` — uses `--padding-md`, `--padding-lg`, `--min-height-lg`, `--gap-md`, `--min-height-md`, `--radius-full`, `--font-size-sm`, `--font-size-xs`, `--padding-xs`, `--padding-sm`, `--foreground`, `--foreground-400`, `--foreground-200`, `--radius-sm`, `--danger-500`, `--color-white`, `--min-height-xs`
- `src/lib/components/layout/navigation-bar/Main.svelte` — uses `--nav-width`, `--padding-md`, `--gap-sm`, `--padding-sm`, `--gap-md`, `--radius-sm`, `--font-size-xl`, `--font-size-sm`, `--font-size-md`, `--min-height-lg`, `--foreground`, `--foreground-200`, `--background`, `--border`, `--border-width`, `--offset`, `--min-height-lg`, `--font-size-2xl`, `--color-white`; **fixed layout thrash** (hover animation uses `transform: translateX(var(--gap-sm))` instead of `padding-left`)
- `src/lib/components/layout/footer-enhanced/Main.svelte` — uses `--padding-xl`, `--padding-md`, `--gap-md`, `--font-size-xs`, `--font-size-sm`, `--gap-sm`, `--foreground`, `--foreground-400`, `--background`, `--border`, `--border-width`

**Core components verified using design tokens** (8/8):
- Button, Input, Tooltip, Checkbox, Skeleton, Loading, Toast, Icon — all using CSS variables from `variables.scss`, `sizes.scss`, `colors.scss`

**Playwright UI Check Tests — HOÀN THÀNH 2026-09-28**:
- `tests/ui-check.spec.ts`: 33 passed (chromium 11, firefox 11, webkit 11) on port 3007
- `tests/ui-check-v2.spec.ts`: 28 passed + 2 skipped (webkit clipboard test) across 3 browsers
- Config: `playwright.ui-check.config.ts` hardcode `baseURL: "https://localhost:3007"` for worktree dev server
- All tokenized components verified visually across chromium, firefox, webkit

### Phase 4: Core Retail Data Model & Operations

- Product catalog (sản phẩm, biến thể, category, combo/bundle)
- Inventory đa chi nhánh (tồn kho theo location, yêu cầu chuyển kho có duyệt, reservation tránh oversell)
- Order management (trạng thái pending/paid/fulfilled/returned)
- Supplier & purchasing (nhập hàng, phiếu PO)
- Pricing engine (giá theo chi nhánh, khuyến mãi)
- Ca làm việc thu ngân (mở/đóng ca, đối soát tiền mặt)
- Kiểm kê kho 2 cấp (weekly branch / monthly cross-branch) với routing duyệt theo ngưỡng chênh lệch
- _Mô hình tồn kho_: single source per branch, filter qua `branchId`, chưa cần tenant isolation ở quy mô 2-10 chi nhánh

### Phase 5: Omnichannel E-commerce + Realtime Layer mở rộng

- Storefront khách hàng: giỏ hàng, checkout, tài khoản (tái dùng auth Phase 1-2)
- Thanh toán: tiền mặt, thẻ qua POS ngân hàng (`bank_pos`), Momo/ZaloPay QR, chuyển khoản (đối soát thủ công), COD cho đơn online
- Click-and-collect: trạng thái đơn `awaiting_pickup`, chi phí triển khai gần bằng 0
- Giao vận: tích hợp bên thứ 3 (GHN/GHTK/Ahamove) qua webhook, không tự vận hành đội giao hàng
- Đơn hàng hợp nhất: một hệ thống order cho cả POS và online
- **Realtime qua PartyKit** (mở rộng từ payment notification server hiện có) thành hub chung:
  - Notification system: đẩy thông báo hệ thống theo room (role/chi nhánh)
  - Chat nội bộ nhân viên + CSKH ↔ khách hàng
  - Live admin dashboard: cập nhật tồn kho/đơn hàng real-time, tránh xung đột nhiều người sửa cùng lúc
  - Cần chốt: room strategy (theo chi nhánh/role) và cơ chế reconnect/offline queue cho POS khi mất mạng tạm thời

### Phase 6: Multi-Device Experience Layer

- Responsive/adaptive breakpoint riêng mobile/tablet/PC (áp dụng design token đã chốt ở Phase 3)
- Chế độ TV/kiosk: route riêng (vd `/display`) cho dashboard cửa hàng, digital signage
- PWA cho mobile: offline-capable cho nhân viên bán hàng khi mất mạng tạm thời
- Input method khác nhau theo thiết bị: touch (POS tablet), mouse/keyboard (admin PC), remote (TV)

### Phase 7: Enhanced Security & MFA

- MFA (TOTP/WebAuthn), advanced encryption key rotation, session management improvements, rate limiting/brute-force protection

### Phase 7.5: Observability & Error Monitoring

- Server monitoring: metrics (CPU/memory/response time), health check endpoint (Prometheus+Grafana self-host hoặc Sentry/Better Stack SaaS tuỳ ngân sách)
- Error tracking tập trung: nhận lỗi server-side + client-side, gắn context (user, chi nhánh, request ID)
- Alerting: ngưỡng lỗi/downtime → thông báo (có thể tái dùng Discord bot hiện có)
- Collection `error_logs` trong schema — có thể giảm vai trò xuống chỉ lưu tóm tắt nếu chuyển hẳn sang Sentry/service ngoài

### Phase 8: Analytics & User Behavior Tracking

- Event tracking SDK: click, scroll depth, thời gian/trang, funnel chuyển đổi
- Data pipeline riêng biệt khỏi OLTP (không ghi trực tiếp vào Couchbase transactional) — queue → data warehouse/analytics store
- Dashboard: heatmap tính năng, tỷ lệ bỏ giỏ hàng, hành trình khách hàng theo thiết bị
- Privacy/compliance: ẩn danh hoá dữ liệu hành vi, tuân thủ Nghị định 13/2023 (liên kết với consent đã thêm ở schema `users`)
- Kết quả phân tích quay lại phục vụ Phase 3 (Design Foundation) để tối ưu UX theo dữ liệu thực tế

### Phase 9: Production Optimization & Monitoring

- Performance optimization, caching strategies, comprehensive logging, deployment automation/CI-CD refinement

---

## Quyết định nghiệp vụ đã chốt (MVP)

### Vai trò & vận hành

- 4 role MVP: **Owner/Admin** (toàn quyền, báo cáo tổng), **Quản lý chi nhánh** (duyệt kiểm kê/đổi trả, báo cáo chi nhánh), **Thu ngân** (bán hàng, mở/đóng ca), **Nhân viên kho** (nhập/xuất/kiểm kê). CSKH/kế toán/marketing → giai đoạn 2
- Ca làm việc bắt buộc: mở ca nhập tiền đầu ca, đóng ca đối soát tiền mặt thực tế vs hệ thống, lệch phải ghi chú lý do
- Nhân viên cố định 1 chi nhánh/tài khoản (không multi-branch assignment); cần hỗ trợ chi nhánh khác → tạo tài khoản phụ

### Bán hàng & tồn kho

- Chuyển kho: tạo "yêu cầu", quản lý chi nhánh nhận duyệt — không tự động real-time transfer
- Combo/set: trừ tồn kho theo từng thành phần cấu thành, không trừ theo SKU combo độc lập
- Kiểm kê: hàng tuần theo chi nhánh, hàng tháng đối soát chéo toàn chuỗi. Chênh lệch <0.5% → quản lý chi nhánh tự duyệt; ≥0.5% → escalate owner/admin

### Đổi trả & thanh toán

- Đổi trả: trong 7 ngày, còn nguyên tem/bao bì, có hóa đơn; cho phép đổi trả khác chi nhánh (ghi rõ chi nhánh bán gốc để đối soát tồn kho đúng)
- Thanh toán: tiền mặt, thẻ qua máy POS ngân hàng, Momo/ZaloPay QR bắt buộc; chuyển khoản đối soát thủ công giai đoạn đầu; trả góp để sau
- COD cho đơn online (phù hợp thói quen khách VN)

### Hóa đơn & pháp lý

- Không tự build engine hóa đơn điện tử — dùng dịch vụ ngoài (VNPT/Viettel/MISA), tích hợp API khi doanh thu ổn định; ưu tiên xuất dữ liệu đúng chuẩn để dễ tích hợp sau
- Loyalty: tích điểm theo % giá trị đơn, quy đổi 1 điểm = X VNĐ; phân hạng thành viên (Bạc/Vàng/Kim cương) → giai đoạn 2
- Consent thu thập dữ liệu cá nhân bắt buộc theo Nghị định 13/2023 (SĐT/địa chỉ) — không thể bỏ qua vì rủi ro pháp lý; encryption kỹ thuật không thay thế được consent pháp lý

### Giao vận & omnichannel

- Click-and-collect triển khai ngay (chi phí gần bằng 0); giao hàng tận nơi qua bên thứ 3
- Giao vận tích hợp API GHN/GHTK/Ahamove, không tự vận hành đội giao hàng ở giai đoạn đầu

### Quy mô & hạ tầng

- Ban đầu 2-3 chi nhánh, mục tiêu 8-10 trong 1-2 năm → một Couchbase Capella cluster dùng chung, filter theo `branch_id`, chưa cần multi-tenant
- Ngân sách: ưu tiên free tier/tier thấp nhất (Couchbase Capella, PartyKit, Sentry) ở giai đoạn MVP, chỉ nâng cấp khi traffic thật đòi hỏi
- Team 1 người → ưu tiên kiến trúc đơn giản, giữ monolith SvelteKit, tránh microservices dù có PartyKit là service phụ trợ riêng

---

## Quyết định kiến trúc/kỹ thuật (từ Phase 1-2, vẫn áp dụng)

1. **Document Key deterministic**: dùng `emailBlindIndex` (base64url HMAC) tạo `documentKey` dạng `users::<encoded_blind_index>`, áp dụng cả `Users.save()` và `UserAdminService.createUser()`
2. **Race condition fix pattern**: atomic `document.create()` + xử lý lỗi 409, re-check bằng `isEmailTaken()`/`isUsernameTaken()` khi conflict — áp dụng tương tự cho tồn kho ở Phase 4 (nhiều chi nhánh bán cùng SKU cùng lúc)
3. **Couchbase Data API dual shape**: `document.query()` trả N1QL result (`res.data.results`), `query.document.search()` là namespace method riêng — mock test phải khớp cả hai
4. **Vitest**: tránh top-level variable trong `vi.mock` factory (hoisting), inline mock response, thay getters bằng plain object, dùng `mockResolvedValueOnce()` sequencing
5. **Playwright**: đặt `baseURL` trong `use` block, `ignoreHTTPSErrors: true` khi cần, hoặc bỏ `webServer` block khi server đã chạy sẵn

## Schema (chi tiết đầy đủ: xem file `schema.ts`)

Điểm chính đã chốt/sửa:

- Tồn kho, đơn hàng, chuyển kho, kiểm kê đều dùng `variantId` (không phải `productId`) làm đơn vị vận hành
- `users`: thêm `consentGivenAt`/`consentVersion`; `branchId` cố định 1 giá trị (không array)
- `order_returns`: tách `originBranchId` (chi nhánh bán gốc) và `returnBranchId` (chi nhánh xử lý)
- `products`: thêm `isCombo` + `comboComponents` cho bundle; thêm `nameI18n` (object) song song field gốc searchable
- `name_roles`: thêm `displayNameI18n` cho bản dịch UI
- `notification_templates`: thêm field `locale`, document key theo quy ước `<code>_<locale>`
- `stock_takes`: thêm `scope`, `totalVariancePercentage`, `requiresEscalation`, `approvedBy` để routing duyệt tự động
- `pos_sessions`: thêm `discrepancyNote`
- `payments.method`: chuẩn hoá enum `cash | bank_pos | momo | zalopay | bank_transfer | cod | loyalty_points`
- Collection mới: `error_logs` (lỗi kỹ thuật server/client, tách khỏi `audit_logs` là log nghiệp vụ)

---

## Công việc đang dở dang / technical debt

1. **Test suite**: `tests/ui-check.spec.ts`, `tests/ui-check-v2.spec.ts` chưa ổn do lỗi config; một số unit test cũ cần cập nhật sau refactor
2. **Documentation**: cập nhật README.md hướng dẫn dev/test sau khi thêm `baseURL`; quy chuẩn tên screenshot `<engine>-<Component>-<state>.png`
3. **Dọn dẹp**: file cũ trong `.claude/worktrees/` có thể còn tham chiếu history; dọn `playwright-report/`, `test-results/` sau mỗi lần chạy test
4. **E2E maintenance**: bộ test auth (`37a785e`) cần chạy định kỳ, cập nhật selector nếu UI đổi
5. **Chưa quyết định**: room strategy cụ thể cho PartyKit realtime layer (Phase 5); có cần Elasticsearch/Meilisearch riêng khi catalog lớn hay N1QL đủ dùng lâu dài; CDN lưu trữ ảnh sản phẩm; backup/disaster recovery cho Couchbase (tần suất, RTO/RPO); có tái dùng Svelte component library hiện có làm design system cho Phase 3 hay xây mới

---

_File này tổng hợp toàn bộ quyết định đã chốt qua các buổi làm việc, dùng để phục hồi context khi bắt đầu session mới hoặc bàn giao worktree._