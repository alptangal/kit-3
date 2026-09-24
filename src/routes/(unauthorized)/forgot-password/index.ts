import type { TranslateContent } from '$interfaces/basic';

// src\routes\(unauthorized)\forgot-password\index.ts
// Nội dung đa ngôn ngữ cho trang quên mật khẩu
export const pageContents: { [k: string]: TranslateContent } = {
	// ── Tiêu đề trang ──
	title: {
		vi: 'Quên mật khẩu',
		en: 'Forgot password'
	},
	subtitle: {
		vi: 'Nhập email để nhận liên kết đặt lại mật khẩu',
		en: 'Enter your email to receive a password reset link'
	},

	// ── Nhãn trường nhập ──
	email: {
		vi: 'Địa chỉ Email',
		en: 'Email address'
	},

	// ── Nút bấm ──
	submit: {
		vi: 'Gửi liên kết đặt lại',
		en: 'Send reset link'
	},
	reset: {
		vi: 'Đặt lại',
		en: 'Reset'
	},
	backToLogin: {
		vi: 'Quay lại đăng nhập',
		en: 'Back to login'
	},

	// ── Phản hồi server ──
	responseOk: {
		vi: 'Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi',
		en: 'If the email exists, a password reset link has been sent'
	},
	responseFail: {
		vi: 'Đã xảy ra lỗi, vui lòng thử lại sau',
		en: 'An error occurred, please try again later'
	},

	// ── Thông báo thành công ──
	successTitle: {
		vi: 'Kiểm tra email của bạn',
		en: 'Check your email'
	},
	successDesc: {
		vi: 'Chúng tôi đã gửi liên kết đặt lại mật khẩu đến địa chỉ email của bạn. Vui lòng kiểm tra hộp thư đến (và thư rác).',
		en: 'We have sent a password reset link to your email address. Please check your inbox (and spam folder).'
	}
};