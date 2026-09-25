import type { TranslateContent } from '$interfaces/basic';

export const pageContents: { [key: string]: TranslateContent } = {
	title: { vi: 'Xác nhận email', en: 'Verify Email' },
	subtitle: { vi: 'Đang xác nhận địa chỉ email của bạn...', en: 'Verifying your email address...' },
	verifying: { vi: 'Đang xác nhận...', en: 'Verifying...' },
	invalidTitle: { vi: 'Liên kết không hợp lệ', en: 'Invalid link' },
	invalidDesc: {
		vi: 'Liên kết xác nhận không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.',
		en: 'This verification link is invalid or has expired. Please request a new link.'
	},
	successTitle: { vi: 'Email đã được xác nhận!', en: 'Your email is verified!' },
	successDesc: { vi: 'Bạn có thể đăng nhập ngay bây giờ.', en: 'You can sign in right now.' },
	backToLogin: { vi: 'Đăng nhập', en: 'Sign in' },
	resend: { vi: 'Yêu cầu liên kết mới', en: 'Request a new link' }
};
