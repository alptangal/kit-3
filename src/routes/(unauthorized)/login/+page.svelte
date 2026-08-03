<script lang="ts">
	import { Button } from '$components/element';
	import { Description, FieldMessages, Form, Input, Label, TextField } from '$components/form';
	import { client } from '$store/basic.svelte';
	import { pageContents } from '.';
</script>

<div class="login-root">
	<Form>
		<TextField name="username">
			<Label>Username</Label>
			<Input />
			<FieldMessages />
		</TextField>
		<TextField name="password" required>
			<Label>Password</Label>
			<Input loading type="password" />
			<Description>Must be at least 8 characters with 1 uppercase and 1 number</Description>
			<FieldMessages />
		</TextField>
		<div class="flex gap-1">
			<Button
				class="capitalize"
				color="success"
				type="submit"
				onClick={() => {
					alert('submit');
				}}>{pageContents.login[client.browser?.language ?? 'en']}</Button
			>
			<Button class="capitalize" color="error" type="reset" variant="ghost"
				>{pageContents.reset[client.browser?.language ?? 'en']}</Button
			>
		</div>
	</Form>
</div>

<style lang="scss">
	.login-root {
		@apply flex flex-col;
	}
</style>
