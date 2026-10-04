export { default as Input } from './input/Main.svelte';
export { default as EmailInput } from './inputEmail/Main.svelte';
export { default as PhoneInput } from './inputPhone/Main.svelte';
export { default as PasswordInput } from './inputPassword/Main.svelte';
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

export { default as Select } from './select/Main.svelte';
export type { SelectProps, SelectConfigs, SelectOption, SelectOptionGroup } from './select/_interface';

export { RadioGroup, RadioItem } from './radiogroup/index';
export type { RadioGroupProps, RadioGroupConfigs, RadioItemProps, RadioOrientation } from './radiogroup/index';
