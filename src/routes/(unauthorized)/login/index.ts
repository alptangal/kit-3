import type { TranslateContent } from '$interfaces/basic';

export const pageContents: { [k: string]: TranslateContent } = {
	username: {
		vi: 'tên đăng nhập',
		en: 'username'
	},
	password: {
		vi: 'mật khẩu',
		en: 'password'
	},
	login: {
		en: 'login',
		vi: 'đăng nhập'
	},
	reset: {
		en: 'reset',
		vi: 'đặt lại'
	},
	remember: {
		en: 'remember',
		vi: 'lưu thông tin đăng nhập'
	},
	responseOk: {
		vi: 'đăng nhập thành công',
		en: 'login success'
	},
	responseFail: {
		vi: 'đăng nhập không thành công. Vui lòng kiểm tra thông tin đăng nhập!',
		en: 'login failed. Please check your username/password again!'
	}
};
