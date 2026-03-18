import type { Browser } from '$interfaces/basic';

export const profile = $state({
	browser: {} as Browser,
	delay: 300,
	transition: {
		classString: 'transition-all ease-in-out',
		get duration() {
			return profile.delay ?? 300;
		}
	}
});
