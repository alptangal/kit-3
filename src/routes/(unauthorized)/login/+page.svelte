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
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { onMount } from 'svelte';
	import { pageContents } from '.';
	import type { LoginConfigs, LoginRequestBody } from './_interface';
	import { isEqual } from 'es-toolkit';

	let configs: LoginConfigs = $state({
		username: {},
		password: {},
		remember: {}
	});
	let loading = $state(false);
	let status = $state({
		get disabled() {
			const currentSubmit = {
				username: configs.username.value,
				password: configs.password.value,
				remember: configs.remember.checked
			};
			return (
				loading ||
				isEqual(currentSubmit, previousSubmited) ||
				!configs.username.value ||
				!configs.password.value
			);
		}
	});
	let previousSubmited: undefined | { username: string; password: string; remember?: boolean } =
		undefined;
	let encryptionKeys:
		| undefined
		| {
				public: CryptoKey;
				private: CryptoKey;
		  };

	async function handleRegistration() {
		if (!configs.username.value || !configs.password.value || !encryptionKeys) return;
		loading = true;
		const requestBody: LoginRequestBody = {
			username: configs.username.value,
			password: configs.password.value,
			remember: configs.remember.checked,
			publicKeyB64: await encryption.exportKeyToBase64(encryptionKeys.public, 'spki')
		};
		const response = await encryption.fetchSecure(
			'/api/login',
			{
				method: 'post',
				body: requestBody
			},
			{ privateKey: encryptionKeys.private, publicKey: encryptionKeys.public }
		);
		console.log(response);
		loading = false;
		previousSubmited = {
			...requestBody
		};
		client.browser?.toasts?.create({
			title:
				(response.ok
					? pageContents.responseOk[client.browser.language ?? 'en']
					: pageContents.responseFail[client.browser.language ?? 'en']) ?? '',
			description: response.message ? response.message[client.browser.language ?? 'en'] : undefined,
			color: response.ok ? 'success' : 'error'
		});
	}
	onMount(async () => {
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { private: privateKey, public: publicKey };
	});
</script>

<div class="login-root">
	<Form>
		<TextField name="username" required>
			<Label>Username</Label>
			<Input bind:value={configs.username.value} />
			<FieldMessages />
		</TextField>
		<TextField name="password" required>
			<Label>Password</Label>
			<Input loading type="password" bind:value={configs.password.value} />
			<Description>Must be at least 8 characters with 1 uppercase and 1 number</Description>
			<FieldMessages />
		</TextField>
		<Checkbox bind:checked={configs.remember.checked}>
			<Label>Remember me</Label>
		</Checkbox>
		<div class="flex gap-1">
			<Button
				class="capitalize"
				color="success"
				type="button"
				{loading}
				disabled={status.disabled}
				onClick={async () => {
					await handleRegistration();
					// const publicKeyOptions = {
					// 	challenge: new Uint8Array(32), // random, từ server
					// 	rp: { name: 'MyApp' },
					// 	user: {
					// 		id: new TextEncoder().encode('userId'),
					// 		name: 'user@example.com',
					// 		displayName: 'Alpha'
					// 	},
					// 	pubKeyCredParams: [{ alg: -7, type: 'public-key' }], // ES256
					// 	authenticatorSelection: {
					// 		authenticatorAttachment: 'platform', // bắt buộc dùng FaceID/TouchID, không cho USB key
					// 		userVerification: 'required'
					// 	}
					// };
					// try {
					// 	const credential = await navigator.credentials.create({
					// 		publicKey: publicKeyOptions
					// 	});
					// 	alert(JSON.stringify(credential));
					// } catch (e) {
					// 	alert(e);
					// }
				}}>{pageContents.login[client.browser?.language ?? 'en']}</Button
			>

			<Button class="capitalize" color="error" type="reset" variant="ghost"
				>{pageContents.reset[client.browser?.language ?? 'en']}</Button
			>
		</div>
	</Form>
	<div class="flex items-center">
		<Label>Do you want become member?</Label>

		<Button variant="link" color="success" class="underline" to="/register">Register</Button>
	</div>
</div>

<style lang="scss">
	.login-root {
		@apply flex flex-col;
	}
</style>
