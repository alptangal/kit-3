import { json, type RequestHandler } from '@sveltejs/kit';
import { cb_document_id_rsa_key_vault } from '$env/static/private';

import { cbVault } from '$modules/couchbase/clients';

const vaultsCollection = cbVault('vaults');
export const GET: RequestHandler = async () => {
	const response = await vaultsCollection.document.get({
		documentKey: cb_document_id_rsa_key_vault
	});
	if (response.status >= 400)
		return json({ message: response.message }, { status: response.status });
	if (response.ok && response.data) {
		const publicKeyB64 = response.data['publicKeyB64'];
		return json({
			data: {
				publicKeyB64
			}
		});
	}
	return json({
		message: 'System crash'
	});
};
export const POST = ({ params }) => {
	return new Response(JSON.stringify(''));
};
