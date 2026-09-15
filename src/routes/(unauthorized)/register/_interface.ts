//$routes/(unauthorized)/register/_interface.ts
export interface RegisterRequestBody {
	firstname: string;
	lastname: string;
	midname?: string;
	username: string;
	email: string;
	phone?: string;
	password: string;
	publicKeyB64: string;
}

