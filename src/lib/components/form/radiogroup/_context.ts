// src/lib/components/form/radiogroup/_context.ts
// Tách context ra file riêng (KHÔNG import Main.svelte) để tránh circular import
// khi composables (useMessageDisplay) gọi getRadioContext — mirror
// select/_context.ts (precedent file leaf, an toàn vòng lặp module).
import { getContext, setContext } from 'svelte';
import type { RadioGroupConfigs } from './_interface';

const NAME = Symbol('radiogroup-context');
export function setRadioContext(context: RadioGroupConfigs) {
	setContext(NAME, context);
}
export function getRadioContext(): RadioGroupConfigs | undefined {
	return getContext(NAME);
}
