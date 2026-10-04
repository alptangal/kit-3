# Quy tắc thiết kế UI/UX — hệ nền tảng

> Tài liệu quy chuẩn ("quy tắc thiết kế UI/UX") để **mọi component MỚI** sau này giữ tính
> đồng bộ liên kết với 3 component nền tảng: **Button** · **Input** · **Checkbox**.
>
> Mọi nội dung bên dưới được đối chiếu trực tiếp từ code thật của 3 component này
> (`src/lib/components/element/button`, `src/lib/components/form/input`,
> `src/lib/components/form/checkbox`) và hệ token trong `src/lib/assets/styles/`.
> Nếu code và tài liệu lệch nhau, **code là nguồn sự thật** — cập nhật tài liệu để khớp.

---

## 0. DNA chung — 6 nguyên tắc bất biến

Đây là 6 nguyên tắc "không được vi phạm" của mọi component trong hệ thống.

| # | Nguyên tắc | Giải thích |
|---|-----------|-----------|
| 1 | **Kế thừa interface nền** | Extend `BasicProps` / `BasicConfigs` (từ `src/lib/components/interface.ts`), **không tự bịa interface**. Dùng `styleSynced()` (từ `$modules`) để merge `defaultStyles` + `propStyles`, tôn trọng cờ `overwriteDefaultStyles`. |
| 2 | **Đặt tên class root** | Class root luôn là `{kebab-name}-root` (vd `button-root`, `input-root`, `checkbox-root`). Đây là "chìa khóa" để SCSS hook vào state/size/color. |
| 3 | **State = class do JS quản lý** | State (`.focus`, `.hover`, `.disabled`, `.has-value`, `.loading`, …) là **class được add/remove bằng JS**, không phải pseudo `:focus` / `:hover` trần (trừ trường hợp guard PC + `:focus-visible` của control độc lập). |
| 4 | **Cascading size** | Giá trị size luôn resolve theo thứ tự: `props.size ?? formContext?.size ?? client.browser?.size ?? 'md'`. Component mới phải copy nguyên chữ cái đúng thứ tự này. |
| 5 | **Chạy qua design token** | Mọi màu / đo / rounded / shadow đều tham chiếu design token (`--primary`, `--success`, `size-*`, `rounded-*`, `--min-height`…), **không hardcode px / màu trần**. |
| 6 | **Semantic validation-color** | valid → `color-success`, invalid → `color-error`, trung lập → `color-default`. Màu validation **tự động** khi `required && status.changed` (đổi giá trị so với mốc ban đầu). |

### 0.1. Ví dụ "style resolution" chuẩn (copied from `checkbox/Main.svelte`)

```ts
import { styleSynced } from '$modules';

get style() {
    const defaultStyles: (string | undefined)[] = [
        'checkbox-root',
        `size-${this.size}`,
        `color-${this.color}`,
        this.disabled ? 'disabled' : undefined,
        checked ? 'has-value' : undefined
    ];
    return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
}
get size() {
    return props.size ?? formContext?.size ?? client.browser?.size ?? 'md';
}
get color() {
    if (props.color) return props.color;
    if (this.required && configs.status.changed) {
        return configs.validation.isValid == true ? 'success' : 'error';
    }
    return 'default';
}
```

> `styleSynced()` (src: `src/lib/modules/index.ts`) nhận `{ defaultStyles, propStyles }` + cờ
> `overwriteDefaultStyles`. Nếu cờ = `true` → chỉ trả defaultStyles; nếu `false` (mặc định) →
> trả defaultStyles **gộp thêm** propStyles. Component luôn truyền `props.overwriteDefaultStyles`
> ở vị trí thứ hai để user có quyền "tắt style mặc định".

---

## 1. Hệ token (nguồn duy nhất)

Tất cả component **chỉ** tham chiếu token, không bịa giá trị. Token nằm trong 4 file:

| File | Vai trò |
|------|---------|
| `src/lib/assets/styles/variables.scss` | **Token gốc**: palette màu, `--font-size-*`, `--border-radius-*`, `--min-height-*`, `--spacing`, `--radius`, `--disabled-opacity`, … |
| `src/lib/assets/styles/sizes.scss` | Map class `.size-*` / `.rounded-*` → re-set token cục bộ (`--font-size`, `--min-height`, `--border-radius`, …). |
| `src/lib/assets/styles/theme.scss` | Map `data-size` / `data-color` / `.color-*` → `--color`, `--border-color`, `--min-height`, hover. |
| `src/lib/assets/styles/colors.scss` | Map `.color-*` → `--color` (bản "tinh" theo semantic). |

### 1.1. Token gốc (root)

Định nghĩa trong `:root` / `html` của `variables.scss`:

```scss
--spacing: 0.25rem;
--radius: 0.5rem;
--disabled-opacity: 0.5;
--cursor-interactive: pointer;
--cursor-disabled: not-allowed;
```

Mọi rounded khác được "dắt" từ `--radius` bằng công thức `calc(var(--radius) * n)`:
`xs = 0.25x`, `sm = 0.5x`, `md = 0.75x`, `lg = 1x`, `xl = 1.5x`, `2xl = 2x`.

### 1.2. Bảng size (`sizes.scss` + `variables.scss`)

Mỗi class `.size-*` set lại token cục bộ, dùng chung 1 "bộ thang" (font / line-height /
padding / gap / min-height / rounded):

| Size | `--font-size` | min-height (token) | Ghi chú |
|------|--------------|--------------------|---------|
| `xs` | 12px (`0.75rem`) | `--min-height-xs = 1.875rem` (30px) | |
| `sm` | 14px (`0.875rem`) | `--min-height-sm = 2.125rem` (34px) | |
| `md` | 16px (`1rem`) | `--min-height-md = 2.5rem` (40px) | **default** |
| `lg` | 18px (`1.125rem`) | `--min-height-lg = 2.875rem` (46px) | |
| `xl` | 20px (`1.25rem`) | `--min-height-xl = 3.125rem` (50px) | |
| `2xl`+ | `1.5rem`+ | `var(--font-size)` | min-height theo font |

> Lưu ý: **token trong `variables.scss`** (trên) là thang "chung" của hệ.
> Riêng **Bảng đồng bộ Button↔Input** (mục 2) là giá trị `min-height` *thực tế* được 2
> component override để chúng "cao bằng nhau" khi đặt cạnh nhau — xem mục 2.

### 1.3. Bảng color (semantic → token)

| Class semantic | Token `--color` |
|---------------|-----------------|
| `color-default` | `var(--default)` |
| `color-info` | `var(--primary)` |
| `color-success` | `var(--success)` |
| `color-warning` | `var(--warning)` |
| `color-error` | `var(--danger)` |
| `color-secondary` | `var(--secondary)` |

> Màu chủ đạo trong component = `var(--color)`; `border-color` thường được "gắn" theo
> `--color` (xem `theme.scss`: `--border-color: var(--color)`).

---

## 2. Kích thước

- **Root fix `min-height` = `height` = `var(--min-height, 2.5rem)`** — không auto co giãn.
  (Button & Input đều khai báo đúng cặp `min-height` + `height` này.)

```scss
min-height: var(--min-height, 2.5rem);
height: var(--min-height, 2.5rem);
```

### 2.1. Bảng đồng bộ Button ↔ Input (BẮT BUỘC)

| Size | Button `min-height` | Input `min-height` |
|------|--------------------|--------------------|
| `xs` | 30px (`1.875rem`) | 30px (`1.875rem`) |
| `sm` | 40px (`2.5rem`) | 40px (`2.5rem`) |
| `md` | 40px (`2.5rem`) | 46px (`2.875rem`) |
| `lg` | 40px (`2.5rem`) | 46px (`2.875rem`) |
| `xl` | 50px (`3.125rem`) | 50px (`3.125rem`) |
| `2xl`+ | `var(--font-size)` | `var(--font-size)` |

> **Component field mới** đặt cạnh Button/Input **phải dùng đúng bảng này** (override
> `--min-height` theo từng `size-*` y hệt Button/Input) để chiều cao "ăn khớp" khi
> xếp hàng ngang.

### 2.2. Icon button: `aspect-square`

Chuẩn cho **mọi nút icon** (clear / copy / paste, sort-by, close, …):

```scss
&.aspect-square {
    aspect-ratio: 1 / 1;
    padding-inline: 0;
    min-width: 0;
    width: var(--min-height, 2.5rem); // khớp min-height của Input
    flex-shrink: 0;
}
```

> `aspect-ratio: 1/1` + `width = min-height` → ô vuông đúng kích thước size hiện tại.
> Use-case: nút action trong `Input` (`size="xs" aspect-square`), nút close, nút sort.

---

## 3. Quy tắc STATE (mỗi component phải đủ 5 state)

Mọi component giao tiếp (button / input / checkbox / …) **phủ đủ 5 state** sau:

### 3.1. focus — dấu hiệu = giai indigo (~`#6366F1`)

| Loại | Recipe | Áp dụng cho |
|------|--------|-------------|
| **Field-type** (có nội dung, "toàn thân" glow) | `border-color: var(--color-sky-500)` + `box-shadow: 0 0 0 3px rgba(99,102,241,.15)` (dark `.15` / light `.10`) | Input, Select (class `.focus`) |
| **Control độc lập** (khung nhỏ) | `outline: 2px solid var(--color-indigo-500); outline-offset: 2px` trên `:focus-visible` | Button, Checkbox |

```scss
// Field-type (Input / Select) — class .focus do JS gán
&.focus {
    --border-color: var(--color-sky-500);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15); /* dark */
}
// Control độc lập (Button / Checkbox) — :focus-visible
&:focus-visible:not(.disabled) {
    outline: 2px solid var(--color-indigo-500);
    outline-offset: 2px;
}
```

### 3.2. hover — tăng nhẹ, guard PC

- Guard: `:not(.disabled)` (hoặc class `.hover` do JS gán).
- Chỉ PC: bọc trong `@media (hover:hover) and (pointer:fine)`.
- Hiệu ứng: tăng nhẹ (nền sáng hơn / màu đậm hơn một bậc).

```scss
@media (hover: hover) and (pointer: fine) {
    &:hover:not(.disabled) { /* tăng nhẹ */ }
}
```

### 3.3. disabled — mờ + chặn tương tác

```scss
&.disabled {
    --cursor: not-allowed;
    opacity: var(--disabled-opacity); /* 0.5 */
    cursor: not-allowed;
    &::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: /* cao */;   /* chặn tương tác */
        border-radius: var(--border-radius);
    }
}
```

- `opacity: var(--disabled-opacity)` (0.5) + `cursor: not-allowed`.
- Overlay `::before` với `z-index` cao chặn tương tác (Button/Input) — Checkbox dùng `z-index: 1`.
- **Events trả `undefined` / `[]` khi disabled** (xem `configs.event` getter: `if (this.disabled) return [];`).

### 3.4. error (validation invalid)

```scss
&.color-error {
    --color: var(--error);
    --background: rgba(239, 68, 68, 0.08);   /* nền tint */
    --border-color: var(--error);
}
```

- `--color: var(--error)`, nền tint `rgba(..., 0.08)`, `border-color = error`.

### 3.5. loading — mờ + shimmer (Button) / spinner (Input)

- Chung: `opacity` giảm (`.7`) + `pointer-events: none`.
- **Button**: hiệu ứng *shimmer* (gradient `linear-gradient` chạy `background-position` qua `@keyframes shimmer`).
- **Input**: *spinner* (vòng `::after` xoay `@keyframes input-spin`) + pulse border.

```scss
&.loading {
    pointer-events: none;
    opacity: 0.7;
}
```

---

## 4. Màu & dark/light

- **Chỉ dùng token** — không hardcode hex/màu trần cho màu "meaningful".
- **Dark/light tự đảo** qua `@media (prefers-color-scheme: dark)` (không cần JS).
- **Nền tint**: dùng palette `-200` / `-300` cho light, `-950` cho dark.

```scss
@media (prefers-color-scheme: dark)  { --background: var(--color-cyan-950); }
@media (prefers-color-scheme: light) { --background: var(--color-cyan-200); }
```

> Khi hover/tap, nền "đậm hơn 1 bậc" (dark `-900`, light `-300`).

---

## 5. Motion

| Tham số | Giá trị chuẩn |
|---------|--------------|
| Duration mặc định | `300ms` (qua token `--duration` / `--transition-duration`) |
| Ease chuẩn | `cubic-bezier(0.65, 0, 0.35, 1)` (ease-in-out) |
| Tap / active press | `transform: scale(0.97)` |
| Chạm (iOS) | `touch-action: manipulation` + `-webkit-touch-callout: none` |
| Icon (stroke) | vẽ bằng `stroke-dasharray` (vd spinner) |
| Fade (show/hide) | `300ms` |

```scss
transform: scale(0.97);              /* khi :active / data-tap */
touch-action: manipulation;          /* bỏ delay tap 300ms, tránh double-tap-zoom */
-webkit-touch-callout: none;         /* chặn context-menu long-press trên iOS Safari */
```

> Duration được truyền xuống tree qua inline style token
> (`style:--transition-duration=...`, `style:--duration=...ms`) để mọi animation con cùng nhịp.

---

## 6. Multi-device

### 6.1. PC only — `@media (hover:hover) and (pointer:fine)`

Bọc **`:hover`** và **tap-scale** (chỉ áp dụng khi có chuột con trỏ):

```scss
@media (hover: hover) and (pointer: fine) {
    &:hover:not(.disabled) { /* ... */ }
}
```

### 6.2. Mobile — `@media (hover:none) and (pointer:coarse)`

```scss
@media (hover: none) and (pointer: coarse) {
    /* (a) size-xs/sm ép font 1rem → chặn iOS auto-zoom khi focus */
    &.size-xs, &.size-sm { font-size: 1rem; }

    /* (b) action button: min touch target 2.75rem (44px) */
    .input-group-actions :global(.button-root) {
        min-width: 2.75rem;
        min-height: 2.75rem;
    }
}
```

- **(a)** font `≥ 16px (1rem)` cho input focusable → **chặn iOS auto-zoom** khi focus.
- **(b)** action button min `2.75rem` (44px) touch target để chạm thoải mái.

---

## 7. Accessibility (BẮT BUỘC)

- **`role` / `aria` đúng ngữ cảnh** — vd Checkbox dùng `role="checkbox"` + `aria-checked`;
  Button icon-only có `aria-label`; suggestion list dùng `role="listbox"` + `role="option"` + `aria-selected`.
- **Control focusable phải có `:focus-visible` ring** (không "nuốt" focus của keyboard).
- **Icon-only phải có `aria-label`** (nếu không, screen reader không đọc được nút).
- **Dùng native control khi được** — Input dùng `<input>` thật (không mô phỏng bằng `div`),
  để giữ keyboard / IME / autocomplete chuẩn.
- `aria-hidden="true"` cho element trang trí (icon, highlight layer); `aria-live` cho thông báo trạng thái.

---

## 8. Cấu trúc file

Layout chuẩn của một component:

```
<component>/
├── Main.svelte          # render (dùng configs.style, handleEvents)
├── _interface.ts        # <Name>Props / <Name>Configs (extends BasicProps/BasicConfigs)
├── _styles.scss         # style riêng, tách khỏi .svelte (thư nguyên trước khi vá)
├── index.ts             # export + context (Symbol) + helpers (validation, …)
└── composables/         # (nếu phức tạp) tách logic style resolution khỏi render
    ├── index.ts
    └── use<Name>*.ts
```

- **Sub-component** (vd `Checkbox/Indicator`): mỗi sub cũng extend `BasicProps`/`BasicConfigs`,
  **đăng ký vào `context.children` bằng Symbol context** (`setContext(Symbol('name-context'), configs)`
  + `getContext`), có **fallback auto-mount** (nếu parent không render sub → parent tự `mount()`
  sub vào `ref`, xem `releaseIndicator` trong `checkbox/index.ts`).
- **Composable** (vd `button/composables/useButton*`): **tách logic style resolution
  (size / color / variant / state) khỏi render** — `Main.svelte` chỉ gọi & ráp.

---

## 9. Checklist khi tạo component mới

Khi viết component mới, chạy lại checklist này:

- [ ] **1.** Props/Configs extend `BasicProps`/`BasicConfigs` (không bịa interface).
- [ ] **2.** Class root đặt đúng `{kebab-name}-root`.
- [ ] **3.** Dùng `styleSynced({ defaultStyles, propStyles }, props.overwriteDefaultStyles)`.
- [ ] **4.** Size resolve theo `props.size ?? formContext?.size ?? client.browser?.size ?? 'md'`.
- [ ] **5.** Mọi màu/đo/rounded chạy qua token (không hardcode).
- [ ] **6.** Có đủ **5 state**: focus, hover, disabled, error, loading.
- [ ] **7.** focus: chọn đúng recipe (field glow / control outline `indigo-500`).
- [ ] **8.** hover bọc trong `@media (hover:hover) and (pointer:fine)` + guard `:not(.disabled)`.
- [ ] **9.** disabled: `opacity: var(--disabled-opacity)` + overlay `::before` + events trả rỗng.
- [ ] **10.** validation-color: valid→`color-success`, invalid→`color-error`, trung lập→`color-default`.
- [ ] **11.** dark/light tự đảo qua `prefers-color-scheme`; tint dùng `-200/-300` (light) / `-950` (dark).
- [ ] **12.** Motion: duration 300ms, tap `scale(0.97)`, `touch-action: manipulation`.
- [ ] **13.** A11y: `role`/`aria` đúng, `:focus-visible` ring, icon-only có `aria-label`, native control khi được.
- [ ] **14.** Đặt cạnh Button/Input → đúng **Bảng đồng bộ min-height** (mục 2.1); icon-only → `aspect-square`.

---

## 10. Lệch chuẩn đã thống nhất (trạng thái hiện tại)

Ghi nhận các điểm "chưa hoàn toàn đồng bộ" giữa 3 component, cùng trạng thái đã thống nhất:

| Mã | Điểm lệch | Trạng thái | Ghi chú |
|----|-----------|-----------|---------|
| **L1** | Focus ring từng khác nhau | **ĐÃ CHUẨN HÓA** | 2 recipe: *field* (border-sky + box-shadow indigo `.15/.10`) & *control* (outline `indigo-500` + offset 2px). **Bổ sung `:focus-visible` cho Checkbox** để đủ 5 state. |
| **L2** | Disabled opacity từng hardcode khác nhau | **ĐỒNG BỘ về token `0.5`** | Mọi component dùng `opacity: var(--disabled-opacity)` (token gốc `0.5`), không còn hardcode. |
| **L4** | Checkbox thiếu a11y + thiếu file style riêng | **ĐÃ BỔ SUNG** | Checkbox có `role`/`aria-checked`, có file `_styles.scss` riêng (riêng khỏi `<style>` trong `.svelte`). |
| **L3** | Button dùng **palette colorRefs** (`indigo`/`cyan`/`sky`…) trong khi hệ token semantic là `primary/success/danger/…` | **CHỜ QUYẾT ĐỊNH** | Xem bên dưới. |

### 10.1. L3 — "màu Button" đang chờ quyết định

**Hiện trạng:** `button.scss` / `button/_styles.scss` dùng map `$colorRefs` ánh xạ
`default→gray, secondary→cyan, success→green, info→sky, warning→amber, error→red` rồi render
nền bằng `var(--color-{ref}-600)`… (palette **Tailwind**). Trong khi **Input / hệ token** dùng
màu **semantic** (`--primary`, `--success`, `--danger`, …).

**Rủi ro:**
- Cùng "mặt hàng màu" (vd `success`) mà Button và Input lấy từ **2 nguồn khác nhau** → dễ lệch
  tone khi đổi brand palette; đổi theme chỉ cần sửa 1 chỗ semantic nhưng Button phải sửa thêm
  map `colorRefs`.
- Button "bỏ qua" lớp `.color-*` semantic → component con dùng Button với `color="success"`
  có thể không ăn khớp màu với Input `.color-success` ngay cạnh.

**Khuyến nghị (nếu chốt hướng chuẩn hóa):**
- Ánh xạ Button về **semantic token**: thay `var(--color-{ref}-600)` bằng token
  `--primary` / `--success` / `--danger` / … (giữ 6 variant, chỉ đổi nguồn màu).
- Giữ palette Tailwind làm **nền dưới** (fallback), nhưng "mặt tiền" màu public của Button
  phải chạy qua semantic token giống Input/Checkbox → 3 component "nói chung 1 ngôn ngữ màu".
- Trước khi code: thống nhất 1 bảng mapping `semantic → token nền/forground` duy nhất,
  đưa vào `variables.scss`, cả 3 component cùng tham chiếu.

> **Trạng thái: CHỜ QUYẾT ĐỊNH** — chưa thay đổi code. Khi có quyết định, cập nhật
> đồng thời `button.scss` + `button/_styles.scss` và mục 4 của tài liệu này.
