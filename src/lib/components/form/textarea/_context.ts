// src/lib/components/form/textarea/_context.ts
// Tách context ra file leaf (KHÔNG import Main.svelte) để tránh circular import
// khi composables (useMessageDisplay) gọi getTextareaContext — mirror
// radiogroup/_context.ts + select/_context.ts (precedent file leaf, an toàn vòng lặp module).
import { getContext, setContext } from 'svelte';
import type { TextareaConfigs } from './_interface';

const NAME = Symbol('textarea-context');
export function setTextareaContext(context: TextareaConfigs) {
	setContext(NAME, context);
}
export function getTextareaContext(): TextareaConfigs | undefined {
	return getContext(NAME);
}
