// $lib/server/channels/registry.ts
// Registry map channel → adapter. Service/UI chỉ import registry này —
// thêm kênh mới = viết 1 file adapter + đăng ký ở đây (không đụng service).

import type { ChannelAdapter, ChannelId } from './types';
import { shopeeAdapter } from './shopee';
import { tiktokShopAdapter } from './tiktok-shop';
import { facebookAdapter } from './facebook';
import { lazadaAdapter } from './lazada';
import { threadsAdapter } from './threads';
import { instagramAdapter } from './instagram';
import { telegramAdapter } from './telegram';
import { discordAdapter } from './discord';
import { googleAdapter } from './google';

export const channelAdapters: Record<ChannelId, ChannelAdapter> = {
	shopee: shopeeAdapter,
	tiktok_shop: tiktokShopAdapter,
	facebook: facebookAdapter,
	google: googleAdapter,
	lazada: lazadaAdapter,
	threads: threadsAdapter,
	instagram: instagramAdapter,
	telegram: telegramAdapter,
	discord: discordAdapter
};

export function getChannelAdapter(channel: string): ChannelAdapter | null {
	return (channelAdapters as Record<string, ChannelAdapter>)[channel] ?? null;
}
