// $lib/server/channels/discord.ts
// Discord Bot API — bot nhận đơn qua command/message trong server Discord.
// Cần bot token + guild (server) ID + channel ID nơi nhận đơn.
// Doc: https://discord.com/developers/docs
// HIỆN TẠI: mock mode (CHANNEL_DISCORD_MOCK).
//
// Env khi có key:
//   CHANNEL_DISCORD_BOT_TOKEN, CHANNEL_DISCORD_GUILD_ID,
//   CHANNEL_DISCORD_CHANNEL_ID, CHANNEL_DISCORD_MOCK=false

import type { ChannelAdapter, ChannelFieldDef, ChannelOrderDTO, ResolvedChannelAccount } from './types';
import { buildMockOrders, isChannelMockEnabled, notConfiguredError } from './mock-util';

const credentialFields: ChannelFieldDef[] = [
	{
		key: 'botToken',
		label: { vi: 'Bot Token', en: 'Bot Token' },
		inputType: 'password',
		required: true
	}
];

const configFields: ChannelFieldDef[] = [
	{
		key: 'guildId',
		label: { vi: 'Server (Guild) ID', en: 'Server (Guild) ID' },
		inputType: 'text',
		required: true
	},
	{
		key: 'channelId',
		label: { vi: 'Channel nhận đơn', en: 'Order channel ID' },
		inputType: 'text',
		required: true
	}
];

export class DiscordAdapter implements ChannelAdapter {
	readonly channel = 'discord' as const;
	readonly label = { vi: 'Discord', en: 'Discord' };
	readonly credentialFields = credentialFields;
	readonly configFields = configFields;

	async fetchNewOrders(
		account: ResolvedChannelAccount,
		cursor: string | null
	): Promise<{ orders: ChannelOrderDTO[]; cursor: string | null }> {
		if (isChannelMockEnabled('discord')) {
			return buildMockOrders('discord', account, cursor);
		}
		// ===== Adapter thật =====
		// TODO: GET /channels/{id}/messages (after = cursor snowflake)
		//   + parse embed/command /order
		throw notConfiguredError('discord');
	}

	async testConnection(account: ResolvedChannelAccount): Promise<{ ok: boolean; message?: string }> {
		if (isChannelMockEnabled('discord')) {
			return { ok: true, message: 'Discord mock mode — kết nối giả lập OK' };
		}
		if (!account.credentials.botToken) {
			return { ok: false, message: 'Thiếu Bot Token' };
		}
		throw notConfiguredError('discord');
	}
}

export const discordAdapter = new DiscordAdapter();
