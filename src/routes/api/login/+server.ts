import { encryption } from '$modules/encryption';
import { systemVault } from '$store/initSystemVault';
import { json, type RequestHandler } from '@sveltejs/kit';
import type { LoginRequestBody } from '../../(unauthorized)/login/_interface';
import type { ServerResponse } from '$interfaces/basic';
import { cbData } from '$modules/couchbase/clients';
import { Users } from '$lib/server/db/users';

const collectionName = 'users';
const cbUsers = cbData(collectionName);
export const POST: RequestHandler = async ({ request }) => {
	const normalizedEmail = 'phuongdomega@atomicmail.io'.trim().toLowerCase();
	const emailBlindIndex = await encryption.hmacBlindIndex(systemVault.indexKey, normalizedEmail);
	const users = Users;
	const user = await users.getBy({ emailBlindIndex });
	console.log(user);
	try {
		if (!systemVault?.privateKey || !systemVault?.publicKey || !systemVault?.indexKey) {
			throw new Error('System crash');
		}
		const jsRaw = await request.json();
		const decryptedText = await encryption.decryptWithPrivateKeyHybrid(
			systemVault.privateKey,
			jsRaw
		);
		if (!decryptedText) {
			return json({ message: 'Decryption returned empty' }, { status: 400 });
		}

		const dataDecrypted: LoginRequestBody = JSON.parse(decryptedText);
		const { publicKeyB64 } = dataDecrypted;
		if (!publicKeyB64) {
			return json({ message: 'Missing session public key' }, { status: 400 });
		}
		const sessionPublicKey = await encryption.importPublicKey(publicKeyB64);

		const respond = async (payload: ServerResponse, status = 200) => {
			const enc = await encryption.encryptWithPublicKeyHybrid(
				sessionPublicKey,
				JSON.stringify(payload)
			);
			return json(enc, { status });
		};
		const { password, username, remember } = dataDecrypted;

		if (!username || !password) {
			return respond(
				{
					message: { en: 'Missing field required', vi: 'Không để trống giá trị bắt buộc' },
					ok: false
				},
				400
			);
		}
		const response = await cbUsers.document.get({ documentKey: `${collectionName}-${username}` });
		if (response.ok) {
			if (
				!response.data?.['vaultSaltB64'] ||
				!response.data?.['vaultDekIvB64'] ||
				!response.data?.['vaultWrappedDekB64']
			)
				return respond(
					{ message: { en: 'Database is broken', vi: 'Cơ sở dữ liệu bị lỗi' }, ok: false },
					500
				);
			await encryption.unlockVault(password, {
				saltB64: response.data['vaultSaltB64'],
				dekIvB64: response.data['vaultDekIvB64'],
				wrappedDekB64: response.data['vaultWrappedDekB64']
			});
			await cbUsers.document.update({
				documentKey: `${collectionName}-${username}`,
				content: { remember }
			});
			return respond(
				{ message: { en: 'Login success', vi: 'Đăng nhập thành công' }, ok: true },
				200
			);
		} else {
			return respond(
				{
					message: {
						en: 'Check your username/password again',
						vi: 'Vui lòng kiểm tra lại tên đăng nhập/ mật khẩu cung cấp'
					},
					ok: false
				},
				409
			);
		}
	} catch (e) {
		return json({ message: e instanceof Error ? e.message : String(e) }, { status: 400 });
	}
};
