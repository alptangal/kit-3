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

### Phase 2: Authorization & Role Management — _HOÀN THÀNH_

- RBAC nhiều role level, permission checking + grants caching, user admin flows, role assignment
- Worktree: `continue-phase2-verification` (đã merge)
- Commit mẫu: `8557e2a docs: phase-2 auth-completion implementation plan`, `37a785e Add auth E2E test suite, Playwright config and CI workflow`, `08eb4c3 Refactor auth: AuthLayout, forgot-password flow, server i18n`
- Merge hoàn tất: `6dc0a8d` (fast-forward, 52 files) — `continue-phase2-verification` → master. (`phase1-foundation` đã được salvage vào master qua commit `1706d97` từ trước, giữ lại để tham khảo)
- **3 bug đã fix trong quá trình verify** (commit `6dc0a8d`, `8225f95`, `008d7cc`):
  1. `partysocket` missing sau merge (mất `node_modules`) → fix bằng `npm install`
  2. Login "Decryption returned empty" → `src/routes/api/login/+server.ts` viết lại để detect plain JSON dev login (có username/password) vs encrypted blob; path JSON thường không gọi `decryptWithPrivateKeyHybrid`
  3. **RBAC N1QL reserved words**: `scope` (trong `detail_roles`) và `level` (trong `name_roles`) là từ khóa dành riêng của N1QL — query trực tiếp theo field này gây lỗi; fix bằng `permission-checker.ts`/`users.ts` dùng `SELECT *` + unwrap thay vì `SELECT scope, level`
  4. Authorized layout trắng trang (URL 200 nhưng DOM rỗng) → `src/routes/(authorized)/+layout.svelte` thiếu `{@render children()}`
- **Convention rút ra**: mọi field mới đặt tên trong schema phải tránh N1QL reserved words (`scope`, `level`, và cần rà thêm nếu phát hiện). Ưu tiên đổi tên field (vd `auditScope` thay vì `scope`) hơn là nhớ áp dụng ngoại lệ `SELECT *` + unwrap mỗi lần viết query mới — xem áp dụng ở `stock_takes.auditScope` trong schema Phase 4

### Cross-cutting: Error Handling & i18n Foundation _(chèn trước Phase 3, áp dụng xuyên suốt)_

- **i18n**: `paraglide-js` hoặc `svelte-i18n`, tách namespace theo domain (auth/retail/checkout/admin); quyết định URL-based locale (`/vi/...`, `/en/...`) vì ảnh hưởng SEO storefront
- **Error handling server-side**: Error class hierarchy (`AppError`, `ValidationError`, `AuthError`...), middleware bắt lỗi tập trung trong `hooks.server.ts`, structured logging
- **Error handling client-side**: `<svelte:boundary>`, toast/notification system, error code → message đa ngôn ngữ, tách message hiển thị user khỏi log nội bộ
- Nên hoàn thành trước khi code Phase 3 phình to — sửa sớm rẻ hơn refactor muộn

### Phase 3: UI/UX Design Foundation — _ĐANG LÀM_

- **Mục tiêu**: chốt nền tảng thiết kế trước khi code nghiệp vụ, tránh phải refactor component nhiều lần khi UI thay đổi sau
- **Design system**: đã quyết định — tái dùng Svelte component library (compound-component pattern) hiện có làm nền, không xây mới. Đã có `DESIGN.md`: design token đầy đủ (spacing 5 mức, radius 5 mức, typography 13 mức xs→9xl, color system light/dark qua alias, shadow 5 mức), breakpoint 7 mức tới `3xl` (1920px, dùng cho TV)
- **Component audit đã hoàn thành** (`COMPONENT-AUDIT.md`, 2026-09-27): 8 component (Button, Input, Tooltip, Checkbox, Skeleton, Loading, Toast, Icon) đều compliant với compound-component pattern và mobile-first/a11y cơ bản. Gap chính: nhiều giá trị hardcode (animation duration, transform scale, offset, opacity) chưa dùng design token — cần token migration trước khi nhân rộng sang POS/storefront/TV
- **Bước tiếp theo đã xác định**: token migration (hardcode → CSS variable), sau đó mới tới TV/kiosk design language riêng và 2 design language POS/storefront (2 mục này DESIGN.md tự đánh dấu "⏳ Pending")

**Component gap list (chốt trước, không để agent tự phát sinh theo từng task)** — hiện có Button, Input, Modal, Checkbox:

| Nhóm             | Component còn thiếu                                                             | Dùng cho                                                          |
| ---------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Form nâng cao    | Select/Dropdown, Radio group, Textarea, Date picker, File upload, Toggle/Switch | Form nhập liệu (PO, product, checkout)                            |
| Hiển thị dữ liệu | Table/DataGrid (sort, filter, pagination), Badge/Tag, Avatar, Card              | Danh sách sản phẩm, đơn hàng, tồn kho                             |
| Điều hướng       | Tabs, Breadcrumb, Pagination, Sidebar (đã có menu-bar/navigation-bar)           | Admin layout                                                      |
| Phản hồi         | Alert/Banner, Dialog/Confirm (phân biệt với Modal chung), Progress bar          | Xác nhận thao tác, cảnh báo                                       |
| Bố cục           | Drawer/Sheet (mobile), Accordion, Stepper                                       | Checkout nhiều bước, filter mobile                                |
| Đặc thù POS      | Numpad ảo, Barcode scanner input, Cash-count grid                               | Thu ngân — không có pattern chuẩn sẵn, cần thiết kế mới hoàn toàn |
| Đặc thù TV/kiosk | Dashboard card cỡ lớn, ticker, hiển thị ít tương tác                            | Digital signage                                                   |

**Nguyên tắc bắt buộc khi agent tự thiết kế component mới** (nhắc lại, vì dễ bị quên giữa các task khác): cấu trúc compound (`Main.svelte` + `_interface.ts` + `_styles.scss` + `composables/` + `index.ts`); dùng design token có sẵn, không hardcode; có `variant`/`size` system nhất quán với Button/Input; đủ checklist a11y (focus, ARIA, keyboard, touch target 44px, reduced motion); thêm vào `/ui` demo page.

**Thứ tự ưu tiên**: bám theo nhu cầu Phase 4 hiện tại (Pricing/POS Sessions/Stock Takes cần Table, Select, Radio group, Toggle trước), không thiết kế tràn lan toàn bộ danh sách cùng lúc.

- **Wireframe/user flow theo từng role**: Owner, Quản lý chi nhánh, Thu ngân, Nhân viên kho, và khách hàng (storefront) — mỗi role có luồng thao tác khác nhau
- **Màn hình TV/kiosk**: thiết kế riêng từ đầu (không tái dùng layout PC) — dashboard cửa hàng, digital signage, tối ưu cho không tương tác chuột
- **Hai design language dùng chung token**: POS (thao tác nhanh, ít bước, ưu tiên tốc độ) và storefront khách hàng (thẩm mỹ, thuyết phục mua hàng) — mục tiêu UX khác nhau
- **Accessibility (a11y)**: contrast, touch target size cho tablet POS, keyboard navigation cho PC admin — tính từ đầu vì phục vụ đa thiết bị
- _Lưu ý_: đây là nơi dữ liệu từ Phase 8 (Analytics/Behavior Tracking) sẽ quay lại phục vụ — vòng lặp theo dõi hành vi → phát hiện điểm nghẽn → thiết kế lại chỉ có ý nghĩa khi có nền tảng thiết kế ban đầu để so sánh

#### Công cụ & quy trình thiết kế (plugin Impeccable, chạy trong Claude Code)

- **Phạm vi dùng**: chỉ phần frontend — Phase 3, Phase 6 và mục con Frontend của các phase sau. Không dùng cho backend/schema/realtime
- **Bước 1 — Brief trước khi gọi command**: nêu rõ 4 role + khách hàng, hai design language (POS: tốc độ/ít bước; storefront: thẩm mỹ/thuyết phục), màn hình TV riêng, touch target tablet POS, yêu cầu a11y
- **Bước 2 — Thử nghiệm trên màn hình auth có sẵn** (`AuthLayout`, login, forgot-password từ Phase 2): chạy `audit` + `critique` trước, sau đó mới `polish`
- **Bước 3 — Chốt design token** (màu, typography, spacing) từ kết quả bước 2, rồi mới áp sang các màn hình khác
- **Bước 4 — Thứ tự màn hình**: POS (mở ca, bán hàng) → quản lý (duyệt kiểm kê/đổi trả) → storefront → TV/kiosk
- **Bước 5 (tuỳ chọn)**: chạy CLI `detect` trong CI cạnh bộ Playwright — cần đọc CLI reference để xác nhận cách dùng
- **Ràng buộc**: yêu cầu công cụ dùng lại thư viện Svelte 5 compound-component hiện có (không tạo hệ component song song); tránh cài trùng skill (Impeccable vs frontend-design mặc định); a11y vẫn tự kiểm bằng axe/Playwright, không dựa điểm audit của công cụ thiết kế; ràng buộc bán lẻ (touch target, đọc ở khoảng cách xa trên TV, thao tác một tay) phải tự kiểm bằng thiết bị thật

### Phase 4: Core Retail Data Model & Operations

- Product catalog (sản phẩm, biến thể, category, combo/bundle)
- Inventory đa chi nhánh (tồn kho theo location, yêu cầu chuyển kho có duyệt, reservation tránh oversell)
- Order management (trạng thái pending/paid/fulfilled/returned)
- Supplier & purchasing (nhập hàng, phiếu PO)
- Pricing engine (giá theo chi nhánh, khuyến mãi)
- Ca làm việc thu ngân (mở/đóng ca, đối soát tiền mặt)
- Kiểm kê kho 2 cấp (weekly branch / monthly cross-branch) với routing duyệt theo ngưỡng chênh lệch
- _Mô hình tồn kho_: single source per branch, filter qua `branchId`, chưa cần tenant isolation ở quy mô 2-10 chi nhánh

### Task nền tảng (chèn trước Phase 5): Component Library Priority 1

- **Mục tiêu**: xây trước 4 component dùng chung (Select/Dropdown, Radio group, Toggle/Switch, Table/DataGrid) thành 1 task riêng, không để phát sinh ad-hoc theo từng tính năng — khác với Service/UI theo lát cắt dọc, đây là hạ tầng nhiều tính năng sẽ dùng lại
- **Điều kiện xong trước khi bắt task Storefront (Phase 5)**: cả 4 component phải đạt Definition of Done component (compound structure, design token, variant/size nhất quán, a11y đầy đủ, demo `/ui`) — xem chi tiết đầy đủ trong Phase 3
- **Đã xác nhận (2026-09-29)**: Phase 4 (#30/#31/#32) thiếu 8 trang UI cụ thể, cần làm cùng đợt Priority 1:
  - **#30 Pricing/Promotions**: `/admin/promotions/list` (Table, Select filter, DateRange), `/admin/promotions/create|edit` (Select loại KM, Radio status, DatePicker)
  - **#31 POS Sessions**: `/admin/pos/sessions/list` (Table, Select filter), `/admin/pos/sessions/open` (Select thiết bị), `/admin/pos/sessions/close` (hiển thị đối soát, không cần component Priority 1 mới)
  - **#32 Stock Takes**: `/admin/stock-takes/list` (Table, Select filter), `/admin/stock-takes/detail` (Table biến động, Radio duyệt/escalate theo ngưỡng 0.5%)
- **Priority 2-3** (Textarea/DatePicker/Tabs/Card... và Numpad/Barcode/TV-kiosk component) làm sau, theo đúng thứ tự đã liệt kê ở Phase 3 — không dồn hết vào 1 task

### Phase 5: Omnichannel E-commerce + Realtime Layer mở rộng

**Breakdown 8 task (lát cắt dọc), thứ tự sau khi Component Library Priority 1 xong:**

| Task                          | Scope                                    | Có UI?          | Ghi chú                                                                                                                                                                                                                                     |
| ----------------------------- | ---------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #33 Cart                      | Service + API + Storefront UI            | ✅ Có           | `/storefront/cart`                                                                                                                                                                                                                          |
| #34 Checkout                  | Service + API + Storefront UI            | ✅ Có           | `/storefront/checkout` multi-step                                                                                                                                                                                                           |
| #35 Payments                  | Service + webhooks + API **+ UI**        | ✅ Có (đã sửa)  | `/admin/payments/list` + hành động "xác nhận đã nhận chuyển khoản" (pending→completed) — **bắt buộc** vì quyết định nghiệp vụ chuyển khoản đối soát thủ công, không thể xử lý ngoài UI                                                      |
| #36 Shipments                 | Service + API + UI                       | ✅ Có (đã nâng) | `/admin/shipments/list` xem trạng thái đơn đang giao theo chi nhánh, không cần tạo/sửa vận đơn thủ công ở MVP — chỉ để xử lý khi webhook fail hoặc khách hỏi                                                                                |
| #37 Realtime                  | PartyKit setup (hạ tầng)                 | ❌ Không        | Đúng — đây là hạ tầng websocket, không phải nghiệp vụ CRUD, không cần UI riêng                                                                                                                                                              |
| #38 Storefront Foundation     | Layout/shell công khai + product catalog | Shared          | `/storefront`, `/storefront/products`, `/storefront/products/{variantId}`, `/storefront/search`, `/storefront/account` — Option B: đây là hạ tầng/layout chung, #33-34 tự làm trang riêng bên trong, không phải nơi UI của #33-34 "bị hoãn" |
| #39 Admin Dashboard           | Trang tổng hợp riêng                     | ✅ Có           | Dashboard tổng hợp live view — phải gồm cả dữ liệu từ #30/#31/#32 (Phase 4, sau khi refactor bằng Component Priority 1), không chỉ #33-37                                                                                                   |
| #40 Unified Order Fulfillment | Service + API + UI                       | ✅ Có           | Hợp nhất đơn POS + online                                                                                                                                                                                                                   |

**Nội dung nghiệp vụ giữ nguyên**:

- Thanh toán: tiền mặt, thẻ qua POS ngân hàng (`bank_pos`), Momo/ZaloPay QR, chuyển khoản (đối soát thủ công qua #35), COD cho đơn online
- Click-and-collect: trạng thái đơn `awaiting_pickup`, chi phí triển khai gần bằng 0
- Giao vận: tích hợp bên thứ 3 (GHN/GHTK/Ahamove) qua webhook, không tự vận hành đội giao hàng
- **Realtime qua PartyKit**: room strategy hybrid đã chốt (`branch:{branchId}` + `role:owner`) — xem "Quyết định kiến trúc/kỹ thuật đã chốt (Phase 4-5)"; cơ chế reconnect/offline queue cho POS khi mất mạng tạm thời vẫn cần thiết kế trong #37

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
- `stock_takes`: thêm `auditScope` (đặt tên tránh reserved word, không dùng `scope`), `totalVariancePercentage`, `requiresEscalation`, `approvedBy` để routing duyệt tự động
- `pos_sessions`: thêm `discrepancyNote`
- `payments.method`: chuẩn hoá enum `cash | bank_pos | momo | zalopay | bank_transfer | cod | loyalty_points`
- Collection mới: `error_logs` (lỗi kỹ thuật server/client, tách khỏi `audit_logs` là log nghiệp vụ)

---

## Definition of Done (áp dụng từ Phase 4 trở đi, xuyên suốt)

Mỗi task/tính năng chỉ được coi là hoàn thành khi có đủ 4 phần sau trong cùng 1 task — **không tách UI hay test ra thành task riêng làm sau**:

1. **Service** — business logic, tương tác Couchbase
2. **API route** — endpoint gọi service, có permission check qua `PermissionChecker`
3. **UI** — route/trang hoặc component tương ứng, dùng design token + component đã audit ở Phase 3
4. **Test** — ít nhất 1 unit test cho logic quan trọng (đặc biệt state transition, race condition) hoặc 1 case Playwright cho luồng chính

**Lý do đặt ra**: task #29 (Supplier & Purchasing, Phase 4) hoàn thành đầy đủ Service + 7 API route nhưng không có UI và không có test — chỉ dừng ở type-check/build/curl. Nếu tiếp tục theo thứ tự Service trước, UI sau (làm theo layer thay vì theo tính năng), rủi ro là nhiều service backend chồng lên nhau trước khi có màn hình nào chạy thử, dẫn tới phải sửa lại API khi làm UI thật.

**Cách chia task đúng**: theo lát cắt dọc (1 tính năng = 1 task, đủ 4 phần trên), không theo lát cắt ngang (tất cả service trước, tất cả UI sau, tất cả test cuối cùng).

**Việc còn nợ từ Phase 4**: task #29 (Supplier/Purchasing) cần bổ sung UI (`/admin/suppliers`, `/admin/purchase-orders`) và test trước khi coi Phase 4 hoàn thành.

---

1. Test suite `ui-check.spec.ts`/`ui-check-v2.spec.ts` — Unit tests: **ĐÃ FIX** (97/97 passing, test Phase 2 cũ đã disable). Playwright: root cause `webServer` echo giả đã fix, chạy được trên worktree Phase 3 (61 passed / 33+28 passed tuỳ config port) — nhưng **đang bị block lại** ở thời điểm Phase 5 (cần dev server + `.env` mới chạy), cần gỡ trước khi merge Phase 5, không để "chạy tay khi rảnh"
2. **Documentation**: README.md đã viết lại đầy đủ (dev/test guide, Playwright setup) — duy trì cập nhật khi thêm feature mới
3. **Dọn dẹp**: file cũ trong `.claude/worktrees/` có thể còn tham chiếu history; dọn `playwright-report/`, `test-results-ui-check/`, `.svelte-kit/` sau mỗi lần chạy test/build — có thể làm song song, không chặn tiến độ Phase 5
4. **E2E maintenance**: bộ test auth (`37a785e`) cần chạy định kỳ, cập nhật selector nếu UI đổi; cần CI/CD pipeline chạy E2E tự động trước merge (chưa có)
5. ~~Token migration (Phase 3)~~ — **ĐÃ XONG**: hardcode → CSS variable cho Button/Input/Tooltip/Checkbox/Skeleton/Loading/Toast/Icon + 3 layout component mới (menu-bar, navigation-bar, footer-enhanced), verify qua Playwright 3 browser engine
6. **N1QL reserved words**: rà lại toàn bộ schema tìm field trùng từ khóa dành riêng của N1QL (đã biết: `scope`, `level`) trước khi viết query mới — áp dụng ngay cho 4 collection mới của Phase 5 trước khi implement service
7. **Còn mở**: formal WCAG 2.1 AA audit + screen reader testing thực tế (NVDA/VoiceOver/TalkBack) cho Phase 3; UI/test còn nợ cho task #29 Supplier/Purchasing (xem Definition of Done bên dưới); **cần xác nhận UI thật sự của #30 (Pricing/Promotions), #31 (POS Sessions), #32 (Stock Takes) đang dùng gì cho phần chọn lựa/bảng dữ liệu** — nếu là HTML thô, gộp refactor cùng đợt Component Library Priority 1 (xem task nền tảng trước Phase 5)

### Quyết định kiến trúc/kỹ thuật đã chốt (Phase 4-5)

- **PartyKit room strategy**: hybrid — room chính `branch:{branchId}` cho từng chi nhánh, cộng room phụ `role:owner` mà Owner join cùng lúc mọi chi nhánh để có dashboard tổng. Phân quyền xem loại message nào xử lý ở tầng filter client, không tách room chi tiết hơn ở quy mô 8-10 chi nhánh
- **Product search**: giữ N1QL (Couchbase FTS/GSI), chưa thêm Elasticsearch/Meilisearch. Chỉ cân nhắc đổi khi catalog vượt ~50-100k SKU hoặc cần fuzzy/typo-tolerance search thật sự
- **Product images**: dùng **Adobe** (tự xây request/response tới server/hosting Adobe), tích hợp qua abstraction layer `ImageStorageProvider` interface (`src/lib/server/storage/`) — service nghiệp vụ không gọi thẳng Adobe API, để dễ đổi provider sau này nếu cần. Upload luôn qua server route (không gọi trực tiếp từ client) để giữ credential và tận dụng RBAC permission check
- **Couchbase backup**: scheduled backup daily trên Capella, chấp nhận RPO 24h / RTO vài giờ ở giai đoạn MVP; nâng cấp khi lên 8-10 chi nhánh và downtime 24h trở thành thiệt hại nghiêm trọng
- **Design system**: đã chốt từ Phase 3 — tái dùng thư viện Svelte compound-component hiện có, không xây mới (8 component đã audit + token migration hoàn thành)

**Phase 5 tiến độ**: schema extensions cho 4 collection mới đã commit (`c7e3f8ed`). Breakdown còn lại (Cart, Checkout, Payment, Shipment, Realtime) áp dụng Definition of Done bên dưới — chia theo lát cắt dọc từng tính năng, không theo layer (service trước/UI sau).

---

_File này tổng hợp toàn bộ quyết định đã chốt qua các buổi làm việc, dùng để phục hồi context khi bắt đầu session mới hoặc bàn giao worktree._
