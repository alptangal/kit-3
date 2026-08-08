export { default as Input } from './input/Main.svelte';
export { default as Form } from './form/Main.svelte';
export { default as Label } from './label/Main.svelte';
export { default as TextField } from './textField/Main.svelte';
export { default as Description } from './description/Main.svelte';
export { default as FieldMessages } from './fieldMessages/Main.svelte';

import { default as CheckboxRoot } from './checkbox/Main.svelte';
import { default as Indicator } from './checkbox/Indicator/Main.svelte';
import { default as Checked } from './checkbox/Indicator/Checked/Main.svelte';
import { default as Unchecked } from './checkbox/Indicator/Unchecked/Main.svelte';
export const Checkbox = Object.assign(CheckboxRoot, {
	Indicator: Object.assign(Indicator, { Checked, Unchecked })
});
