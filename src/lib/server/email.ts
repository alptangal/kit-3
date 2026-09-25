import { dev } from '$app/environment';
import { DevTransport } from './email/devTransport';
import { SmtpTransport } from './email/smtpTransport';
import type { EmailMessage, EmailService, EmailTransport } from './email/_interface';

const devTransport = new DevTransport();

// Chọn transport theo môi trường: dev → outbox; production → SMTP nếu cấu hình, throw nếu không
function createTransport(): EmailTransport {
	if (dev) return devTransport;
	const host = process.env.SMTP_HOST;
	const port = Number(process.env.SMTP_PORT ?? '587');
	const user = process.env.SMTP_USER ?? '';
	const pass = process.env.SMTP_PASS ?? '';
	const from = process.env.SMTP_FROM ?? user;
	if (host) return new SmtpTransport({ host, port, user, pass, from });
	return devTransport; // production chưa cấu hình SMTP → outbox + console (không mất email)
}

const service: EmailService = {
	async sendEmail(message: EmailMessage): Promise<void> {
		await createTransport().send(message);
	},
	getOutbox(): EmailMessage[] {
		return devTransport.readOutbox();
	}
};

export function getEmailService(): EmailService {
	return service;
}

/** Facade — Task 1/2 call sites giữ nguyên (fire-and-forget, sync signature). */
export function sendDevEmail(to: string, subject: string, html: string): void {
	service.sendEmail({ to, subject, html }).catch((e) => console.error('[email] send failed:', e));
}

export function getDevOutbox(): EmailMessage[] {
	return service.getOutbox();
}
