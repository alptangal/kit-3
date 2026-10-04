// src/lib/components/form/select/index.ts

import Main from './Main.svelte';

export type { SelectProps, SelectConfigs, SelectOption, SelectOptionGroup } from './_interface';

export { Main as Select };
export default Main;

// Re-export context (đặt ở _context.ts — file leaf, không import Main.svelte —
// để <Label> gọi getSelectContext mà không kích hoạt circular import với Main.svelte)
export { setSelectContext, getSelectContext } from './_context';
