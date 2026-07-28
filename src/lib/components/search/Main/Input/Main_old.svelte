<script lang="ts">
	import { iconify } from '$assets/icons/iconify';
	import Input from '$components/form/input/Input.svelte';
	import type { TranslateContent } from '$interfaces/basic';
	import { styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { getSearchMainContext } from '../_context';
	import type { SearchMainInput, SearchMainInputConfigs } from '../_interface';

	let { ...props }: SearchMainInput = $props();
	const searchMainCtx = getSearchMainContext();
	let configs: SearchMainInputConfigs = $state({
		component: undefined,
		ref: undefined,
		placeholder: {
			en: 'Enter to search',
			vi: 'Nhập từ khóa tìm kiếm'
		} as TranslateContent,
		get size() {
			return props.size ?? searchMainCtx?.size ?? client.browser?.size ?? 'md';
		},
		get style() {
			const defaultStyles: string[] = ['search-main-input'];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		}
	});

	$effect(() => {
		if (configs.ref && searchMainCtx && searchMainCtx.insertNode) {
			searchMainCtx.insertNode({ ref: configs.ref });
		}
	});
</script>

<Input
	onChange={(value) => {
		if (searchMainCtx?.onChange) {
			searchMainCtx.onChange(value);
		}
	}}
	onKeydown={(value) => {
		if (searchMainCtx?.onKeydown) searchMainCtx?.onKeydown(value);
	}}
	onKeyup={(value) => {
		if (searchMainCtx?.onKeyup) searchMainCtx?.onKeyup(value);
	}}
	onEnter={(value) => {
		if (searchMainCtx?.onEnter) searchMainCtx?.onEnter(value);
	}}
	onFocus={(value) => {
		if (searchMainCtx?.onFocus) searchMainCtx?.onFocus(value);
	}}
	onBlur={(value) => {
		if (searchMainCtx?.onBlur) searchMainCtx?.onBlur(value);
	}}
	onClear={(value) => {
		if (searchMainCtx?.onClear) searchMainCtx?.onClear(value);
	}}
	bind:this={configs.component}
	onLoaded={(data) => {
		if (!data.ref) return;
		configs.ref = data.ref;
		if (searchMainCtx && searchMainCtx.insertNode) {
			searchMainCtx.insertNode(data);
		}
	}}
	type="text"
	clearButtonEnabled
	placeholder={configs.placeholder?.[client.browser?.language ?? 'en']}
	size={configs.size}
	copyButtonEnabled
	class={configs.style}
	leadingIcon={iconify['search-rounded']}
/>
