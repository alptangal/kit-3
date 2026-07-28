export { default as Input } from './input/Main.svelte';
export { default as Form } from './form/Form.svelte';
export { default as Label } from './label/Label.svelte';
export { default as TextField } from './textField/TextField.svelte';
export { default as Description } from './description/Description.svelte';

import Root from './checkbox/Root/Main.svelte';
import Content from './checkbox/Content/Main.svelte';
import Control from './checkbox/Control/Main.svelte';
import Indicator from './checkbox/Indicator/Main.svelte';
export const Checkbox = Object.assign(Root, {
	Content,
	Indicator,
	Control
});
