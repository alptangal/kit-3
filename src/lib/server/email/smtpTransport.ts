import type { EmailMessage, EmailTransport } from './_interface';

/**
 * SMTP transport — SMTP-ready shape. Chưa implement wire protocol (không có email lib trong package.json,
 * không thêm dependency mới). Khi SMTP_HOST/... được cấu hình, cài nodemailer hoặc hand-built client
 * và implement send() — interface này là điểm cắm duy nhất.
 */
export class SmtpTransport implements EmailTransport {
	constructor(
		private readonly config: { host: string; port: number; user: string; pass: string; from: string }
	) {}

	async send(message: EmailMessage): Promise<void> {
		// SMTP wire protocol chưa implement — throw rõ ràng thay vì im lặng bỏ email
		throw new Error(
			`SmtpTransport.send() not implemented (would send to ${message.to} via ${this.config.host}:${this.config.port}). Configure a real transport or use DevTransport.`
		);
	}
}
