// src/lib/components/element/dropdown-menu/index.ts
// DropdownMenu — menu dropdown (shadcn dropdown-menu). Root giữ state `open`
// (bindable) + Symbol context + outside-click/Escape/Tab. Object.assign để user
// dùng `<DropdownMenu.Trigger />` (mirror Tooltip/Sidebar). Import root thành
// `DropdownMenuRoot` để tránh conflict với `export const DropdownMenu`.
import DropdownMenuRoot from './Root.svelte';
import DropdownMenuTrigger from './Trigger.svelte';
import DropdownMenuContent from './Content.svelte';
import DropdownMenuItem from './Item.svelte';
import DropdownMenuLabel from './Label.svelte';
import DropdownMenuSeparator from './Separator.svelte';

export const DropdownMenu = Object.assign(DropdownMenuRoot, {
	Trigger: DropdownMenuTrigger,
	Content: DropdownMenuContent,
	Item: DropdownMenuItem,
	Label: DropdownMenuLabel,
	Separator: DropdownMenuSeparator
});

export { getDropdownMenuContext, setDropdownMenuContext } from './_context';
export type {
	DropdownMenuAlign,
	DropdownMenuConfigs,
	DropdownMenuRootProps,
	DropdownMenuTriggerProps,
	DropdownMenuContentProps,
	DropdownMenuItemProps,
	DropdownMenuLabelProps,
	DropdownMenuSeparatorProps
} from './_interface';
