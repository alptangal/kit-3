// src/lib/components/element/avatar/index.ts
// Avatar composite — Object.assign như Tooltip/DropdownMenu: `<Avatar.Image />`, `<Avatar.Fallback />`.
import AvatarRoot from './Root.svelte';
import AvatarImage from './Image.svelte';
import AvatarFallback from './Fallback.svelte';

export const Avatar = Object.assign(AvatarRoot, {
	Image: AvatarImage,
	Fallback: AvatarFallback
});

export { getAvatarContext, setAvatarContext } from './_context';
export type {
	AvatarLoadState,
	AvatarShape,
	AvatarProps,
	AvatarConfigs,
	AvatarImageProps,
	AvatarFallbackProps
} from './_interface';
