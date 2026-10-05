// src/lib/components/form/toggle/_context.ts
// Tách context ra file leaf (KHÔNG import Main.svelte) để tránh circular import
// khi composables (useMessageDisplay) gọi getToggleContext — mirror
// slider/_context.ts + radiogroup/_context.ts + textarea/_context.ts
// (precedent file leaf, an toàn vòng lặp module).
import { getContext, setContext } from 'svelte';
import type { ToggleConfigs } from './_interface';

const NAME = Symbol('toggle-context');
export function setToggleContext(context: ToggleConfigs) {
	setContext(NAME, context);
}
export function getToggleContext(): ToggleConfigs | undefined {
	return getContext(NAME);
}
