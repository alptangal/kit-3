import SearchMainControl from './Control/Main.svelte';
import SearchMainIcon from '$components/element/icon/Main.svelte';
import SearchMainRoot from './Root/Main.svelte';

export const SearchMain = Object.assign(SearchMainRoot, {
	Control: SearchMainControl,
	Icon: SearchMainIcon
});
