export interface EmailMessage {
	to: string;
	subject: string;
	html: string;
}

export interface EmailTransport {
	send(message: EmailMessage): Promise<void>;
}

export interface EmailService {
	sendEmail(message: EmailMessage): Promise<void>;
	getOutbox(): EmailMessage[];
}
