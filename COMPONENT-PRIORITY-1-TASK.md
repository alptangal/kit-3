# Component Library Priority 1 Task — UI Foundation

**Goal**: Build 4 essential form/data components before Phase 5 Storefront UI

---

## Components to Build

### 1. Select/Dropdown
- **Scope**: Single & multi-select, searchable, custom options
- **Variants**: default, compact, disabled, error, readonly
- **A11y**: keyboard navigation (arrow keys), ARIA listbox, focus trap
- **API**: `<Select options={[{value, label}]} selected={value} onSelect={handler} />`
- **Demo**: `/ui#select`

### 2. Radio Group
- **Scope**: Single selection from options, stacked/inline layout
- **Variants**: default, disabled, error
- **A11y**: keyboard nav (arrow keys), ARIA radio group, focus management
- **API**: `<RadioGroup options={[...]} selected={value} onSelect={handler} />`
- **Demo**: `/ui#radio`

### 3. Toggle/Switch
- **Scope**: Boolean toggle (on/off), ternary toggle (3 states)
- **Variants**: default, disabled, loading
- **A11y**: keyboard (Space/Enter), ARIA switch, focus indicator
- **API**: `<Toggle checked={bool} onChange={handler} label="..." />`
- **Demo**: `/ui#toggle`

### 4. Table/DataGrid
- **Scope**: Sortable columns, filterable rows, pagination, row selection
- **Features**:
  - Column definitions: name, sortable, filterable, width
  - Sorting: click header to sort asc/desc/none
  - Filtering: optional filter row above header
  - Pagination: show N items per page, prev/next/jump
  - Row selection: checkbox all/individual
  - Compact/normal density
- **A11y**: keyboard nav (arrow keys), focus on sorted column, ARIA sort indicators
- **API**: 
  ```
  <Table 
    columns={[{key, label, sortable, width}, ...]}
    rows={data}
    onSort={(key, dir) => {}}
    onFilter={(filterObj) => {}}
    pagination={{page, pageSize}}
    onPageChange={(page) => {}}
  />
  ```
- **Demo**: `/ui#table`

---

## Component Structure (All)

```
src/lib/components/form/
├── select/
│   ├── Main.svelte         # Main component
│   ├── _interface.ts       # Types (SelectProps)
│   ├── _styles.scss        # Styles with design tokens
│   ├── composables/
│   │   ├── useSelectState.svelte.ts
│   │   └── useSelectKeyboard.svelte.ts
│   └── index.ts            # Export

src/lib/components/element/
├── table/
│   ├── Main.svelte
│   ├── Header.svelte       # Table header with sort indicators
│   ├── Row.svelte          # Table row
│   ├── _interface.ts
│   ├── _styles.scss
│   ├── composables/
│   │   ├── useTableSort.svelte.ts
│   │   ├── useTableFilter.svelte.ts
│   │   └── useTablePagination.svelte.ts
│   └── index.ts

src/lib/components/form/
├── radio/
│   ├── Main.svelte
│   ├── Item.svelte
│   ├── _interface.ts
│   ├── _styles.scss
│   └── index.ts

src/lib/components/form/
├── toggle/
│   ├── Main.svelte
│   ├── _interface.ts
│   ├── _styles.scss
│   └── index.ts
```

---

## Design Token Requirements

All components must use only design tokens (NO hardcoded values):

**Sizes/Spacing**:
- `--min-height-md`, `--min-height-lg` (touch targets ≥44px)
- `--padding-sm`, `--padding-md`, `--gap-md`

**Colors**:
- `--foreground`, `--foreground-300`, `--foreground-200`
- `--background`, `--border`
- `--danger-500`, `--success-500`, `--info-500`

**Typography**:
- `--font-size-sm`, `--font-size-md`

**Effects**:
- `--border-width-md`
- `--radius-sm`, `--box-shadow-sm`

---

## A11y Checklist (All Components)

- [ ] Focus management: visible focus indicator (outline or background)
- [ ] Keyboard navigation: Tab, Arrow keys, Enter/Space where applicable
- [ ] ARIA attributes: `role`, `aria-label`, `aria-expanded`, `aria-selected`
- [ ] Touch targets: minimum 44×44px (verify with `--min-height-*` tokens)
- [ ] Prefers-reduced-motion: respect via `@media (prefers-reduced-motion: reduce)`
- [ ] Disabled state: gray out, prevent interaction, clear visual state
- [ ] Error state: red border, error message, aria-invalid

---

## Testing Requirements

**Unit tests** (Vitest):
- Render without crashing
- Props: selected state, onChange callback
- Keyboard navigation (arrow keys, Enter/Space)
- Accessibility attributes present

**Integration tests** (Playwright):
- Select option via click
- Select option via keyboard
- Multi-select (if applicable)
- Sort table column
- Filter/paginate

**Visual tests** (screenshots):
- Default, hover, focus, disabled, error states
- Light/dark mode if applicable

---

## Implementation Order

1. **Select** (most complex selection UI) → RadioGroup (simpler) → Toggle (simplest state)
2. **Table** (largest component, no dependencies)
3. Add all 4 to `/ui` demo page

---

## Tech Debt: Phase 4 Admin UI Pages (Refactor After Priority 1)

**Backlog for refactoring** (don't build yet, will refactor when Priority 1 done):

| Page | Feature | Components Needed |
|------|---------|-------------------|
| `/admin/promotions/list` | Pricing #30 | **Table** (sort, paginate) |
| `/admin/promotions/create` | Pricing #30 | **Select** (type), **DatePicker**, TextInput, NumberInput |
| `/admin/pos/sessions/list` | POS #31 | **Table** (sort, paginate) |
| `/admin/pos/sessions/open` | POS #31 | NumberInput, Textarea |
| `/admin/stock-takes/list` | Stock #32 | **Table** (sort, paginate) |
| `/admin/stock-takes/detail` | Stock #32 | **Table**, **Radio**, **Toggle** |

**Action**: Once Priority 1 components built, create "Refactor Phase 4 Admin UI" task to retrofit these pages with new components.

---

## Deliverables

✅ Select component (single + multi, searchable)
✅ RadioGroup component (single selection)
✅ Toggle component (boolean + ternary)
✅ Table/DataGrid component (sort, filter, paginate, select rows)
✅ All 4 exported in `src/lib/components/index.ts`
✅ Demo page `/ui` updated with all 4 components
✅ Tests passing (unit + integration)
✅ Accessibility audit passed (WCAG 2.1 AA)
✅ Design tokens verified (no hardcoded values)
✅ Tech debt doc created for Phase 4 admin UI refactor

---

## Estimate

- **Select**: 2-3 days (complexity: searchable options, keyboard nav)
- **RadioGroup**: 1 day (simpler than Select)
- **Toggle**: 0.5 day (simple boolean)
- **Table**: 2-3 days (multiple features: sort, filter, paginate, selection)
- **Testing + Demo**: 1 day

**Total: 7-8 days (~1 week)**
