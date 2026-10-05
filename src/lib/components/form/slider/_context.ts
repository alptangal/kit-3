// src/lib/components/form/slider/_context.ts
// Tách context ra file leaf (KHÔNG import Main.svelte) để tránh circular import
// khi composables (useMessageDisplay) gọi getSliderContext — mirror
// radiogroup/_context.ts + textarea/_context.ts (precedent file leaf, an toàn vòng lặp module).
import { getContext, setContext } from 'svelte';
import type { SliderConfigs } from './_interface';

const NAME = Symbol('slider-context');
export function setSliderContext(context: SliderConfigs) {
	setContext(NAME, context);
}
export function getSliderContext(): SliderConfigs | undefined {
	return getContext(NAME);
}
