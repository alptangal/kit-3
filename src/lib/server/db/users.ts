import type { TranslateContent } from '$interfaces/basic';
import type { User } from '$interfaces/schemaTypes';
import { cbData } from '$modules/couchbase/clients';
import { client } from '$store/basic.svelte';

const DBNAME = 'users';
const cbUsers = cbData(DBNAME);
const contents: Record<'get', TranslateContent> = {
	get: {
		vi: 'Thiếu trường dữ liệu cần tìm kiếm',
		en: 'Field search is missing.'
	}
};
export class Users {
	user: User;
	constructor(metaUser: User) {
		this.user = metaUser;
	}
	static async getBy(input: Partial<Pick<User, 'emailBlindIndex' | 'usernameBlindIndex'>>) {
		const { usernameBlindIndex, emailBlindIndex } = input;
		if (!usernameBlindIndex && !emailBlindIndex)
			throw new Error(contents.get[client.browser?.language ?? 'en']);
		try {
			if (usernameBlindIndex) {
				const response = await cbUsers.query.document.search({
					collectionName: 'users',
					conditions: [
						{
							fieldName: 'usernameBlindIndex',
							keyword: usernameBlindIndex
						}
					]
				});
				if (response.ok) {
					return response.data;
				}
				throw new Error(response.message);
			} else if (emailBlindIndex) {
				const response = await cbUsers.query.document.search({
					collectionName: 'users',
					conditions: [
						{
							fieldName: 'emailBlindIndex',
							keyword: emailBlindIndex
						}
					]
				});
				if (response.ok) {
					return response.data;
				}
				throw new Error(response.message);
			}
		} catch (e) {
			throw new Error(JSON.stringify(e));
		}
	}
	async create() {
		cbUsers.document.create({
			content: {
				firstname: ''
			}
		});
	}
	async update() {}
	async delete() {}
	async save() {}
}
