<script lang="ts">
	// src\lib\components\form\inputPhone\Main.svelte
	import Input from '../input/Main.svelte';
	import type { PhoneInputProps } from './_interface';

	let { value = $bindable(), ...props }: PhoneInputProps = $props();
</script>

<!-- type='phone' hardcode; phoneSuggest (country popup) bật mặc định -->
<Input {...props} type="phone" phoneSuggest={props.phoneSuggest ?? true} bind:value />
