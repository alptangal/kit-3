<script lang="ts">
	import { profile } from '$store/basic.svelte';
	import { getFormContext } from '../form';
	import { getTextfieldCtx } from '../textField';
	import type { Label } from './_interface';

	let { children, ...props }: Label = $props();
	let configs = $state({
		ref: undefined as undefined | HTMLElement,
		get style() {
			const defaultStyles: string[] = [
				'label text-[hsl(var(--foreground-200))] items-center flex gap-1'
			];
			if (props.overwriteDefaultStyles) {
				return props.class;
			} else {
				if (typeof props.class == 'object') {
					return [...defaultStyles, ...props.class];
				} else if (typeof props.class == 'string') {
					return [...defaultStyles, props.class];
				}
			}
			return defaultStyles;
		}
	});
	const textFieldCtx = getTextfieldCtx();
	const formCtx = getFormContext();
</script>

{#if typeof children == 'function'}
	<svelte:element
		this={props.as ?? 'label'}
		class={configs.style}
		bind:this={configs.ref}
		data-is-invalid={textFieldCtx.isInvalid}
		data-focus={textFieldCtx.status?.focus}
		data-prefer-color={profile.preferColor}
		data-size={props.size ?? textFieldCtx.size ?? formCtx.size ?? 'md'}
	>
		{@render children()}
		{#if textFieldCtx.required}
			<span class="text-red-500 font-bold">*</span>
		{/if}
	</svelte:element>
{:else}
	<div class="text-red-500 font-bold text-2xl">
		Label Error:
		<p class="text-xl">Not contain content</p>
	</div>
{/if}

<style lang="scss">
	.label {
		@apply truncate transition-all ease-in-out duration-300;
		font-size: var(--font-size);
		&[data-prefer-color='dark'] {
			&[data-is-invalid='true'] {
				--color: hsl(var(--danger-100));
				&[data-focus='true'] {
					--color: hsl(var(--danger));
				}
			}
			&[data-is-invalid='false'] {
				--color: hsl(var(--success-100));
				&[data-focus='true'] {
					--color: hsl(var(--success));
				}
			}
		}
		&[data-prefer-color='light'] {
			&[data-is-invalid='true'] {
				--color: hsl(var(--danger-300));
				&[data-focus='true'] {
					--color: hsl(var(--danger));
				}
			}
			&[data-is-invalid='false'] {
				--color: hsl(var(--success-300));
				&[data-focus='true'] {
					--color: hsl(var(--success));
				}
			}
		}
		&[data-focus='true'] {
			--color: hsl(var(--foreground));
		}
		&[data-focus='false'] {
			--color: hsl(var(--foreground-500));
		}
		color: var(--color);
	}
</style>
