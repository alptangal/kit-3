// src/lib/components/form/input-otp/_context.ts
// Tách context ra file leaf (KHÔNG import Main.svelte) để tránh circular import
// khi composables (useMessageDisplay) gọi getInputOtpContext — mirror
// radiogroup/_context.ts + textarea/_context.ts (precedent file leaf, an toàn vòng lặp module).
import { getContext, setContext } from 'svelte';
import type { InputOtpConfigs } from './_interface';

const NAME = Symbol('input-otp-context');
export function setInputOtpContext(context: InputOtpConfigs) {
	setContext(NAME, context);
}
export function getInputOtpContext(): InputOtpConfigs | undefined {
	return getContext(NAME);
}
