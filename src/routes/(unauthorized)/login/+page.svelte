<script lang="ts">
	import { Button } from '$components/element';
	import { Description, FieldMessages, Form, Input, Label, TextField } from '$components/form';
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
				color="success"
				type="submit"
				onClick={() => {
					alert('submit');
				}}>Login</Button
			>
			<Button color="error" type="reset" variant="ghost">Reset</Button>
		</div>
	</Form>
</div>

<style lang="scss">
	.login-root {
		@apply flex flex-col;
	}
</style>
