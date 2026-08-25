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
}
