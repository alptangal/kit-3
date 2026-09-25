<script lang="ts">
	// src\lib\components\form\inputPassword\Main.svelte
	import Input from '../input/Main.svelte';
	import type { PasswordInputProps } from './_interface';

	let { value = $bindable(), ...props }: PasswordInputProps = $props();
</script>

<!-- showPassword action button bật mặc định; caller truyền actionButtons riêng thì thắng (?? chỉ fill khi undefined) -->
<Input
	{...props}
	type="password"
	actionButtons={props.actionButtons ?? { showPassword: { display: true } }}
	bind:value
/>
