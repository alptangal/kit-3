// src/lib/components/element/tabs/index.ts
// Tabs — composite (shadcn tabs). Root (value bindable + Symbol context + select/
// register/unregister triggerRefs) + List (role=tablist, roving focus) + Trigger
// (role=tab, activation automatic/manual, icon) + Content (role=tabpanel, hidden)
// + Indicator (vạch trượt, type='underline'). Object.assign mirror DropdownMenu.
import TabsRoot from './Root.svelte';
import TabsList from './List.svelte';
import TabsTrigger from './Trigger.svelte';
import TabsContent from './Content.svelte';
import TabsIndicator from './Indicator.svelte';

export const Tabs = Object.assign(TabsRoot, {
	List: TabsList,
	Trigger: TabsTrigger,
	Content: TabsContent,
	Indicator: TabsIndicator
});

export { getTabsContext, setTabsContext } from './_context';
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
} from './_interface';
