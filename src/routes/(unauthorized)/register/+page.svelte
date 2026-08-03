<script lang="ts">
	import { Button } from '$components/element';
	import { Description, FieldMessages, Form, Input, Label, TextField } from '$components/form';
	import type { InputProps } from '$components/form/input/_interface';
	import { client } from '$store/basic.svelte';
	import { pageContents } from '.';

	let userMeta: { [k: string]: { value?: string; validation?: InputProps['validation'] } } = $state(
		{
			username: {
				value: undefined
			},
			firstname: {
				value: undefined
			},
			midname: {
				value: undefined
			},
			lastname: {
				value: undefined
			},
			email: {
				value: undefined
			},
			password: {
				value: undefined,
				validation: {
					blur: [
						{
							isValid(input) {
								const strongPasswordRegex =
									/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d\s]).{8,}$/;
								if (input && strongPasswordRegex.test(input)) return true;
								return false;
							},
							message: {
								invalid: {
									en: 'Must be at least 8 characters with uppercase, lowercase, number and special character',
									vi: 'phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt'
								}
							}
						}
					]
				}
			},
			confirmPassword: {
				value: undefined,
				validation: {
					blur: [
						{
							isValid(input) {
								if (input === userMeta.password.value) return true;
								return false;
							},
							message: {
								invalid: {
									en: 'Confirm password not same the password',
									vi: 'Mật khẩu xác nhận không đúng'
								}
							}
						}
					]
				}
			}
		}
	);
</script>

<div class="login-root">
	<Form>
		<div class="grid grid-cols-3 gap-1">
			<TextField name="firstname">
				<Label>{pageContents.textFields.firstname[client.browser?.language ?? 'en']}</Label>
				<Input bind:value={userMeta.firstname.value} />
				<FieldMessages />
			</TextField>
			<TextField name="midname">
				<Label>{pageContents.textFields.midname[client.browser?.language ?? 'en']}</Label>
				<Input bind:value={userMeta.midname.value} />
				<FieldMessages />
			</TextField>
			<TextField name="lastname">
				<Label>{pageContents.textFields.lastname[client.browser?.language ?? 'en']}</Label>
				<Input bind:value={userMeta.lastname.value} />
				<FieldMessages />
			</TextField>
		</div>

		<TextField name="username" required>
			<Label>{pageContents.textFields.username[client.browser?.language ?? 'en']}</Label>
			<Input bind:value={userMeta.username.value} />
			<FieldMessages />
		</TextField>
		<TextField name="email" required>
			<Label>{pageContents.textFields.email[client.browser?.language ?? 'en']}</Label>
			<Input type="email" bind:value={userMeta.email.value} />
			<FieldMessages />
		</TextField>
		<TextField name="password" required>
			<Label>{pageContents.textFields.password[client.browser?.language ?? 'en']}</Label>
			<Input
				bind:value={userMeta.password.value}
				type="password"
				validation={userMeta.password.validation}
			/>
			<Description>Must be at least 8 characters with 1 uppercase and 1 number</Description>
			<FieldMessages />
		</TextField>
		<TextField name="confirm password" required>
			<Label>{pageContents.textFields.confirmPassword[client.browser?.language ?? 'en']}</Label>
			<Input
				bind:value={userMeta.confirmPassword.value}
				type="password"
				validation={userMeta.confirmPassword.validation}
			/>
			<Description>Confirm password must same the password</Description>
			<FieldMessages />
		</TextField>
		<div class="flex gap-1">
			<Button
				class="capitalize"
				color="success"
				type="submit"
				onClick={() => {
					alert('submit');
				}}>{pageContents.buttons.confirm[client.browser?.language ?? 'en']}</Button
			>
			<Button class="capitalize" color="error" type="reset" variant="ghost"
				>{pageContents.buttons.reset[client.browser?.language ?? 'en']}</Button
			>
		</div>
	</Form>
</div>

<style lang="scss">
	.login-root {
		@apply flex flex-col;
	}
</style>
