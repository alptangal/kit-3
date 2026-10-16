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
}
