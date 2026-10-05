// src/lib/components/element/accordion/index.ts
// Accordion — composite (shadcn accordion). Root (value bindable loose typing +
// Symbol context isOpen/toggle) + Item (data-value + item-context) + Header +
// Trigger (aria-expanded/controls, chevron rotate, icon) + Content (role=region,
// fly/fade). Object.assign mirror DropdownMenu/Tabs.
import AccordionRoot from './Root.svelte';
import AccordionItem from './Item.svelte';
import AccordionHeader from './Header.svelte';
import AccordionTrigger from './Trigger.svelte';
import AccordionContent from './Content.svelte';

export const Accordion = Object.assign(AccordionRoot, {
	Item: AccordionItem,
	Header: AccordionHeader,
	Trigger: AccordionTrigger,
	Content: AccordionContent
});

export { getAccordionContext, setAccordionContext, getAccordionItemContext, setAccordionItemContext } from './_context';
export type {
	AccordionConfigs,
	AccordionContentProps,
	AccordionHeaderProps,
	AccordionItemProps,
	AccordionRootProps,
	AccordionTriggerProps,
	AccordionType
} from './_interface';
