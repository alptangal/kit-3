import type { TranslateContent } from '$interfaces/basic';

// src\routes\(unauthorized)\login\index.ts
// Nội dung đa ngôn ngữ cho trang đăng nhập
export const pageContents: { [k: string]: TranslateContent } = {
	// ── Tiêu đề trang ──
	title: {
		vi: 'Chào mừng trở lại',
		en: 'Welcome back'
	},
	subtitle: {
		vi: 'Đăng nhập vào tài khoản của bạn',
		en: 'Sign in to your account'
	},

	// ── Nhãn trường nhập ──
	username: {
		vi: 'Tên đăng nhập / Email',
		en: 'Username / Email'
	},
	password: {
		vi: 'Mật khẩu',
		en: 'Password'
	},
	remember: {
		vi: 'Ghi nhớ đăng nhập',
		en: 'Remember me'
	},
	forgotPassword: {
		vi: 'Quên mật khẩu?',
		en: 'Forgot password?'
	},

	// ── Nút bấm ──
	login: {
		en: 'Sign in',
		vi: 'Đăng nhập'
	},
	reset: {
		en: 'Reset',
		vi: 'Đặt lại'
	},

	// ── Phản hồi server ──
	responseOk: {
		vi: 'Đăng nhập thành công',
		en: 'Login successful'
	},
	responseFail: {
		vi: 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin!',
		en: 'Login failed. Please check your credentials!'
	},

	// ── Thông báo đăng ký thành công (redirect từ /register) ──
	registeredSuccess: {
		vi: 'Đăng ký thành công! Vui lòng đăng nhập để tiếp tục.',
		en: 'Registration successful! Please sign in to continue.'
	},

	// ── Khu vực link đăng ký ──
	noAccount: {
		vi: 'Chưa có tài khoản?',
		en: "Don't have an account?"
	},
	register: {
		vi: 'Tạo tài khoản',
		en: 'Create account'
	}
};
