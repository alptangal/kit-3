// src/lib/components/element/toggle/index.ts
// Export Toggle (element) — nút nhấn 2 trạng thái pressed/unpressed
// (shadcn base/toggle). Atom nhẹ: không context, không form.
import type { ToggleConfigs, ToggleProps, ToggleSize, ToggleVariant } from './_interface';

export { default as Toggle } from './Main.svelte';
export type { ToggleProps, ToggleConfigs, ToggleVariant, ToggleSize } from './_interface';
