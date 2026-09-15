//routes/(unauthorized)/register/index.ts
export const pageContents: { [k: string]: any } = {
	title: {
		vi: 'Tạo tài khoản mới',
		en: 'Create an account'
	},
	subtitle: {
		vi: 'Đăng ký nhanh chóng với công nghệ bảo mật mã hoá tiên tiến',
		en: 'Sign up quickly with advanced end-to-end encryption'
	},
	welcomeHeadline: {
		vi: 'Tham gia cùng chúng tôi!',
		en: 'Join us today!'
	},
	welcomeDesc: {
		vi: 'Bắt đầu trải nghiệm nền tảng quản lý chuyên nghiệp, bảo mật dữ liệu tuyệt đối.',
		en: 'Start your journey with a professional, securely encrypted management platform.'
	},
	features: [
		{
			vi: 'Bảo mật Vault & E2E Encryption',
			en: 'Vault & End-to-end Encryption'
		},
		{
			vi: 'Kiến trúc dữ liệu phân tán chuẩn enterprise',
			en: 'Enterprise distributed data architecture'
		},
		{
			vi: 'Truy cập mọi lúc mọi nơi trên mọi thiết bị',
			en: 'Access anytime, anywhere on any device'
		}
	],
	textFields: {
		firstname: {
			en: 'First name',
			vi: 'Tên'
		},
		midname: {
			en: 'Middle name',
			vi: 'Tên đệm'
		},
		lastname: {
			en: 'Last name',
			vi: 'Họ'
		},
		username: {
			vi: 'Tên đăng nhập',
			en: 'Username'
		},
		email: {
			vi: 'Địa chỉ Email',
			en: 'Email address'
		},
		password: {
			vi: 'Mật khẩu',
			en: 'Password'
		},
		confirmPassword: {
			en: 'Confirm password',
			vi: 'Xác nhận mật khẩu'
		}
	},
	hints: {
		passwordHint: {
			vi: 'Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt',
			en: 'Min 8 chars, uppercase, lowercase, number & special char'
		},
		usernameHint: {
			vi: '3-30 ký tự (chữ cái, số, dấu gạch ngang, gạch dưới)',
			en: '3-30 characters (alphanumeric, -, _)'
		},
		confirmPasswordHint: {
			vi: 'Mật khẩu xác nhận phải khớp với mật khẩu ở trên',
			en: 'Must match the password entered above'
		}
	},
	terms: {
		agreeLabel: {
			vi: 'Tôi đồng ý với',
			en: 'I agree to the'
		},
		linkText: {
			vi: 'Điều khoản sử dụng & Chính sách bảo mật',
			en: 'Terms of Service & Privacy Policy'
		},
		modalTitle: {
			vi: 'Điều khoản Dịch vụ & Chính sách Bảo mật',
			en: 'Terms of Service & Privacy Policy'
		},
		modalIntro: {
			vi: 'Chào mừng bạn đến với hệ thống. Khi sử dụng dịch vụ, bạn đồng ý tuân thủ các quy tắc sau:',
			en: 'Welcome to our platform. By accessing or using our services, you agree to the following terms:'
		},
		modalP1: {
			vi: '1. Bảo mật dữ liệu: Toàn bộ thông tin cá nhân và mật khẩu của bạn được mã hoá hai chiều bằng khoá mã hoá cá nhân (DEK) và KEK. Server không thể đọc mật khẩu gốc của bạn.',
			en: '1. Data Security: All your personal info and credentials are end-to-end encrypted using personal DEK/KEK vaults. The server never stores your plaintext password.'
		},
		modalP2: {
			vi: '2. Quyền và nghĩa vụ: Bạn chịu trách nhiệm duy trì bảo mật thông tin đăng nhập và mọi hoạt động diễn ra dưới tài khoản của mình.',
			en: '2. Rights & Responsibilities: You are responsible for maintaining the confidentiality of your account credentials and all activities occurring under your account.'
		},
		modalP3: {
			vi: '3. Cam kết dịch vụ: Chúng tôi nỗ lực cung cấp dịch vụ ổn định, an toàn và hỗ trợ nhanh chóng nhất cho mọi người dùng.',
			en: '3. Service Commitment: We strive to provide a reliable, highly available and secure environment for all registered users.'
		},
		acceptBtn: {
			vi: 'Tôi đồng ý',
			en: 'I Accept'
		},
		declineBtn: {
			vi: 'Từ chối',
			en: 'Decline'
		}
	},
	buttons: {
		confirm: {
			en: 'Create account',
			vi: 'Đăng ký tài khoản'
		},
		reset: {
			en: 'Reset form',
			vi: 'Làm mới'
		}
	},
	hasAccount: {
		vi: 'Đã có tài khoản?',
		en: 'Already have an account?'
	},
	signIn: {
		vi: 'Đăng nhập ngay',
		en: 'Sign in now'
	},
	passwordStrength: {
		weak: { vi: 'Yếu', en: 'Weak' },
		fair: { vi: 'Trung bình', en: 'Fair' },
		good: { vi: 'Tốt', en: 'Good' },
		strong: { vi: 'Rất mạnh', en: 'Strong' }
	}
};

