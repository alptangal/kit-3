// src/lib/components/form/select/_context.ts
// Tách context ra file riêng (KHÔNG import Main.svelte) để tránh circular import
// khi <Label> (label/Main.svelte) gọi getSelectContext từ barrel '../select' trong SSR.
// Mirror pattern checkbox (checkbox/index.ts), nhưng đặt ở file leaf → an toàn vòng lặp module.
import { getContext, setContext } from 'svelte';
import type { SelectConfigs } from './_interface';

const NAME = Symbol('select-context');
export function setSelectContext(context: SelectConfigs) {
	setContext(NAME, context);
}
export function getSelectContext(): SelectConfigs | undefined {
	return getContext(NAME);
}
