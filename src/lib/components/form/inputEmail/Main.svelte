<script lang="ts">
	// src\lib\components\form\inputEmail\Main.svelte
	import Input from '../input/Main.svelte';
	import type { EmailInputProps } from './_interface';

	let { value = $bindable(), ...props }: EmailInputProps = $props();
</script>

<!-- type='email' hardcode; emailSuggest bật mặc định -->
<Input {...props} type="email" emailSuggest={props.emailSuggest ?? true} bind:value />
