// src/lib/components/form/switch/_context.ts
// Tách context ra file leaf (KHÔNG import Main.svelte) để tránh circular import
// khi composables (useMessageDisplay) gọi getSwitchContext — mirror
// slider/_context.ts + radiogroup/_context.ts + textarea/_context.ts
// (precedent file leaf, an toàn vòng lặp module).
import { getContext, setContext } from 'svelte';
import type { SwitchConfigs } from './_interface';

const NAME = Symbol('switch-context');
export function setSwitchContext(context: SwitchConfigs) {
	setContext(NAME, context);
}
export function getSwitchContext(): SwitchConfigs | undefined {
	return getContext(NAME);
}
