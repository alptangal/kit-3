// $lib/server/channels/threads.ts
// Threads API (Meta) — cần user access token qua Instagram platform.
// Doc: https://developers.facebook.com/docs/threads/
// Threads KHÔNG có order API — kênh này chỉ hỗ trợ reply/inbox → đơn
// từ Threads hiện là "đơn inbox" do nhân viên nhập tay khi chốt deal.
// HIỆN TẠI: mock mode (CHANNEL_THREADS_MOCK).
//
// Env khi có key:
//   CHANNEL_THREADS_ACCESS_TOKEN, CHANNEL_THREADS_MOCK=false

import type { ChannelAdapter, ChannelFieldDef, ChannelOrderDTO, ResolvedChannelAccount } from './types';
import { buildMockOrders, isChannelMockEnabled, notConfiguredError } from './mock-util';

const credentialFields: ChannelFieldDef[] = [
	{
		key: 'accessToken',
		label: { vi: 'Access Token', en: 'Access Token' },
		inputType: 'password',
		required: true
	},
	{
		key: 'userId',
		label: { vi: 'Threads User ID', en: 'Threads User ID' },
		inputType: 'text',
		required: true
	}
];

const configFields: ChannelFieldDef[] = [
	{
		key: 'orderNotePrefix',
		label: { vi: 'Tiền tố ghi chú đơn', en: 'Order note prefix' },
		inputType: 'text'
	}
];

export class ThreadsAdapter implements ChannelAdapter {
	readonly channel = 'threads' as const;
	readonly label = { vi: 'Threads', en: 'Threads' };
	readonly credentialFields = credentialFields;
	readonly configFields = configFields;

	async fetchNewOrders(
		account: ResolvedChannelAccount,
		cursor: string | null
	): Promise<{ orders: ChannelOrderDTO[]; cursor: string | null }> {
		if (isChannelMockEnabled('threads')) {
			return buildMockOrders('threads', account, cursor);
		}
		// ===== Adapter thật =====
		// Threads KHÔNG có order API — placeholder cho flow inbox-to-order
		// (trả về rỗng khi có adapter thật — đơn từ inbox phải nhập tay).
		throw notConfiguredError('threads');
	}

	async testConnection(account: ResolvedChannelAccount): Promise<{ ok: boolean; message?: string }> {
		if (isChannelMockEnabled('threads')) {
			return { ok: true, message: 'Threads mock mode — kết nối giả lập OK' };
		}
		if (!account.credentials.accessToken) {
			return { ok: false, message: 'Thiếu Access Token' };
		}
		throw notConfiguredError('threads');
	}
}

export const threadsAdapter = new ThreadsAdapter();
