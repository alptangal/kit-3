// $modules/numberKeyboardState.svelte.ts

import type { NumberInputTarget } from '$components/form/input/_interface';

export const numberKeyboardState = $state<{
	target: NumberInputTarget | null;
	currentIndexCursor?: number;
}>({
	target: null
});
