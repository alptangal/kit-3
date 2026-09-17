import { mount, unmount } from 'svelte';
import { default as Container } from './Container/Main.svelte';
import type { ModalConfigs } from './_interface';

export function releaseModalContainter(data: ModalConfigs) {
	if (!data.ref) return undefined;
	mount(Container, { target: data.ref });
	return () => {
		unmount(Container);
	};
}
