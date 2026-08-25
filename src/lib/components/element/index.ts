import Root from './tooltip/Main.svelte';
import Content from './tooltip/Content/Main.svelte';
import Arrow from './tooltip/Arrow/Main.svelte';
import ToastRoot from './toast/Main.svelte';
import ToastAction from './toast/Action/Main.svelte';
import ToastContent from './toast/Content/Main.svelte';
import ToastIndicator from './toast/Indicator/Main.svelte';
import ToastContentTitle from './toast/Content/Title/Main.svelte';
import ToastContentDescription from './toast/Content/Description/Main.svelte';
import ToastClose from './toast/Close/Main.svelte';

import * as Loading from './loading/index.ts';

export const Tooltip = Object.assign(Root, {
	Content,
	Arrow
});
const ToastContentReAssign = Object.assign(ToastContent, {
	Title: ToastContentTitle,
	Description: ToastContentDescription
});
export const Toast = Object.assign(ToastRoot, {
	Action: ToastAction,
	Content: ToastContentReAssign,
	Indicator: ToastIndicator,
	Close: ToastClose
});
export { default as ToastWrapper } from './toast/Wrapper/Main.svelte';

export { default as Button } from './button/Main.svelte';

export { default as MessageComponent } from './messageComponent/MessageComponent.svelte';
export { default as Icon } from './icon/Main.svelte';

export { Loading };
export { default as Skeleton } from './skeleton/Main.svelte';
