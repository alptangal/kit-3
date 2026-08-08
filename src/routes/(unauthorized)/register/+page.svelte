<script lang="ts">
	import { Button } from '$components/element';
	import {
		Checkbox,
		Description,
		FieldMessages,
		Form,
		Input,
		Label,
		TextField
	} from '$components/form';
	import type { InputProps } from '$components/form/input/_interface';
	import { client } from '$store/basic.svelte';
	import { onMount } from 'svelte';
	import { pageContents } from '.';
	import { SvelteMap } from 'svelte/reactivity';
	import { Modal } from '$components/modal';
	import { Container } from '$components/layout';
	import type { BasicProps } from '$components/interface';

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
	let term = $state({
		value: undefined as undefined | boolean
	});
	let modals: {
		term: {
			display?: boolean;
			actionButtons: {
				confirm: {
					event: BasicProps['events'];
				};
				decline: {
					event: BasicProps['events'];
				};
			};
		};
	} = $state({
		term: {
			actionButtons: {
				confirm: {
					event: [
						{
							events: {
								mousedown() {
									term.value = true;
									modals.term.display = false;
								}
							}
						}
					]
				},
				decline: {
					event: [
						{
							events: {
								mousedown() {
									term.value = false;
									modals.term.display = false;
								}
							}
						}
					]
				}
			}
		}
	});
	onMount(() => {
		if (!client.browser) client.browser = {};
		if (client.browser.layers) client.browser.layers = new SvelteMap();
	});
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
		<Checkbox bind:checked={term.value} required class="flex flex-wrap flex-row! justify-start!">
			<Checkbox.Indicator /><Label class="flex items-center"
				>Agree <Button
					class="ml-1 px-0!"
					variant="link"
					events={[
						{
							events: {
								mousedown: {
									handler(e) {
										modals.term.display = true;
									},
									options: {
										stopPropagation: true
									}
								}
							}
						}
					]}>the term</Button
				></Label
			>
			<FieldMessages class="w-full" />
		</Checkbox>
		<div class="flex gap-1">
			<Button
				class="capitalize"
				color="success"
				type="submit"
				onClick={async () => {
					const publicKeyOptions = {
						challenge: new Uint8Array(32), // random, từ server
						rp: { name: 'MyApp', id: 'myapp.com' },
						user: {
							id: new TextEncoder().encode('test'),
							name: 'user@example.com',
							displayName: 'Alpha'
						},
						pubKeyCredParams: [{ alg: -7, type: 'public-key' }], // ES256
						authenticatorSelection: {
							authenticatorAttachment: 'platform', // bắt buộc dùng FaceID/TouchID, không cho USB key
							userVerification: 'required'
						}
					};

					const credential = await navigator.credentials.create({
						publicKey: publicKeyOptions
					});
				}}>{pageContents.buttons.confirm[client.browser?.language ?? 'en']}</Button
			>
			<Button class="capitalize" color="error" type="reset" variant="ghost"
				>{pageContents.buttons.reset[client.browser?.language ?? 'en']}</Button
			>
		</div>
	</Form>
</div>
<Modal bind:display={modals.term.display} size="xs" isDimissable>
	<Modal.Container>
		<Modal.Container.Header>The term</Modal.Container.Header>
		<Modal.Container.Body>hello body</Modal.Container.Body>
		<Modal.Container.Footer class="flex gap-1">
			<Button color="success" events={modals.term.actionButtons.confirm.event}>Confirm</Button>
			<Button color="error" events={modals.term.actionButtons.decline.event} variant="ghost"
				>Decline</Button
			>
		</Modal.Container.Footer>
	</Modal.Container>
</Modal>

<style lang="scss">
	.login-root {
		@apply flex flex-col;
	}
</style>
