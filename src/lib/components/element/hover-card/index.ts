// src/lib/components/element/hover-card/index.ts
// HoverCard composite (shadcn hover-card): Root (wrapper position:relative +
// intent timers show/hide) + Trigger (span bọc control user) + Content
// (role=tooltip, absolute dưới trigger, KHÔNG portal, KHÔNG focus trap).
// Mirror barrel popover/index.ts.
import HoverCardRoot from './Root.svelte';
import HoverCardTrigger from './Trigger.svelte';
import HoverCardContent from './Content.svelte';

export const HoverCard = Object.assign(HoverCardRoot, {
	Trigger: HoverCardTrigger,
	Content: HoverCardContent
});

export { setHoverCardContext, getHoverCardContext } from './_context';

export type {
	HoverCardConfigs,
	HoverCardRootProps,
	HoverCardTriggerProps,
	HoverCardContentProps
} from './_interface';
