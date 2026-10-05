// src/lib/components/element/alert-dialog/index.ts
// AlertDialog — dialog DẠNG XÁC NHẬN (shadcn AlertDialog). Root giữ state
// `open` (bindable) + Symbol context + focus restore khi close. Object.assign
// để user dùng `<AlertDialog.Trigger />` (mirror DropdownMenu/Tooltip).
// Title/Description là sub-component bổ sung (usage spec) — nằm ngoài list
// tối thiểu trong contract, đã ghi rõ trong báo cáo.
import AlertDialogRoot from './Root.svelte';
import AlertDialogTrigger from './Trigger.svelte';
import AlertDialogContent from './Content.svelte';
import AlertDialogHeader from './Header.svelte';
import AlertDialogTitle from './Title.svelte';
import AlertDialogDescription from './Description.svelte';
import AlertDialogFooter from './Footer.svelte';
import AlertDialogAction from './Action.svelte';
import AlertDialogCancel from './Cancel.svelte';

export const AlertDialog = Object.assign(AlertDialogRoot, {
	Trigger: AlertDialogTrigger,
	Content: AlertDialogContent,
	Header: AlertDialogHeader,
	Title: AlertDialogTitle,
	Description: AlertDialogDescription,
	Footer: AlertDialogFooter,
	Action: AlertDialogAction,
	Cancel: AlertDialogCancel
});

export { getAlertDialogContext, setAlertDialogContext } from './_context';
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
} from './_interface';
