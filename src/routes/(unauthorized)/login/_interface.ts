export interface LoginConfigs {
	username: {
		value?: string;
	};
	password: {
		value?: string;
	};
	remember: {
		checked?: boolean;
	};
}
export interface LoginRequestBody {
	username: string;
	password: string;
	remember?: boolean;
	publicKeyB64: string;
	/** Public JWK (ECDSA P-256) của keypair DPoP client — server bind refresh token qua thumbprint (jkt). */
	dpopJwk?: { kty: string; crv: string; x: string; y: string };
	/** Batch 16: bước 2 TOTP — mã 6 số gửi lên /api/login/totp (server đọc dataDecrypted.code). */
	code?: string;
}
