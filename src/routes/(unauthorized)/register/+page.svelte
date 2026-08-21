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
	import { fly } from 'svelte/transition';
	import { encryption } from '$modules/encryption';
	import { startRegistration } from '@simplewebauthn/browser';
	import { goto } from '$app/navigation';

	let userMeta: { [k: string]: { value?: string; validation?: InputProps['validation'] } } = $state(
		{
			username: { value: undefined },
			firstname: { value: undefined },
			midname: { value: undefined },
			lastname: { value: undefined },
			email: { value: undefined },
			password: {
				value: undefined,
				validation: {
					blur: [
						{
							isValid(input) {
								const strongPasswordRegex =
									/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d\s]).{8,}$/;
								if (
									input &&
									strongPasswordRegex.test(input) &&
									(!userMeta.confirmPassword.value ||
										(userMeta.confirmPassword.value && input == userMeta.confirmPassword.value))
								)
									return true;
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

	let term = $state({ value: undefined as undefined | boolean });

	// ============ Trạng thái riêng cho luồng register (tách khỏi Form) ============
	let registerState: {
		loading: boolean;
		error?: string;
	} = $state({ loading: false, error: undefined });

	async function detectAuthMethod(): Promise<'webauthn' | 'password'> {
		if (typeof window === 'undefined' || typeof window.PublicKeyCredential === 'undefined') {
			return 'password';
		}
		try {
			const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
			return available ? 'webauthn' : 'password';
		} catch {
			return 'password';
		}
	}

	function validateBeforeSubmit(): string | undefined {
		if (!userMeta.email.value) return 'Email is required';
		if (!userMeta.firstname.value || !userMeta.lastname.value) return 'Name is required';
		if (!userMeta.password.value) return 'Password is required';
		if (userMeta.password.value !== userMeta.confirmPassword.value) {
			return 'Confirm password not same the password';
		}
		if (!term.value) return 'You must agree the term';
		return undefined;
	}

	async function handleRegister() {
		if (registerState.loading) return; // chặn double-submit
		const validationError = validateBeforeSubmit();
		if (validationError) {
			registerState.error = validationError;
			return;
		}

		registerState.error = undefined;
		registerState.loading = true;

		try {
			const authMethod = await detectAuthMethod();
			const name = [userMeta.firstname.value, userMeta.midname.value, userMeta.lastname.value]
				.filter(Boolean)
				.join(' ');
			// ---------- BƯỚC 1: register-init ----------
			const initRes = await encryption.fetchSecure('/api/auth/register', {
				body: {
					action: 'register-init',
					email: userMeta.email.value,
					firstname: userMeta.firstname.value,
					midname: userMeta.midname.value,
					lastname: userMeta.lastname.value,
					password: userMeta.password.value,
					authMethod
				}
			});

			if (!initRes.data) {
				registerState.error = initRes.message ?? 'Registration broken response';
				return;
			}
			// ---------- Nhánh password: xong luôn ----------
			if (initRes.data.authMethod === 'password') {
				await goto('/login?registered=1');
				return;
			}

			// ---------- Nhánh webauthn: cần round-trip ----------
			let attestationResponse;
			console.log(
				'[DEBUG] webauthnOptions:',
				JSON.stringify(initRes.data.webauthnOptions, null, 2)
			);
			try {
				attestationResponse = await startRegistration({
					optionsJSON: initRes.data.webauthnOptions
				});
			} catch (err) {
				// User huỷ thao tác vân tay/Face ID, hoặc thiết bị từ chối
				registerState.error =
					err instanceof Error ? `WebAuthn cancelled: ${err.message}` : 'WebAuthn cancelled';
				return;
			}
			const verifyRes = await encryption.fetchSecure('/api/auth/register', {
				body: {
					action: 'register-verify',
					registrationId: initRes.data.registrationId,
					webauthnResponse: attestationResponse
				}
			});

			if (!verifyRes.ok) {
				registerState.error = verifyRes.message ?? 'WebAuthn verification failed';
				return;
			}

			await goto('/login?registered=1');
		} catch (err) {
			registerState.error = err instanceof Error ? err.message : 'Unexpected error';
		} finally {
			registerState.loading = false;
		}
	}

	let modals: {
		term: {
			display?: boolean;
			actionButtons: {
				confirm: { event: BasicProps['events'] };
				decline: { event: BasicProps['events'] };
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

<div class="register-root">
	<Form method="post" encryptDisabled>
		<div class="grid grid-cols-3 gap-1">
			<TextField name="firstname">
				<Label class="capitalize"
					>{pageContents.textFields.firstname[client.browser?.language ?? 'en']}</Label
				>
				<Input bind:value={userMeta.firstname.value} />
				<FieldMessages />
			</TextField>
			<TextField name="midname">
				<Label class="capitalize"
					>{pageContents.textFields.midname[client.browser?.language ?? 'en']}</Label
				>
				<Input bind:value={userMeta.midname.value} />
				<FieldMessages />
			</TextField>
			<TextField name="lastname">
				<Label class="capitalize"
					>{pageContents.textFields.lastname[client.browser?.language ?? 'en']}</Label
				>
				<Input bind:value={userMeta.lastname.value} />
				<FieldMessages />
			</TextField>
		</div>

		<TextField name="username" required>
			<Label class="capitalize"
				>{pageContents.textFields.username[client.browser?.language ?? 'en']}</Label
			>
			<Input bind:value={userMeta.username.value} />
			<FieldMessages />
		</TextField>
		<TextField name="email" required>
			<Label class="capitalize"
				>{pageContents.textFields.email[client.browser?.language ?? 'en']}</Label
			>
			<Input type="email" bind:value={userMeta.email.value} />
			<FieldMessages />
		</TextField>
		<TextField name="password" required>
			<Label class="capitalize"
				>{pageContents.textFields.password[client.browser?.language ?? 'en']}</Label
			>
			<Input
				bind:value={userMeta.password.value}
				type="password"
				validation={userMeta.password.validation}
			/>
			<Description>Must be at least 8 characters with 1 uppercase and 1 number</Description>
			<FieldMessages />
		</TextField>
		<TextField name="confirmPassword" required>
			<Label class="capitalize"
				>{pageContents.textFields.confirmPassword[client.browser?.language ?? 'en']}</Label
			>
			<Input
				bind:value={userMeta.confirmPassword.value}
				type="password"
				validation={userMeta.confirmPassword.validation}
			/>
			<Description>Confirm password must same the password</Description>
			<FieldMessages />
		</TextField>
		<Checkbox
			name="basic-terms"
			bind:checked={term.value}
			required
			class="flex flex-wrap flex-row! justify-start!"
		>
			<Checkbox.Indicator /><Label class="flex items-center capitalize"
				>Agree <Button
					color={typeof term.value == 'boolean' ? (term.value ? 'success' : 'error') : 'default'}
					class="ml-1 px-0! underline"
					variant="link"
					events={[
						{
							events: {
								mousedown: {
									handler(e) {
										modals.term.display = true;
									},
									options: { stopPropagation: true }
								}
							}
						}
					]}>the term</Button
				></Label
			>
			<FieldMessages class="w-full" />
		</Checkbox>

		{#if registerState.error}
			<p class="register-error" role="alert">{registerState.error}</p>
		{/if}

		<div class="flex gap-1">
			<Button
				class="capitalize"
				color="success"
				type="button"
				disabled={registerState.loading}
				onClick={handleRegister}
			>
				{registerState.loading
					? '...'
					: pageContents.buttons.confirm[client.browser?.language ?? 'en']}
			</Button>
			<Button class="capitalize" color="error" type="reset" variant="ghost"
				>{pageContents.buttons.reset[client.browser?.language ?? 'en']}</Button
			>
		</div>
	</Form>
	<div class="flex items-center">
		<Label>Are you a member?</Label>
		<Button variant="link" color="success" class="underline" to="/login">login</Button>
	</div>
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
	.register-root {
		@apply flex flex-col;
	}
	.register-error {
		@apply text-sm;
		color: var(--color-error, #dc2626);
	}
</style>
