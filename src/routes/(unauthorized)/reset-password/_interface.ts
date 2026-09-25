export interface ResetPasswordRequestBody {
	token: string;
	password: string;
	publicKeyB64: string;
}
