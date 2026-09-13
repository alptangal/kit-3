// $lib/errors/translatable-error.ts (hoặc file dùng chung tuỳ cấu trúc dự án)
import type { TranslateContent } from '$interfaces/basic';

export class TranslatableError extends Error {
	content: TranslateContent;

	constructor(content: TranslateContent) {
		// message chỉ dùng cho log/debug nội bộ, không phải thứ trả về client
		super(content.en ?? content.vi ?? 'Unknown error');
		this.name = 'TranslatableError';
		this.content = content;
	}
}
