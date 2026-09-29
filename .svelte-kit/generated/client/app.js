// in dev, this makes Vite inject its client as this module's first dependency,
// so that global constant replacements are installed before any other module
// (including user hooks) evaluates. In build it's inert.
import.meta.hot;

import * as client_hooks from '../../../src/hooks.client.ts';


export { matchers } from './matchers.js';

export const nodes = [
	() => import('./nodes/0'),
	() => import('./nodes/1'),
	() => import('./nodes/2'),
	() => import('./nodes/3'),
	() => import('./nodes/4'),
	() => import('./nodes/5'),
	() => import('./nodes/6'),
	() => import('./nodes/7'),
	() => import('./nodes/8'),
	() => import('./nodes/9'),
	() => import('./nodes/10'),
	() => import('./nodes/11'),
	() => import('./nodes/12'),
	() => import('./nodes/13'),
	() => import('./nodes/14'),
	() => import('./nodes/15'),
	() => import('./nodes/16'),
	() => import('./nodes/17'),
	() => import('./nodes/18'),
	() => import('./nodes/19'),
	() => import('./nodes/20'),
	() => import('./nodes/21'),
	() => import('./nodes/22')
];

export const server_loads = [0,3,4];

export const dictionary = {
		"/(unauthorized)": [12,[5]],
		"/(unauthorized)/about": [13,[5]],
		"/(authorized)/admin": [6,[3,4]],
		"/(authorized)/admin/brands": [7,[3,4]],
		"/(authorized)/admin/categories": [8,[3,4]],
		"/(authorized)/admin/products": [9,[3,4]],
		"/(authorized)/admin/variants": [10,[3,4]],
		"/(unauthorized)/forgot-password": [14,[5]],
		"/(unauthorized)/login": [15,[5]],
		"/(authorized)/profile": [11,[3]],
		"/(unauthorized)/register": [16,[5]],
		"/(unauthorized)/reset-password": [17,[5]],
		"/test": [19],
		"/test/test1": [20],
		"/ui": [21],
		"/ui/radiogroup": [22],
		"/(unauthorized)/verify-email": [18,[5]]
	};

export const hooks = {
	handleError: client_hooks.handleError || (({ error }) => { console.error(error) }),
	init: client_hooks.init,
	reroute: (() => {}),
	transport: {}
};

export const decoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.decode]));
export const encoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.encode]));

export const hash = false;

export const decode = (type, value) => decoders[type](value);

export { default as root } from '../root.js';

export const get_error_template = () => import('../shared/error-template.js').then(m => m.default);