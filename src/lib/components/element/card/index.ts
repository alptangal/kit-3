// src/lib/components/element/card/index.ts
// Card composite — Object.assign như Tooltip/DropdownMenu: `<Card.Header />`, `<Card.Title />`...
// Import root thành `CardRoot` để tránh conflict với `export const Card`.
import CardRoot from './Root.svelte';
import CardHeader from './Header.svelte';
import CardTitle from './Title.svelte';
import CardDescription from './Description.svelte';
import CardContent from './Content.svelte';
import CardFooter from './Footer.svelte';
import CardAction from './Action.svelte';

export const Card = Object.assign(CardRoot, {
	Header: CardHeader,
	Title: CardTitle,
	Description: CardDescription,
	Content: CardContent,
	Footer: CardFooter,
	Action: CardAction
});

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
} from './_interface';
