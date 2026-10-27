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
		vi: 'Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản trước khi đăng nhập.',
		en: 'Registration successful! Please check your email to verify your account before signing in.'
	},

	// ── Khu vực link đăng ký ──
	noAccount: {
		vi: 'Chưa có tài khoản?',
		en: "Don't have an account?"
	},
	register: {
		vi: 'Tạo tài khoản',
		en: 'Create account'
	},

	// ── Passkey (WebAuthn) ──
	passkeyLogin: {
		vi: 'Đăng nhập bằng sinh trắc học',
		en: 'Sign in with biometrics'
	},
	// Batch 13 (m10824-4): text PC — USB security key / passkey storage.
	passkeyLoginUsb: {
		vi: 'Đăng nhập bằng USB key / passkey',
		en: 'Sign in with USB key / passkey'
	},
	passkeyOr: {
		vi: 'hoặc',
		en: 'or'
	},
	// ── Nhóm 3: thông điệp lỗi passkey (không nuốt im lặng) + hướng dẫn ──
	passkeyInitializing: {
		vi: 'Đang khởi tạo mã hoá, thử lại sau ít giây...',
		en: 'Encrypting handshake in progress, retry in a few seconds...'
	},
	passkeyCancelled: {
		vi: 'Bạn đã huỷ yêu cầu sinh trắc học.',
		en: 'Biometric prompt was cancelled.'
	},
	passkeyNoCredential: {
		vi: 'Thiết bị này chưa đăng ký passkey. Đăng ký ở Hồ sơ → Bảo mật sau khi đăng nhập.',
		en: 'No passkey registered on this device. Register in Profile → Security after signing in.'
	},
	passkeyOriginMismatch: {
		vi: 'Sai miền truy cập — mở qua địa chỉ HTTPS chính thức của hệ thống (xem hướng dẫn passkey).',
		en: 'Wrong origin — open via the official HTTPS address of the system (see the passkey guide).'
	},
	passkeyGuide: {
		vi: 'Cách bật và dùng đăng nhập sinh trắc học',
		en: 'How to enable and use biometric sign-in'
	},
	// Batch 13 (m10824-4): guide link lên trước divider — text phủ cả USB key.
	passkeyGuideUsb: {
		vi: 'Cách bật và dùng đăng nhập bằng passkey / USB key',
		en: 'How to enable and use passkey / USB key sign-in'
	},
	passkeyUnavailableHint: {
		vi: 'Thiết bị chưa có authenticator — bật Windows Hello / Touch ID rồi tải lại trang.',
		en: 'No authenticator on this device — enable Windows Hello / Touch ID and reload.'
	},

	// ── Batch 16: bước 2 xác thực hai yếu tố (TOTP) ──
	totpTitle: {
		vi: 'Xác thực hai yếu tố',
		en: 'Two-factor authentication'
	},
	totpHint: {
		vi: 'Nhập mã từ ứng dụng authenticator',
		en: 'Enter the code from your authenticator app'
	},
	totpCode: {
		vi: 'Mã xác thực',
		en: 'Verification code'
	},
	totpBack: {
		vi: 'Quay lại',
		en: 'Back'
	},
	totpVerify: {
		vi: 'Xác nhận',
		en: 'Verify'
	},
	totpVerifying: {
		vi: 'Đang xác nhận...',
		en: 'Verifying...'
	}
};
