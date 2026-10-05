# COMPONENT CONTRACT — kit-3 (bản sống, cập nhật theo wave)

Tài liệu bắt buộc cho MỌI engineer build component mới trong đợt 22-component (2026-10).
Nguồn sự thật: code thật trong `src/lib/components/` + `src/lib/assets/styles/` + `DESIGN_SYSTEM.md`.
Nếu tài liệu này mâu thuẫn code, **code thắng** — nhưng phải báo lại PM để sửa tài liệu.

## 1. Quy tắc sắt (không được vi phạm)

1. Build target `es2020` + `safari15` → **KHÔNG dùng CSS `:has()`**; `:focus-visible`, `aspect-ratio`, `dvh` OK.
2. Svelte 5 runes: `$state` nhận VALUE (không thunk); Map/Set feed render phải `SvelteMap`/`SvelteSet` (`svelte/reactivity`).
3. Scoped CSS Svelte 5: `<style>` chỉ apply cho component chính; style component con/slot → `:global(...)`. Mỗi sub-component tự có `<style lang="scss">` scoped riêng.
4. Context: `getContext` đọc ở đầu init; sau đó đọc bằng `$derived`/getter (không freeze). File context = **leaf** `_context.ts` (không import `.svelte`).
5. **KHÔNG commit, KHÔNG chạy `git add`** — PM (agent chính) quản lý git. Chỉ báo cáo danh sách file tạo/sửa.
6. **KHÔNG sửa file shared** (barrel `element/index.ts`, `form/index.ts`, `navigation/index.ts`, `data/index.ts`, `svelte.config.js`, `vite.config.ts`, `app.css`) — PM tích hợp. Nếu component cần export mới, ghi vào BANI BÁO CẢNH của bạn.
7. Component mới đặt cạnh input/button dùng **semantic color** (`--color` success/error...); surface component (badge/card/tag-like) dùng bảng **variant** `soft|solid|outline|ghost` theo mẫu `element/tag`.
8. Không hardcode màu/px — chỉ token: `size-*` classes, `--color-*`, `--disabled-opacity`, `--transition-duration`...
9. Mọi text người dùng → `TranslateContent {en, vi}` khi component có prop label/description (mẫu tag/input).
10. Tôn trọng `prefers-reduced-motion` (CSS `@media` + guard JS khi dùng svelte/transition).

## 2. Cấu trúc thư mục chuẩn

```
src/lib/components/{element|form}/{kebab-name}/
├── Main.svelte        # render + configs (atom) — hoặc Root.svelte (composite)
├── _interface.ts      # <Name>Props extends BasicProps; <Name>Configs extends BasicConfigs
├── _styles.scss       # .{kebab}-root + size/color/variant map + state
├── index.ts           # export (composite: Object.assign)
└── [sub-components]   # composite: Trigger/Content/Item/... + _context.ts (leaf)
```
- Sub-component lồng (checkbox pattern): `Indicator/Main.svelte`... mỗi sub 1 thư mục.
- `data/` (datatable): học `src/lib/components/table/` hiện có.

## 3. Imports chuẩn

```ts
import { styleSynced, convertToMiliseconds } from '$modules';
import { handleEvents } from '$modules/_attachments';   // {@attach handleEvents(configs.event)}
import { client } from '$store/basic.svelte';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { BasicProps, BasicConfigs, Color, Size, TimeUnits } from '$components/interface';
import type { TranslateContent } from '$interfaces/basic';
```
Alias: `$components`, `$interfaces`, `$modules`, `$store`, `$styles` (→ `src/lib/assets/styles`).

## 4. Props/Configs pattern (mẫu thật: `form/checkbox/Main.svelte`)

```ts
let { children, value = $bindable(), ...props }: NameProps = $props();
const formContext = getFormContext();            // form field: đọc ĐẦU init
let configs: NameConfigs = $state({
    status: { ... },
    get style() {
        return styleSynced({
            defaultStyles: ['name-root', `size-${this.size}`, `color-${this.color}`,
                            this.disabled ? 'disabled' : undefined, ...],
            propStyles: props.class
        }, props.overwriteDefaultStyles);
    },
    get size()   { return props.size ?? formContext?.size ?? client.browser?.size ?? 'md'; },
    get color()  { return props.color ?? 'default'; },
    get disabled() { return props.disabled ?? formContext?.disabled; },
    get duration() { return convertToMiliseconds(props.duration) ?? convertToMiliseconds(client.browser?.duration) ?? 300; },
    get event()  { if (this.disabled) return undefined; return [/* listeners */]; },
    children: {},
    ref: undefined as HTMLElement | undefined,
    reset() { ... }
});
```
- Composite: state chung (open/value/...) giữ trong `Root.svelte` + `setContext(Symbol, registry)`; sub đọc `getContext`.
- Atom nhẹ (kbd/separator-like): được phép dùng `$derived` thay `$state` (mẫu tag).

## 5. Style

- Class root: `{kebab}-root`; state = class JS gán (`disabled`, `has-value`, `focus`, `active`, `open`...).
- Size: class `size-${size}` set CSS vars (`--font-size`, `--min-height`, `--gap`, `--padding`, `--border-radius`...) — mọi đo lường NẶN TRÊN VARS.
- Duration truyền inline: `style:--duration={`${configs.duration}ms`}` hoặc `--transition-duration`.
- `@media (prefers-color-scheme: dark)` cho màu dark; hover guard `@media (hover: hover) and (pointer: fine)`.
- Motion chuẩn: 300ms, `cubic-bezier(0.65,0,0.35,1)` (dropdown panel: `cubic-bezier(0.16,1,0.3,1)` ~150-200ms); tap `scale(0.97)` (touch).
- Variant map (surface components): copy cấu trúc `@each` từ `element/tag/_styles.scss` (`$colorRefs` semantic→palette `--color-{ref}-NNN`).

## 5b. Nguyên tắc UX/UI (bắt buộc mọi component)

Ba nguyên tắc chung, không phụ thuộc loại component — **probe/screenshot phải đủ để xác nhận**:

1. **Disabled → `cursor: not-allowed` (PC/desktop).** Khi component (hoặc phần tử) ở state `disabled`, phần tử đó PHẢI hiện `cursor: not-allowed` để tăng trực quan trên môi trường con trỏ. Dùng token `var(--cursor-disabled)` (= `not-allowed`), guard `@media (hover: hover) and (pointer: fine)` (touch không có con trỏ). Kèm `opacity: var(--disabled-opacity)` nếu state chưa mờ.
2. **Size phủ đủ `2xs` → `full` (nếu có thể).** Mọi component có `size` prop/tokens NÊN hỗ trợ bậc từ `2xs` nhỏ nhất đến `full` (max-width 100%) — tức token + class `size-{tier}` + `[data-size='{tier}']` phải tồn tại cho từng bậc, và component phải DÙNG token (không hardcode px) để mọi bậc render đúng. Token 2xs: `--font-size-2xs: 0.625rem`, `--min-height-2xs: 1.5rem`, `--padding-2xs: calc(var(--spacing) * 1)`, `--gap-2xs`, `--border-width-2xs`, `--border-radius-2xs`, `--min-width-2xs`, `--container-2xs` (đã có trong `variables.scss`/`sizes.scss`/`theme.scss`). Bậc không hợp lý (ví dụ 9xl cho badge) thì được phép loại, nhưng bậc `2xs`/`xs` cho form field, button, badge là bắt buộc.
3. **Cursor theo hành vi (PC/desktop):**
   - Component (hoặc phần tử) **chứa action** (click → có tác dụng) → `cursor: pointer` (= `var(--cursor-interactive)`). Áp cho trigger, item menu, button, tab, row clickable…
   - Component **chấp nhận edit** (text/otp/contenteditable/textarea…) → `cursor: text` trên vùng nhập.
   - Nguyên tắc này là KHÔNG có giá trị khi `disabled` (nguyên tắc 1 thắng). Guard `@media (hover: hover) and (pointer: fine)`.

> Cả 3 áp trên môi trường PC/desktop (con trỏ). Touch/mobile không cần con trỏ nhưng vẫn giữ `disabled` + a11y đúng. Probe nên control-click/mouse hover + đọc `getComputedStyle(el).cursor` để xác nhận (không chỉ nhìn screenshot).

## 6. A11y / keyboard

- Composite container: `role` đúng WAI-ARIA (tablist/tab, radiogroup, menu, group...) + roving focus mẫu `form/radiogroup` (Arrow/Home/End, `e.preventDefault()`).
- Trigger: `aria-haspopup`/`aria-expanded`/`aria-controls={id}`; id sinh `Math.random().toString(36)` (SSR-safe).
- Focus ring: `:focus-visible { outline: 2px solid var(--color-indigo-500); outline-offset: 2px }`.
- Menu/dialog: Escape + outside-click + Tab → đóng + focus trả trigger; focus trap cho dialog (mẫu `modal/useModalContext.svelte.ts`).
- icon-only → `aria-label` bắt buộc; trang trí → `aria-hidden="true"`.

## 7. Form field (input, input-otp, slider khi cần...)

1. `onMount`: `formContext?.childrens.add(configs)` (configs cần `name`, `value`, `loading`, `status.changed`, `validation.isValid`, `reset()`).
2. Validation: `$effect` theo value → debounce `configs.delay ?? 300`ms → `validationProcessing`; messages là `SvelteMap`; `defaultValidation` khai trong `index.ts` (mẫu checkbox).
3. `_justReset = true` đặt TRƯỚC khi đổi value trong `reset()`.
4. `onDestroy`: clear `configs.timeId`.
5. Form serialize: chỉ `string|boolean` an toàn (`'value' in children`) — giá trị phức tạp thì page tự serial.

## 8. Demo page — `src/routes/ui/{kebab-name}/+page.svelte`

```svelte
<script lang="ts">
    import { Name } from '$components/element';   // form: '$components/form'
</script>
<div class="page" data-test="{kebab}-demo">
    <h1 class="page-title">Name · mô tả</h1>
    <section class="demo"> <h2>Case</h2> <p class="demo-hint">...</p> ... </section>
    <!-- data-test="..." cho mỗi khối probe cần assert -->
</div>
<style lang="scss">
    .page { max-width: 42rem; margin: 0 auto; padding: 2rem 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
    .demo { display: flex; flex-direction: column; gap: 0.5rem; }
    .demo-hint { font-size: 0.8125rem; color: var(--muted, var(--foreground)); }
</style>
```
Case tối thiểu: default + sizes + colors/variants (nếu có) + disabled + (form field: required + in-form).

## 9. Probe + screenshot

- File: `tests/{kebab-name}-probe.mjs` (cấu trúc mẫu `tests/dropdown-menu-probe.mjs`):
  - launch chromium `--ignore-certificate-errors`, context `ignoreHTTPSErrors: true`, viewport 1280×900, `deviceScaleFactor: 2`.
  - `page.on('pageerror')` log; goto `https://localhost:3000/ui/{kebab-name}`; `waitForSelector('.{kebab}-root')`.
  - `ok('NN mô tả', cond)` → cuối: `=== x/y PASS ===`, fail → `process.exit(1)`.
- Chạy: `node tests/{kebab-name}-probe.mjs` (dev server PM lo, port 3000).
- Screenshot: `tests/screenshot/{kebab-name}/01-....png` (DSF2, light scheme) — PM gọi ui-checker đọc.
- **BẪY ICONIFY ASYNC (đã gặp, ContextMenu)**: `<Icon icon="...">` fetch từ Iconify API runtime → **~1-4s** mới render `<svg>` (sau đó cache localStorage). (a) Probe assert icon phải `page.waitForSelector('... svg', { timeout: 15000 })` trước — assert ngay sẽ thấy 0 svg và FAIL giả. (b) Screenshot phải `waitForSelector('svg')` (hoặc sleep ≥3s) trước khi chụp — chụp sớm → ảnh không icon → ui-checker báo "thiếu icon" dù code đúng. (c) Offline → icon KHÔNG render: chấp nhận, probe guard `try/catch` + log WARN (không FAIL giả khi thiếu net).
- **CHẤP NHẬN**: build agent phải tự chạy probe ĐẾN KHI PASS + tự chạy `npm run check` (baseline repo ~579 lỗi CŨ — chỉ chấp nhận 0 lỗi MỚI trong file của mình; ghi rõ line number trong báo cáo nếu có).

## 9b. BẪY UI-CHECKER ĐỌC NHẦM ẢNH (đã gặp, Spinner/Progress)

Subagent `ui-checker` (chỉ có Read/Bash/Glob) DỄ glob `tests/screenshot/` và đọc nhầm ảnh khác (đặc biệt ảnh full-page cao). **Mỗi lần gọi ui-checker cho 1 ảnh, prompt phải kèm GUARD BYTE-SIZE:**
1. Bước 1: `ls -la "<absolute.png>"` → ghi size; CUNG CẤP size đúng (bytes) mong đợi để subagent tự đối chiếu. Size lệch → trả "WRONG FILE".
2. Bước 2: `Read` ĐÚNG path tuyệt đối (không glob/liệt kê thư mục).
3. Mô tả nhanh nội dung KỲ VỌNG (spinner = matrix 4×4 cao ~5200px; progress = nhiều thanh; context-menu = menu + 4 row user) để subagent tự phát hiện đọc nhầm.

PM lấy byte-size chuẩn bằng: `node -e "const b=require('fs').readFileSync('<png>');console.log(b.length, b.readUInt32BE(16), b.readUInt32BE(20))"` (bytes, width, height). Ảnh full-page (height lớn) khác hẳn ảnh viewport (height ≈1800px) → dễ phân biệt.

## 10. BANI BÁO CẢNH (mỗi engineer trả về cuối task)

1. Danh sách file tạo/sửa (đường dẫn tuyệt đối repo-relative).
2. Export cần PM thêm vào barrel nào (`element/index.ts`...): snippet code sẵn copy-paste.
3. Kết quả probe (x/y PASS) + svelte-check (0 mới / liệt kê lỗi mới).
4. Các `data-test` đã đặt + screenshot đã chụp (path).
5. Rủi ro / điểm chưa chắc / đề xuất case UI-checker cần soi.

## 11. Thành phần TỒN TẠI (không build lại — đọc trước khi bắt tay)

| Có sẵn | Vị trí | Lưu ý |
|---|---|---|
| DropdownMenu | `element/dropdown-menu/` | nền để fork Popover/ContextMenu (Root/Trigger/Content/Item/Label/Separator + `_context.ts`) |
| Modal | `src/lib/components/modal/` | focus trap + scroll-lock + resolveTransition — nền Alert Dialog |
| Toast | `element/toast/` | primitives xong; **thiếu Provider/queue/demo** → wave 3 hoàn thiện |
| Tag | `element/tag/` | mẫu variant chuẩn; Badge = phát triển riêng (đơn giản hơn: dot/pill + variant) |
| Table v1 | `src/lib/components/table/` | Table/TableHead/TableBody/TablePagination + `table-logic.ts` + tests → wave 3 nâng cấp |
| Loading | `element/loading/` | bar/rotate/three-dots (spinner sơ khai) → wave 1 hoàn thiện thành Spinner đồng bộ |
| Skeleton | `element/skeleton/` | hoàn chỉnh (shimmer) |
| Select/Input/Checkbox/RadioGroup | `form/*` | rất hoàn chỉnh — tham khảo pattern, không sửa trừ khi PM chỉ định |
| Highlight engine | `src/lib/modules/highlight.ts` | NFD-token, dùng cho search/match text |

## 12. Định nghĩa XONG (DoD) cho 1 component

- [ ] Code theo §2–§6, 0 lỗi svelte-check mới, build không circular import
- [ ] Demo theo §8 (đủ case)
- [ ] Probe ≥5 checks PASS (form field: ≥7: select/change/keyboard/required/form-gate/a11y)
- [ ] Screenshot light (dark nếu component đổi màu)
- [ ] Ban báo cảnh §10 đầy đủ
- [ ] (PM) ui-checker verify + commit riêng
