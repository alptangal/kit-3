import type { TranslateContent } from '$interfaces/basic';

export const pageContents: {
	textFields: { [k: string]: TranslateContent };
	buttons: { [k: string]: TranslateContent };
} = {
	textFields: {
		firstname: {
			en: 'firstname',
			vi: 'tên'
		},
		midname: {
			en: 'midname',
			vi: 'tên đệm'
		},
		lastname: {
			en: 'lastname',
			vi: 'họ'
		},
		username: {
			vi: 'tên đăng nhập',
			en: 'username'
		},
		email: {
			vi: 'email',
			en: 'email'
		},
		password: {
			vi: 'mật khẩu',
			en: 'password'
		},
		confirmPassword: {
			en: 'confirm password',
			vi: 'mật khẩu xác nhận'
		}
	},
	buttons: {
		confirm: {
			en: 'register',
			vi: 'đăng ký'
		},
		reset: {
			en: 'reset',
			vi: 'đặt lại'
		}
	}
};
