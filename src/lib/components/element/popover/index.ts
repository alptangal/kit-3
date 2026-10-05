// src/lib/components/element/popover/index.ts
// Popover composite (shadcn popover): Root (wrapper position:relative + state
// open) + Trigger (span bọc control user) + Content (role=dialog, absolute dưới
// trigger, KHÔNG portal). Mirror barrel dropdown-menu/index.ts.
import PopoverRoot from './Root.svelte';
import PopoverTrigger from './Trigger.svelte';
import PopoverContent from './Content.svelte';

export const Popover = Object.assign(PopoverRoot, {
	Trigger: PopoverTrigger,
	Content: PopoverContent
});

export { setPopoverContext, getPopoverContext } from './_context';

export type {
	PopoverPosition,
	PopoverTriggerMode,
	PopoverConfigs,
	PopoverRootProps,
	PopoverTriggerProps,
	PopoverContentProps
} from './_interface';
