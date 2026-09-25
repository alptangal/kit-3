import { dev } from '$app/environment';

/**
 * Outbox dev — store email trong memory + log console.
 * globalThis-backed để sống qua Vite HMR module reload.
 * Task 3 sẽ nâng cấp thành EmailService interface (SMTP-ready).
 * Production (dev=false): no-op — Task 3 sẽ cắm transport thật.
 */
type DevEmail = { to: string; subject: string; html: string; sentAt: string };

const g = globalThis as unknown as { __devOutbox?: DevEmail[] };
const outbox = (g.__devOutbox ??= []);

export function sendDevEmail(to: string, subject: string, html: string): void {
	if (!dev) return; // production: im lặng cho đến khi Task 3 cắm SMTP transport
	const email: DevEmail = { to, subject, html, sentAt: new Date().toISOString() };
	outbox.push(email);
	if (outbox.length > 50) outbox.shift(); // giữ 50 email gần nhất
	console.log(`[DEV EMAIL] to=${to} subject="${subject}"`);
}

export function getDevOutbox(): DevEmail[] {
	return outbox;
}
