import type { Browser } from '$interfaces/basic';
import type { FlyParams } from 'svelte/transition';

export const profile = $state({
	browser: {} as Browser,
	delay: 300,
	transition: {
		classString: 'transition-all ease-in-out',
		templates: {
			flyX: {
				x: 30,
				get duration() {
					return profile.delay;
				}
			} as FlyParams,
			flyXReverse: {
				x: -30,
				get duration() {
					return profile.delay;
				}
			} as FlyParams,
			flyY: {
				y: 30,
				get duration() {
					return profile.delay;
				}
			} as FlyParams,
			flyYReverse: {
				y: -30,
				get duration() {
					return profile.delay;
				}
			} as FlyParams
		},
		get duration() {
			return profile.delay ?? 300;
		}
	}
});
