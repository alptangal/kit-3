# Component Library Priority 1 — Core UI Components

**Estimate**: 5-7 work days (focus: compound pattern, design tokens, a11y, tests)

**Why First**: These 4 components are needed to refactor Phase 4 admin pages (#30/#31/#32) — currently using basic HTML. Once ready, those pages + Phase 5 UI will reuse them.

---

## Component 1: Select (Dropdown)

**Compound Pattern**:
```svelte
<Select.Root bind:value>
  <Select.Trigger />
  <Select.Content>
    <Select.Item value="option1">Option 1</Select.Item>
    <Select.Item value="option2">Option 2</Select.Item>
  </Select.Content>
</Select.Root>
```

**Implementation** (`src/lib/components/form/select`):
1. **Root** — state management (value, open/close, keyboard nav)
2. **Trigger** — clickable button showing selected value
3. **Content** — dropdown listbox
4. **Item** — individual option
5. **Group** — optgroup support
6. **Separator** — visual divider

**Features**:
- Keyboard navigation (arrow keys, enter, escape, type to search)
- Multi-select variant
- Disabled state
- Placeholder
- Searchable (filter options)
- Custom render via slot

**Design Tokens** (CSS variables):
- `--select-bg`: background color
- `--select-border`: border color
- `--select-border-radius`: corner radius
- `--select-padding`: internal spacing
- `--select-text-color`: text color
- `--select-hover-bg`: hover state
- `--select-focus-ring`: focus indicator
- `--select-disabled-opacity`: disabled state

**Accessibility**:
- ARIA: `role="combobox"`, `aria-expanded`, `aria-controls`
- Keyboard: arrows, enter, escape, type-ahead
- Screen reader: option count, selected state
- Focus management: auto-focus listbox on open

**Tests**:
- Unit: click trigger → open/close, select option, keyboard nav, type-ahead
- Integration: form submission with select value
- A11y: axe scan, screen reader testing

**Files**:
```
src/lib/components/form/select/
  Root.svelte
  Trigger.svelte
  Content.svelte
  Item.svelte
  Group.svelte
  Separator.svelte
  index.ts (exports)
  select.test.ts
  select.a11y.test.ts
```

---

## Component 2: RadioGroup

**Compound Pattern**:
```svelte
<RadioGroup.Root bind:value>
  <RadioGroup.Item value="a"><RadioGroup.Label>Option A</RadioGroup.Label></RadioGroup.Item>
  <RadioGroup.Item value="b"><RadioGroup.Label>Option B</RadioGroup.Label></RadioGroup.Item>
</RadioGroup.Root>
```

**Implementation** (`src/lib/components/form/radio-group`):
1. **Root** — manage selected value, keyboard nav
2. **Item** — individual radio + input
3. **Label** — associated label text

**Features**:
- Single selection only
- Keyboard: arrow keys to navigate, space to select
- Grouped layout (vertical/horizontal)
- Disabled items
- Custom icon rendering

**Design Tokens**:
- `--radio-size`: radio button diameter
- `--radio-border`: border color
- `--radio-bg`: background
- `--radio-checked-bg`: checked state background
- `--radio-checked-indicator`: inner dot color
- `--radio-focus-ring`: focus indicator
- `--radio-disabled-opacity`: disabled state
- `--radio-label-gap`: spacing between radio + label

**Accessibility**:
- ARIA: `role="radio"`, `aria-checked`
- Keyboard: arrow keys for navigation, space to select
- Focus: manages focus between items
- Screen reader: reads all options with selection status

**Tests**:
- Unit: select item, keyboard navigation, disabled state
- Integration: form with radio group
- A11y: keyboard navigation, screen reader

**Files**:
```
src/lib/components/form/radio-group/
  Root.svelte
  Item.svelte
  Label.svelte
  index.ts
  radio-group.test.ts
  radio-group.a11y.test.ts
```

---

## Component 3: Toggle (Switch/Checkbox)

**Compound Pattern**:
```svelte
<Toggle.Root bind:pressed>
  <Toggle.Icon />
  <Toggle.Label>Enable feature</Toggle.Label>
</Toggle.Root>
```

**Implementation** (`src/lib/components/form/toggle`):
1. **Root** — state (pressed/unpressed), click handler
2. **Icon** — visual indicator (checkmark/x/icon)
3. **Label** — associated text (optional)

**Variants**:
- **Checkbox** — small square, checkmark when checked
- **Switch** — toggle-like, animated indicator
- **Button Toggle** — button-like appearance (can be multi-select in group)

**Features**:
- Keyboard: space to toggle
- Disabled state
- Indeterminate state (for parent checkbox in tree)
- Custom icon slot
- Size variants (sm, md, lg)

**Design Tokens**:
- `--toggle-size`: dimensions
- `--toggle-border-color`: border
- `--toggle-bg`: unchecked background
- `--toggle-checked-bg`: checked background
- `--toggle-indicator-color`: checkmark/switch dot
- `--toggle-focus-ring`: focus indicator
- `--toggle-disabled-opacity`: disabled state
- `--toggle-animation-duration`: transition time (for switch variant)

**Accessibility**:
- ARIA: `role="checkbox"`, `aria-checked`, `aria-pressed` (for button toggle)
- Keyboard: space to toggle
- Focus: visible focus indicator
- Screen reader: label, checked state

**Tests**:
- Unit: toggle pressed state, keyboard space, disabled
- Integration: form with toggles
- A11y: focus, keyboard, screen reader

**Files**:
```
src/lib/components/form/toggle/
  Root.svelte
  Icon.svelte
  Label.svelte
  variants.ts (checkbox, switch, button)
  index.ts
  toggle.test.ts
  toggle.a11y.test.ts
```

---

## Component 4: Table

**Compound Pattern**:
```svelte
<Table.Root>
  <Table.Header>
    <Table.Row>
      <Table.Head>Header 1</Table.Head>
      <Table.Head>Header 2</Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    <Table.Row>
      <Table.Cell>Data 1</Table.Cell>
      <Table.Cell>Data 2</Table.Cell>
    </Table.Row>
  </Table.Body>
</Table.Root>
```

**Implementation** (`src/lib/components/data/table`):
1. **Root** — container, provides row/col context
2. **Header** — thead wrapper
3. **Body** — tbody wrapper
4. **Row** — tr with hover/selection state
5. **Head** — th with sort indicator, sticky header
6. **Cell** — td with alignment variants

**Features**:
- Sortable columns (click header to sort ASC/DESC)
- Selectable rows (checkbox in first column)
- Sticky header
- Pagination controls
- Column alignment (left, center, right)
- Empty state message
- Loading skeleton rows
- Hover row highlight

**Design Tokens**:
- `--table-border-color`: cell borders
- `--table-bg`: background
- `--table-row-hover-bg`: row hover state
- `--table-row-selected-bg`: selected row background
- `--table-header-bg`: header background
- `--table-header-text-color`: header text
- `--table-text-color`: cell text
- `--table-padding`: cell padding
- `--table-font-size`: text size
- `--table-row-height`: row height

**Accessibility**:
- ARIA: `role="table"`, `role="row"`, `role="columnheader"`, `role="rowheader"`
- Keyboard: arrow keys to navigate rows, enter to select, space to toggle
- Screen reader: announces table structure, row counts
- Focus: visible focus on rows/cells
- Sort: announces sort direction changes

**Tests**:
- Unit: sort, select rows, pagination
- Integration: data binding, sort callback, selection callback
- A11y: keyboard nav, screen reader, focus management

**Files**:
```
src/lib/components/data/table/
  Root.svelte
  Header.svelte
  Body.svelte
  Row.svelte
  Head.svelte
  Cell.svelte
  utils.ts (sort, filter, pagination)
  index.ts
  table.test.ts
  table.a11y.test.ts
```

---

## Shared Infrastructure

**Design System** (`src/lib/styles/design-tokens.css`):
```css
:root {
  /* Colors */
  --color-primary: #0066cc;
  --color-success: #28a745;
  --color-danger: #dc3545;
  --color-warning: #ffc107;
  
  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  
  /* Typography */
  --font-family-base: system-ui, -apple-system, sans-serif;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.25rem;
  
  /* Border Radius */
  --radius-sm: 0.25rem;
  --radius-base: 0.5rem;
  --radius-lg: 1rem;
  
  /* Focus & Animation */
  --focus-ring-width: 2px;
  --focus-ring-color: rgba(0, 102, 204, 0.5);
  --transition-duration: 150ms;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #1a1a1a;
    --color-text: #f0f0f0;
    /* ... dark mode overrides */
  }
}
```

**Utilities** (`src/lib/components/utilities`):
- `useKeyboard.svelte.ts` — keyboard event handler
- `useFocus.ts` — focus management
- `useClickOutside.ts` — click-outside detection
- `useEscapeKey.ts` — escape key handler
- `useId.ts` — unique ID generation
- `a11y.ts` — accessibility helpers (ARIA)

---

## Task Breakdown

### Day 1: Select Component
- [ ] Design + implement Root, Trigger, Content, Item
- [ ] Keyboard navigation (arrows, enter, escape)
- [ ] Type-ahead search
- [ ] Unit tests
- [ ] A11y audit

### Day 2: RadioGroup + Toggle
- [ ] RadioGroup: Root, Item, Label
- [ ] Toggle: Root, Icon, Label (checkbox variant)
- [ ] Keyboard: space, arrows
- [ ] Tests
- [ ] A11y audit

### Day 3: Toggle Variants + Table Start
- [ ] Toggle: switch + button variants
- [ ] Table: Root, Header, Body, Row, Head, Cell structure
- [ ] Basic styling
- [ ] Sortable headers (add click handler, show direction indicator)

### Day 4: Table Features
- [ ] Selectable rows (checkbox)
- [ ] Pagination
- [ ] Column alignment
- [ ] Empty state + loading skeleton
- [ ] Unit tests

### Day 5: Design Tokens + Shared Utils
- [ ] Create design-tokens.css (colors, spacing, typography, etc.)
- [ ] Create keyboard/focus/click-outside utilities
- [ ] Apply tokens to all 4 components
- [ ] Dark mode support

### Day 6: A11y + Integration Tests
- [ ] Full a11y audit (keyboard nav, screen reader, focus)
- [ ] Component integration tests
- [ ] Storybook stories for documentation
- [ ] Fix accessibility gaps

### Day 7: Documentation + Refactor Phase 4 Pages
- [ ] Component README (API, examples, accessibility)
- [ ] Update Phase 4 admin pages (#30/#31/#32) to use new components
- [ ] Test refactored pages
- [ ] Polish

---

## Phase 4 Pages to Refactor (Tech Debt)

Once Priority 1 components ready:

| Page | Current | Components Needed | Priority |
|------|---------|-------------------|----------|
| Promotions List | Basic table | Table + Select (filter) | High |
| Create Promotion | Basic form | Select (type), RadioGroup (discount type) | High |
| POS Sessions List | Basic table | Table + Toggle (session status) | High |
| Open POS Session | Basic form | Select (branch), RadioGroup (payment type) | Medium |
| Stock Takes List | Basic table | Table + Toggle (status) | High |
| Stock Take Detail | Basic form | Table (items), Toggle (item checked) | Medium |

---

## Definition of Done

- [ ] All 4 components built with compound pattern
- [ ] Design tokens applied (light + dark mode)
- [ ] 100% keyboard navigation support
- [ ] Full a11y compliance (WCAG 2.1 AA)
- [ ] Unit tests (>80% coverage)
- [ ] Integration tests (component + form)
- [ ] Storybook stories
- [ ] Accessibility audit passed
- [ ] At least 2 Phase 4 admin pages refactored to use components
- [ ] Documentation + usage examples

---

## Timeline

- **Component Implementation**: Days 1-4 (4 days)
- **Design System + Utils**: Day 5 (1 day)
- **A11y + Testing**: Day 6 (1 day)
- **Documentation + Refactor Pages**: Day 7 (1 day)

**Total**: 7 work days (1 week)

After this, Phase 5 implementation can proceed with confidence in component library.
