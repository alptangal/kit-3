// src/lib/components/element/context-menu/index.ts
// ContextMenu — menu context (shadcn context-menu). Root giữ state open/pos/target
// (Symbol context + outside-click/Escape/Tab); right-click trên target → mở menu
// fixed tại điểm chuột (clamp viewport). Object.assign để user dùng
// `<ContextMenu.Content />` (mirror DropdownMenu). Import root thành
// `ContextMenuRoot` để tránh conflict với `export const ContextMenu`.
import ContextMenuRoot from './Root.svelte';
import ContextMenuContent from './Content.svelte';
import ContextMenuItem from './Item.svelte';
import ContextMenuLabel from './Label.svelte';
import ContextMenuSeparator from './Separator.svelte';

export const ContextMenu = Object.assign(ContextMenuRoot, {
	Content: ContextMenuContent,
	Item: ContextMenuItem,
	Label: ContextMenuLabel,
	Separator: ContextMenuSeparator
});

export { getContextMenuContext, setContextMenuContext } from './_context';
export type {
	ContextMenuSide,
	ContextMenuConfigs,
	ContextMenuRootProps,
	ContextMenuContentProps,
	ContextMenuItemProps,
	ContextMenuLabelProps,
	ContextMenuSeparatorProps
} from './_interface';
