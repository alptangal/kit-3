// src/lib/components/element/date-picker/index.ts
// DatePicker composite (PURE JS — KHÔNG date library): Root (wrapper
// position:relative + state value/open/displayMonth/focusDate + Symbol
// context + outside-click/Escape) + Trigger (button, aria-haspopup="dialog"
// + aria-expanded + aria-controls) + Content (panel lịch role=grid 7×6, tuần
// bắt đầu thứ Hai, absolute dưới trigger — KHÔNG portal).
// Mirror barrel popover/index.ts + dropdown-menu/index.ts.
import DatePickerRoot from './Root.svelte';
import DatePickerTrigger from './Trigger.svelte';
import DatePickerContent from './Content.svelte';

export const DatePicker = Object.assign(DatePickerRoot, {
	Trigger: DatePickerTrigger,
	Content: DatePickerContent
});

export { setDatePickerContext, getDatePickerContext } from './_context';

export type {
	DatePickerConfigs,
	DatePickerRootProps,
	DatePickerTriggerProps,
	DatePickerContentProps
} from './_interface';
