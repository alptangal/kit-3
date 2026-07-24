import Root from './tooltip/Main.svelte';
import Content from './tooltip/Content/Main.svelte';
import Arrow from './tooltip/Arrow/Main.svelte';
import Trigger from './tooltip/Trigger/Main.svelte';
export const Tooltip = Object.assign(Root, {
	Content,
	Arrow,
	Trigger
});
import * as Loading from './loading/index.ts';

export { default as Button } from './button/Main.svelte';

export { default as MessageComponent } from './messageComponent/MessageComponent.svelte';
export { default as Icon } from './icon/Main.svelte';

export { Loading };
export { default as Skeleton } from './skeleton/Main.svelte';
