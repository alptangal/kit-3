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
export { default as Tag } from './tag/Main.svelte';
export type { TagProps, TagConfigs, TagVariant } from './tag/_interface';

export { default as MessageComponent } from './messageComponent/MessageComponent.svelte';
export { default as Icon } from './icon/Main.svelte';
export { default as Image } from './image/Main.svelte';
export type { ImageProps, ImageConfigs, ImageRatio, ImageObjectFit, ImageLoadState } from './image/_interface';

export { default as Separator } from './separator/Main.svelte';
export type { SeparatorProps, SeparatorConfigs, SeparatorOrientation } from './separator/_interface';

export { DropdownMenu, getDropdownMenuContext } from './dropdown-menu/index.ts';
export type {
	DropdownMenuAlign,
	DropdownMenuConfigs,
	DropdownMenuRootProps,
	DropdownMenuTriggerProps,
	DropdownMenuContentProps,
	DropdownMenuItemProps,
	DropdownMenuLabelProps,
	DropdownMenuSeparatorProps
} from './dropdown-menu/_interface';

export { Loading };
export { default as Skeleton } from './skeleton/Main.svelte';

export { default as Spinner } from './spinner/Main.svelte';
export type { SpinnerProps, SpinnerConfigs, SpinnerPattern, SpinnerSize } from './spinner/_interface';
export { default as Progress } from './progress/Main.svelte';
export type { ProgressProps, ProgressConfigs, ProgressSize } from './progress/_interface';

export { Badge } from './badge';
export type { BadgeConfigs, BadgeProps, BadgeVariant } from './badge';
export { Accordion, getAccordionContext, getAccordionItemContext } from './accordion/index.ts';
export type {
	AccordionConfigs,
	AccordionContentProps,
	AccordionHeaderProps,
	AccordionItemProps,
	AccordionRootProps,
	AccordionTriggerProps,
	AccordionType
} from './accordion/_interface';
export { Tabs, getTabsContext } from './tabs/index.ts';
export type {
	TabsActivation,
	TabsConfigs,
	TabsContentProps,
	TabsIndicatorProps,
	TabsListProps,
	TabsOrientation,
	TabsRootProps,
	TabsTriggerProps,
	TabsType
} from './tabs/_interface';
export { Kbd } from './kbd';
export type { KbdConfigs, KbdComboConfigs, KbdComboProps, KbdProps, KbdVariant } from './kbd';
export { HoverCard, getHoverCardContext } from './hover-card/index.ts';
export type {
	HoverCardConfigs,
	HoverCardRootProps,
	HoverCardTriggerProps,
	HoverCardContentProps
} from './hover-card/_interface';
export { Popover, getPopoverContext } from './popover/index.ts';
export type {
	PopoverPosition,
	PopoverTriggerMode,
	PopoverConfigs,
	PopoverRootProps,
	PopoverTriggerProps,
	PopoverContentProps
} from './popover/_interface';

export { ContextMenu, getContextMenuContext } from './context-menu/index.ts';
export type {
	ContextMenuSide,
	ContextMenuConfigs,
	ContextMenuRootProps,
	ContextMenuContentProps,
	ContextMenuItemProps,
	ContextMenuLabelProps,
	ContextMenuSeparatorProps
} from './context-menu/_interface';

export { AlertDialog, getAlertDialogContext } from './alert-dialog/index.ts';
export type {
	AlertDialogActionColor,
	AlertDialogActionProps,
	AlertDialogCancelProps,
	AlertDialogConfigs,
	AlertDialogContentProps,
	AlertDialogDescriptionProps,
	AlertDialogFooterProps,
	AlertDialogHeaderProps,
	AlertDialogRootProps,
	AlertDialogTitleProps,
	AlertDialogTriggerProps
} from './alert-dialog/_interface';
export { Card } from './card/index.ts';
export type {
	CardElevation,
	CardRootProps,
	CardRootConfigs,
	CardHeaderProps,
	CardTitleProps,
	CardDescriptionProps,
	CardContentProps,
	CardFooterProps,
	CardActionProps
} from './card/_interface';
export { Avatar, getAvatarContext, setAvatarContext } from './avatar/index.ts';
export type {
	AvatarLoadState,
	AvatarShape,
	AvatarProps,
	AvatarConfigs,
	AvatarImageProps,
	AvatarFallbackProps
} from './avatar/_interface';
export { Pagination } from './pagination/index.ts';
export type { PaginationProps, PaginationConfigs, PaginationEntry } from './pagination/_interface';
