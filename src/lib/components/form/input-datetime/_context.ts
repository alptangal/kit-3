// src/lib/components/form/input-datetime/_context.ts
// Tách context ra file leaf (KHÔNG import Main.svelte) để tránh circular import
// — mirror input-otp/_context.ts + radiogroup/_context.ts (precedent file leaf).
import { getContext, setContext } from 'svelte';
import type { InputDatetimeConfigs } from './_interface';

const NAME = Symbol('input-datetime-context');
export function setInputDatetimeContext(context: InputDatetimeConfigs) {
	setContext(NAME, context);
}
export function getInputDatetimeContext(): InputDatetimeConfigs | undefined {
	return getContext(NAME);
}
