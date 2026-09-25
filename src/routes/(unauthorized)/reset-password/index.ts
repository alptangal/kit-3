import type { TranslateContent } from '$interfaces/basic';

export const pageContents: { [key: string]: TranslateContent } = {
	title: { vi: 'Đặt lại mật khẩu', en: 'Reset Password' },
	subtitle: {
		vi: 'Tạo mật khẩu mới cho tài khoản của bạn',
		en: 'Create a new password for your account'
	},
	password: { vi: 'Mật khẩu mới', en: 'New password' },
	confirmPassword: { vi: 'Xác nhận mật khẩu', en: 'Confirm password' },
	submit: { vi: 'Đặt lại mật khẩu', en: 'Reset password' },
	reset: { vi: 'Xóa', en: 'Reset' },
	responseOk: {
		vi: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập với mật khẩu mới.',
		en: 'Password reset successful! You can now sign in with your new password.'
	},
	responseFail: {
		vi: 'Đặt lại mật khẩu thất bại. Vui lòng yêu cầu liên kết mới.',
		en: 'Password reset failed. Please request a new link.'
	},
	invalidLinkTitle: { vi: 'Liên kết không hợp lệ', en: 'Invalid link' },
	invalidLinkDesc: {
		vi: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.',
		en: 'This password reset link is invalid or has expired. Please request a new one.'
	},
	backToLogin: { vi: 'Quay lại đăng nhập', en: 'Back to login' },
	requestNew: { vi: 'Yêu cầu liên kết mới', en: 'Request a new link' },
	mismatchHint: { vi: 'Mật khẩu xác nhận không khớp.', en: 'Passwords do not match.' }
};
