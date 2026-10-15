// $lib/server/channels/telegram.ts
// Telegram Bot API (api.telegram.org) — bot nhận đơn qua chat/command.
// Cần bot_token từ @BotFather + chat_id kênh/nhóm bán hàng.
// Doc: https://core.telegram.org/bots/api
// HIỆN TẠI: mock mode (CHANNEL_TELEGRAM_MOCK).
//
// Env khi có key:
//   CHANNEL_TELEGRAM_BOT_TOKEN, CHANNEL_TELEGRAM_CHAT_ID,
//   CHANNEL_TELEGRAM_MOCK=false

import type { ChannelAdapter, ChannelFieldDef, ChannelOrderDTO, ResolvedChannelAccount } from './types';
import { buildMockOrders, isChannelMockEnabled, notConfiguredError } from './mock-util';

const credentialFields: ChannelFieldDef[] = [
	{
		key: 'botToken',
		label: { vi: 'Bot Token (@BotFather)', en: 'Bot Token (@BotFather)' },
		inputType: 'password',
		required: true
	}
];

const configFields: ChannelFieldDef[] = [
	{
		key: 'chatId',
		label: { vi: 'Chat ID kênh bán', en: 'Sales channel chat ID' },
		inputType: 'text',
		required: true
	}
];

export class TelegramAdapter implements ChannelAdapter {
	readonly channel = 'telegram' as const;
	readonly label = { vi: 'Telegram', en: 'Telegram' };
	readonly credentialFields = credentialFields;
	readonly configFields = configFields;

	async fetchNewOrders(
		account: ResolvedChannelAccount,
		cursor: string | null
	): Promise<{ orders: ChannelOrderDTO[]; cursor: string | null }> {
		if (isChannelMockEnabled('telegram')) {
			return buildMockOrders('telegram', account, cursor);
		}
		// ===== Adapter thật =====
		// TODO: getUpdates (offset = cursor) + parse message /order theo format
		// Đây là flow "bot nhận đơn qua chat" — parse text đơn từ message.
		throw notConfiguredError('telegram');
	}

	async testConnection(account: ResolvedChannelAccount): Promise<{ ok: boolean; message?: string }> {
		if (isChannelMockEnabled('telegram')) {
			return { ok: true, message: 'Telegram mock mode — kết nối giả lập OK' };
		}
		if (!account.credentials.botToken) {
			return { ok: false, message: 'Thiếu Bot Token' };
		}
		throw notConfiguredError('telegram');
	}
}

export const telegramAdapter = new TelegramAdapter();
