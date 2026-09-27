# DESIGN.md — Design Foundation for Phase 3

## Overview

This document establishes the design foundation for Phase 3: UI/UX Design Foundation. It defines the design system, design tokens, component patterns, and accessibility guidelines that will govern all UI development going forward.

The goal is to **chốt nền tảng thiết kế trước khi code Phase 3 phình to** — tránh phải refactor component nhiều lần khi UI thay đổi sau.

---

## 1. Design Tokens

All visual properties are defined via CSS custom properties (variables) in `:root`. Tokens are organized by category and exposed through data-size and data-color attributes.

### 1.1 Spacing System (`--spacing`)

| Scale | Value | Usage |
|-------|-------|-------|
| `--spacing-xs` | 0.125rem | tight spacing |
| `--spacing-sm` | 0.25rem | default spacing |
| `--spacing-md` | 0.5rem | standard spacing |
| `--spacing-lg` | 1rem | large spacing |
| `--spacing-xl` | 2rem | section spacing |

```scss
:root {
  --spacing-xs: 0.125rem;
  --spacing-sm: 0.25rem;
  --spacing-md: 0.5rem;
  --spacing-lg: 1rem;
  --spacing-xl: 2rem;
}
```

### 1.2 Border Radius System (`--radius`)

| Scale | Value | Usage |
|-------|-------|-------|
| `--radius-xs` | 0.125rem | pill corners, small inputs |
| `--radius-sm` | 0.25rem | default corners |
| `--radius-md` | 0.5rem | standard corners |
| `--radius-lg` | 1rem | card corners |
| `--radius-full` | 9999px | pill/fully rounded |

```scss
:root {
  --radius-xs: 0.125rem;
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 1rem;
  --radius-full: 9999px;
}
```

### 1.3 Typography / Size Scale

| Scale | --font-size | --line-height | Usage |
|-------|-------------|---------------|-------|
| `xs` | 0.75rem | 1rem | caption, small text |
| `sm` | 0.875rem | 1.25rem | body small |
| `md` | 1rem | 1.5rem | body default |
| `lg` | 1.125rem | 1.75rem | heading |
| `xl` | 1.25rem | 1.75rem | large text |
| `2xl` | 1.5rem | 2rem | hero, section headings |
| `3xl` | 1.875rem | 2.25rem | major heading |
| `4xl` | 2.25rem | 2.5rem | page title |
| `5xl` | 3rem | 3.5rem | major section |
| `6xl` | 3.75rem | 4.5rem | hero title |
| `7xl` | 4.5rem | 5.25rem | large hero |
| `8xl` | 6rem | 7rem | display |
| `9xl` | 8rem | 9.5rem | massive display |

### 1.4 Color System

Base colors defined in HSL in `theme.scss` / `colors.scss`. Color aliases map to these base colors.

| Alias | Mapped Color | Usage |
|-------|-------------|-------|
| `default` | `--default-300` / `--default-400` (light mode) | neutral backgrounds |
| `secondary` | `--secondary-300` / `--secondary-400` | secondary actions |
| `primary` | `--primary-300` / `--primary-400` | primary actions, primary buttons |
| `success` | `--success-300` / `--success-400` | success states |
| `warning` | `--warning-300` / `--warning-400` | warnings |
| `error` / `danger` | `--danger-300` / `--danger-400` | errors |
| `info` | `--primary` | info/tooltips |

#### Color Variants (light/dark mode)

```scss
:root[data-theme='light'] {
  [data-color='primary'] { --color: var(--primary-300); }
  [data-color='secondary'] { --color: var(--secondary-300); }
  /* ... etc */
}

:root[data-theme='dark'] {
  [data-color='primary'] { --color: var(--primary-400); }
  [data-color='secondary'] { --color: var(--secondary-400); }
  /* ... etc */
}
```

### 1.5 Shadow System

```scss
:root {
  --shadow-xs: 0 1px 2px 0 var(--shadow-color);
  --shadow-sm: 0 1px 3px 0 var(--shadow-color), 0 1px 2px -1px var(--shadow-color);
  --shadow-md: 0 4px 6px -1px var(--shadow-color), 0 2px 4px -2px var(--shadow-color);
  --shadow-lg: 0 10px 15px -3px var(--shadow-color), 0 4px 6px -4px var(--shadow-color);
  --shadow-xl: 0 20px 25px -5px var(--shadow-color), 0 8px 10px -6px var(--shadow-color);
}
```

---

## 2. Component Library Patterns

### 2.1 Compound Component Pattern

All UI components use the **compound component pattern** with a main component + configurable sub-parts.

#### Button (compound)

```
src/lib/components/element/button/
├── Main.svelte        ← main button component
├── _interface.ts      ← types (ButtonProps, ButtonConfigs)
├── _styles.scss       ← styling
├── composables/
│   ├── useButtonVariant.ts
│   ├── useButtonColor.ts
│   ├── useButtonSize.ts
│   └── useButtonState.ts
└── index.ts           ← exports
```

Key features:
- **Variant system**: `solid`, `outline`, `ghost`, `secondary`, `primary`, `error`, `success`, `warning`, `info`
- **Size system**: `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `4xl`, `5xl`, `6xl`, `7xl`, `8xl`, `9xl`, `full-width`
- **Rounded corners**: `xs`, `sm`, `md`, `lg`, `xl`, `full` (full circle)
- **Icon support**: leading icon, trailing icon, both
- **Ripple effect**: optional, mobile-optimized
- **Tooltip integration**: built-in `has_tooltip` class + custom tooltip via `tooltip` prop
- **Navigation**: `to` prop for client-side navigation via `goto()`
- **Loading state**: spinner + disabled styling
- **Confirm dialog**: `confirmText` prop
- **Debounce**: prevents rapid clicks

#### Input (compound)

```
src/lib/components/form/input/
├── Main.svelte        ← main input component (complex, ~1950 lines)
├── _interface.ts      ← types (InputProps, InputConfigs)
├── styles.scss        ← styling
├── composables/       ← reusable logic
└── index.ts           ← exports
```

Key features:
- **Type support**: `text`, `number`, `email`, `phone`, `password`, `currency`
- **Auto-complete**: email domain suggestions + phone country code suggestions
- **Action buttons**: clear, copy, paste, show password
- **Validation**: integrated with form context, validation events, processing delays
- **Visual number keyboard**: mobile-optimized numeric input
- **Mask value**: auto-size adjustment for mobile
- **Highlight overlay**: regex-based text highlighting
- **Accessibility**: focus management, screen reader support

#### Tooltip (compound)

```
src/lib/components/element/tooltip/
├── Main.svelte        ← tooltip component (~200 lines)
├── _interface.ts      ← types
└── index.ts           ← exports
```

Key features:
- **Positioning**: auto-positioned with arrow
- **Delay**: show/hide delay configuration
- **Offset**: configurable offset from trigger
- **Action buttons**: optional info button with timeout
- **Mobile support**: touch-friendly

#### Checkbox (compound)

```
src/lib/components/form/checkbox/
├── Main.svelte
├── _interface.ts
└── index.ts
```

### 2.2 Variant & Size Usage

Components accept `variant` and `size` as string props. Valid values are defined in the `Size` and `Color` enums.

```svelte
<!-- Button variants -->
<Button variant="solid" />    {/* default */}
<Button variant="outline" />
<Button variant="ghost" />
<Button variant="primary" />
<Button variant="secondary" />
<Button variant="success" />
<Button variant="warning" />
<Button variant="error" />    {/* alias for danger */

<!-- Button sizes -->
<Button size="sm" />
<Button size="md" />
<Button size="lg" />
<Button size="xl" />
<Button size="2xl" />    {/* larger */}
<Button size="xs" />     {/* smaller */

<!-- Input sizes -->
<Input size="sm" />
<Input size="md" />
<Input size="lg" />
```

### 2.3 State-Based Styling

Components use `$state` (Svelte 5 runes) for runtime state, with CSS classes toggled based on state.

```svelte
<script>
  let configs: ButtonConfigs = $state({
    status: {},
    get style() { ... }  // derived style based on props + state
  });
</script>

<button class={configs.style}>
  {/* class toggles: variant-{variant}, size-{size}, disabled, loading, etc. */}
</button>
```

Pattern: `styleDerived` computed property generates array of CSS classes:
```scss
const defaultStyles = [
  'button-root',
  `variant-${variantDerived}`,
  `size-${sizeDerived}`,
  // ... other conditional classes
];
```

### 2.4 Responsive & Mobile-First

- All components support `client.browser?.isMobile` flag
- Visual number keyboard for `type="number"` on mobile
- Visual input visual for focus on mobile
- Touch-target minimum: 44px (enforced via design tokens)

### 2.5 Accessibility (a11y)

- **Focus management**: explicit focus events, focus-return after interactions
- **Screen readers**: `aria-label`, `aria-describedby`, `role="button"`, `role="tooltip"`
- **Color contrast**: all color tokens defined with WCAG AA compliance in mind
- **Focus-visible**: `:focus-visible` styles available via `data-focus-visible` flag
- **Keyboard navigation**: arrow keys, Enter, Tab, Escape all supported in relevant components
- **Reduced motion**: `prefers-reduced-motion` support via `$effect` guards

---

## 3. UI Page Structure

### 3.1 `/ui` Route (demo page)

```
src/routes/ui/+page.svelte
```

Purpose: Development/demo showcase of all components. Contains:
- Button demo (all variants, sizes)
- Tooltip demo (with/without action buttons)
- Input demo (all types: text, number, email, phone, password)
- Checkbox demo
- Layout: flex column, center-aligned, full height

### 3.2 Component API Documentation

Each component ships with:
- `Main.svelte` — the component implementation
- `_interface.ts` — TypeScript types (props, configs, variants)
- `index.ts` — barrel export
- Optional: `composables/` — extracted logic, reusable hooks

Example API surface:

```typescript
// ButtonProps key fields
type ButtonProps = {
  type?: 'button' | 'submit' | 'reset';
  variant?: 'solid' | 'outline' | 'ghost' | 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  size?: Size;  // 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | '8xl' | '9xl'
  icon?: string | { leading?: string; trailing?: string };
  color?: Color;  // 'default' | 'info' | 'success' | 'warning' | 'error' | 'secondary' | 'primary'
  disabled?: boolean;
  loading?: boolean;
  loadingSpinner?: boolean;
  tooltip?: string;
  confirmText?: string;
  onLongPress?: (e: PointerEvent) => void;
  // ... additional fields
};
```

---

## 4. Layout & Page Structure

### 4.1 Authorized Layout

```svelte
<!-- src/routes/(authorized)/+layout.svelte -->
<svelte:window on:keydown={handleKeyboardNav} />
<div class="flex min-h-screen flex-col">
  <header class="h-16 border-b ...">
    <!-- Top bar with role-specific actions -->
  </header>
  
  <main class="flex-1 p-4">
    {@render children()}
  </main>
  
  <footer class="h-16 border-t ...">
    <!-- Footer -->
  </footer>
</div>
```

**Rule**: Must always contain `{@render children()}` — without it, URL stays 200 but DOM is empty (blank page).

### 4.2 Unauthorized Layout

```
src/routes/(unauthorized)/login/+server.ts
src/routes/(unauthorized)/login/
```

Login flow pages with no layout wrapper — bare page content.

---

## 5. Theme System

### 5.1 Light/Dark Mode

- Default: `system` (follows OS preference)
- Toggle available via `[data-theme='light']` / `[data-theme='dark']` / `[data-theme='auto']`
- Theme switch persists to `localStorage` under key `"app-theme"`

```html
<body data-theme="auto">
  <!-- or: data-theme="light" / data-theme="dark" -->
</body>
```

### 5.2 Color Adaptation

When theme changes, color aliases adapt:

```scss
:root[data-theme='light'] [data-color='primary'] { --color: var(--primary-300); }
:root[data-theme='dark']  [data-color='primary'] { --color: var(--primary-400); }
```

---

## 6. Breakpoints & Responsive

| Breakpoint | Condition | Usage |
|------------|-----------|-------|
| `xs` | `max-width: 640px` | phone |
| `sm` | `min-width: 641px` | small phone / large phone |
| `md` | `min-width: 768px` | tablet |
| `lg` | `min-width: 1024px` | small laptop / large tablet |
| `xl` | `min-width: 1280px` | laptop |
| `2xl` | `min-width: 1536px` | desktop |
| `3xl` | `min-width: 1920px` | large desktop / TV |

CSS usage:

```scss
@media (min-width: $sm) { ... }
@media (min-width: $md) { ... }
@media (min-width: $lg) { ... }
```

---

## 7. Development Guidelines

### 7.1 New Component Creation

1. **Start with types**: Define `MainProps` and `MainConfigs` interfaces in `_interface.ts`
2. **Implement main component**: `Main.svelte` with `$state` for runtime state
3. **Extract composables**: Move complex logic to `composables/` directory
4. **Add styling**: Use CSS variables from design tokens; avoid hardcoded values
5. **Export barrel**: `index.ts` re-exports types and component
6. **Add to `/ui` page**: Ensure new component is visible in demo

### 7.2 Styling Rules

- **Never use hardcoded values** for: colors, spacing, radii, font-sizes
- **Always use CSS custom properties** from the design token system
- **Use `var()` fallbacks**: `color: var(--color-primary, #333);` as safety net
- **Component-scoped styles**: Use `scoped` or `module` syntax in Svelte
- **Global utilities**: `_variables.scss`, `_theme.scss`, `_colors.scss` are imported at root

### 7.3 Accessibility Checklist (per component)

- [ ] Focus management (enter/exit focus states)
- [ ] ARIA labels where appropriate
- [ ] Keyboard support (Tab, Enter, Escape, arrows)
- [ ] Color contrast checks (WCAG AA minimum)
- [ ] Reduced motion support
- [ ] Touch target ≥ 44px
- [ ] Screen reader friendly

### 7.4 State Management

- Use `$state` (Svelte 5 runes) for local component state
- Derived state via `$derived.by()` for computed classes/styles
- Effects via `$effect` for side impacts (form registration, event listeners)
- Cleanup in `$effect` cleanup functions or `onDestroy`

### 7.5 Versioning & Migration

- Major version bumps for breaking API changes
- Minor version for new features (new variants, new props)
- Patch for bug fixes
- Deprecation path: old props still work for 2 major versions before removal

---

## 8. Roadmap Integration

### 8.1 Phase 3 Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Design tokens (this file) | ✅ Complete | Ready for use |
| Component library refactor | 🔄 In progress | Button, Input, Tooltip, Checkbox already exist |
| Theme switcher UI | ⏳ Pending | Needs toggle component |
| Accessibility audit | ⏳ Pending | Review existing components |
| TV/kiosk layout | ⏳ Pending | Separate design language |
| POS vs storefront design languages | ⏳ Pending | Two distinct UX paths |

### 8.2 Immediate Next Steps

1. **Component audit**: Review existing components against DESIGN.md patterns
2. **Token migration**: Ensure all hardcoded values → CSS variables
3. **TV/kiosk design language**: Define separate design tokens for dashboard digital signage
4. **POS vs storefront**: Establish two design language profiles sharing token base
5. **Phase 3 kickoff**: Begin UI development with DESIGN.md as single source of truth

---

## 9. References & Related Files

- `src/lib/assets/styles/theme.scss` — color system implementation
- `src/lib/assets/styles/variables.scss` — design token variables
- `src/lib/components/element/button/` — Button compound component
- `src/lib/components/form/input/` — Input compound component  
- `src/lib/components/element/tooltip/` — Tooltip component
- `src/lib/components/form/checkbox/` — Checkbox component
- `src/routes/ui/+page.svelte` — Component demo page
- `src/routes/(authorized)/+layout.svelte` — Authorized layout (must have `@render children()`)
- `src/lib/modules/schema.ts` — Couchbase schema driving form generation
- `DESIGN-NOTES.md` — implementation notes from this session

---

*Document generated for Phase 3: UI/UX Design Foundation planning.*
*Last updated: 2026-09-27*