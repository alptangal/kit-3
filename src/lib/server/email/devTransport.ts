import { dev } from '$app/environment';
import type { EmailMessage, EmailTransport } from './_interface';

type StoredEmail = EmailMessage & { sentAt: string };

/**
 * Dev transport — outbox trong memory (globalThis chống HMR reset) + console log.
 */
export class DevTransport implements EmailTransport {
	private get outbox(): StoredEmail[] {
		const g = globalThis as unknown as { __devOutbox?: StoredEmail[] };
		return (g.__devOutbox ??= []);
	}

	async send(message: EmailMessage): Promise<void> {
		if (!dev) return;
		this.outbox.push({ ...message, sentAt: new Date().toISOString() });
		if (this.outbox.length > 50) this.outbox.shift(); // giữ 50 email gần nhất
		console.log(`[DEV EMAIL] to=${message.to} subject="${message.subject}"`);
	}

	readOutbox(): StoredEmail[] {
		return this.outbox;
	}
}
