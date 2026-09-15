import type { ButtonProps } from '$components/element/button/_interface';
import type { ToastProps } from '$components/element/toast/_interface';
import type { TooltipConfigs } from '$components/element/tooltip/_interface';
import type { Color, Size, TimeUnits } from '$components/interface';
import type { KeyboardNumberConfigs } from '$components/keyboard/number/_interface';
import type { Timezone } from './timezone';

export type AuthMethod = 'webauthn' | 'password';
export interface ServerResponse {
	ok: boolean;
	/** Nội dung phản hồi đa ngôn ngữ */
	message?: TranslateContent;
	data?: { [k: string]: any };
	/** HTTP status code (chỉ dùng ở client-side, từ apiFetch) */
	status?: number;
}
interface VisualKeyboardMeta {
	width: number;
	height: number;
	delay?: number;
	ref?: HTMLElement;
}
export interface MetaBrowser {
	originalResolution?: {
		width: number;
		height: number;
	};
	userAgent?: string | null;
	isMobile?: boolean;
	os?: 'window' | 'mac' | 'linux' | 'android' | 'ios' | 'chrome';
	width?: number;
	height?: number;
	ip?: `${number}:${number}:${number}:${number}`;
	region?: Region;
	language?: LanguageCode;
	country?: CountryCode;
	theme?: 'dark' | 'light' | 'system';
	preferColor?: 'dark' | 'light';
	timezone?: Timezone;
	/**
	 * Duration in miliseconds
	 */
	duration?: TimeUnits;
	/**
	 * delay in miliseconds
	 */
	delay?: number;
	transition?: {
		fade?: {
			/**
			 * Duration in miliseconds
			 */
			duration?: number;
		};
		fly?: {
			/**
			 * Duration in miliseconds
			 */
			duration?: number;
			x?: number;
			y?: number;
		};
	};
	size?: Size;
	direction?: Direction;
	disabled?: boolean;
	modalStorage?: HTMLElement;
	windows?: Map<
		string,
		{
			ref: HTMLElement;
		}
	>;
	visualInput?: HTMLInputElement;
	visualKeyboard?: VisualKeyboardMeta;
	clipboard?: Map<number, string>;
	tooltips?: Map<HTMLElement, TooltipConfigs>;
	keyboard?: {
		number: KeyboardNumberConfigs;
	};
	layers?: Map<HTMLElement, number | 'root'>;
	toasts?: {
		ref?: HTMLElement;
		children: Map<
			string,
			{
				title: string;
				description?: string;
				color?: Color;
				indicator?: string;
				disabled?: boolean;
				showCloseButton?: boolean;
				action?: ButtonProps;
				duration?: TimeUnits | 'infinite';
				id?: string;
				ref?: HTMLElement;
				offset?: number;
				position?: ToastProps['position'];
			}
		>;
		create: (data: {
			id?: string;
			title: string;
			description?: string;
			color?: Color;
			indicator?: string;
			disabled?: boolean;
			showCloseButton?: boolean;
			action?: ButtonProps;
			duration?: TimeUnits | 'infinite';
			position?: ToastProps['position'];
			offset?: number;
		}) => void;
		remove: (key: string) => void;
	};
}
export interface MetaSystem {
	publicKey?: CryptoKey;
	privateKey?: CryptoKey;
	sessionPublicKey?: CryptoKey;
	sessionPrivateKey?: CryptoKey;
	sessionPrivateKeyB64: string;
	sessionPublicKeyB64: string;
}
export interface MetaUser {
	firstName: string;
	lastName: string;
	dob?: string;
	region: Region;
	country: CountryCode;
	gender: 'Male' | 'Female';
	phone?: string;
	email: string;
	username: string;
	password: string;
	role?: 'admin' | 'staff' | 'customer';
}
export type Region = // Africa
	| 'Northern Africa'
	| 'Eastern Africa'
	| 'Middle Africa'
	| 'Southern Africa'
	| 'Western Africa'
	// Americas
	| 'Caribbean'
	| 'Central America'
	| 'South America'
	| 'Northern America'
	// Asia
	| 'Central Asia'
	| 'Eastern Asia'
	| 'South-Eastern Asia'
	| 'Southern Asia'
	| 'Western Asia'
	// Europe
	| 'Eastern Europe'
	| 'Northern Europe'
	| 'Southern Europe'
	| 'Western Europe'
	// Oceania
	| 'Australia and New Zealand'
	| 'Melanesia'
	| 'Micronesia'
	| 'Polynesia';

// export type Size =
// 	| 'xs'
// 	| 'sm'
// 	| 'md'
// 	| 'lg'
// 	| 'xl'
// 	| '2xl'
// 	| '3xl'
// 	| '4xl'
// 	| '5xl'
// 	| '6xl'
// 	| '7xl'
// 	| '8xl'
// 	| '9xl';
export type Theme = 'dark' | 'light' | 'system';
// export type Color = 'default' | 'info' | 'success' | 'warning' | 'error' | 'secondary' | 'primary';
// export type Variant =
// 	| 'outline'
// 	| 'solid'
// 	| 'soft'
// 	| 'subtle'
// 	| 'ghost'
// 	| 'link'
// 	| 'shadow'
// 	| 'flat'
// 	| 'faded'
// 	| 'light';
export interface Browser {
	type?:
		| 'mobile/android'
		| 'mobile/ios'
		| 'desktop/window'
		| 'desktop/mac'
		| 'desktop/linux'
		| 'desktop/chrome';
	userAgent?: string;
	dimensions?: {
		/**Pixel units */
		width?: number;
		/**Pixcel units */
		height?: number;
	};
	theme?: Theme;
	timezone?: Timezone;
	region?: string;
	OS?: string;
	safariBrowser?: {
		addressBarMinimized?: boolean;
		visualKeyboardDisplay?: boolean;
		visualKeyboardDurationShow?: number;
		onDurationDetected?: () => void;
	};
}
export type AppTheme = 'system' | 'dark' | 'light';
export interface Screen {
	width: number | null;
	height: number | null;
}
export type LanguageCode =
	| 'aa'
	| 'ab'
	| 'ae'
	| 'af'
	| 'ak'
	| 'am'
	| 'an'
	| 'ar'
	| 'as'
	| 'av'
	| 'ay'
	| 'az'
	| 'ba'
	| 'be'
	| 'bg'
	| 'bh'
	| 'bi'
	| 'bm'
	| 'bn'
	| 'bo'
	| 'br'
	| 'bs'
	| 'ca'
	| 'ce'
	| 'ch'
	| 'co'
	| 'cr'
	| 'cs'
	| 'cu'
	| 'cv'
	| 'cy'
	| 'da'
	| 'de'
	| 'dv'
	| 'dz'
	| 'ee'
	| 'el'
	| 'en'
	| 'eo'
	| 'es'
	| 'et'
	| 'eu'
	| 'fa'
	| 'ff'
	| 'fi'
	| 'fj'
	| 'fo'
	| 'fr'
	| 'fy'
	| 'ga'
	| 'gd'
	| 'gl'
	| 'gn'
	| 'gu'
	| 'gv'
	| 'ha'
	| 'he'
	| 'hi'
	| 'ho'
	| 'hr'
	| 'ht'
	| 'hu'
	| 'hy'
	| 'hz'
	| 'ia'
	| 'id'
	| 'ie'
	| 'ig'
	| 'ii'
	| 'ik'
	| 'io'
	| 'is'
	| 'it'
	| 'iu'
	| 'ja'
	| 'jv'
	| 'ka'
	| 'kg'
	| 'ki'
	| 'kj'
	| 'kk'
	| 'kl'
	| 'km'
	| 'kn'
	| 'ko'
	| 'kr'
	| 'ks'
	| 'ku'
	| 'kv'
	| 'kw'
	| 'ky'
	| 'la'
	| 'lb'
	| 'lg'
	| 'li'
	| 'ln'
	| 'lo'
	| 'lt'
	| 'lu'
	| 'lv'
	| 'mg'
	| 'mh'
	| 'mi'
	| 'mk'
	| 'ml'
	| 'mn'
	| 'mr'
	| 'ms'
	| 'mt'
	| 'my'
	| 'na'
	| 'nb'
	| 'nd'
	| 'ne'
	| 'ng'
	| 'nl'
	| 'nn'
	| 'no'
	| 'nr'
	| 'nv'
	| 'ny'
	| 'oc'
	| 'oj'
	| 'om'
	| 'or'
	| 'os'
	| 'pa'
	| 'pi'
	| 'pl'
	| 'ps'
	| 'pt'
	| 'qu'
	| 'rm'
	| 'rn'
	| 'ro'
	| 'ru'
	| 'rw'
	| 'sa'
	| 'sc'
	| 'sd'
	| 'se'
	| 'sg'
	| 'si'
	| 'sk'
	| 'sl'
	| 'sm'
	| 'sn'
	| 'so'
	| 'sq'
	| 'sr'
	| 'ss'
	| 'st'
	| 'su'
	| 'sv'
	| 'sw'
	| 'ta'
	| 'te'
	| 'tg'
	| 'th'
	| 'ti'
	| 'tk'
	| 'tl'
	| 'tn'
	| 'to'
	| 'tr'
	| 'ts'
	| 'tt'
	| 'tw'
	| 'ty'
	| 'ug'
	| 'uk'
	| 'ur'
	| 'uz'
	| 've'
	| 'vi'
	| 'vo'
	| 'wa'
	| 'wo'
	| 'xh'
	| 'yi'
	| 'yo'
	| 'za'
	| 'zh'
	| 'zu';
export type CountryCode =
	| 'AD'
	| 'AE'
	| 'AF'
	| 'AG'
	| 'AI'
	| 'AL'
	| 'AM'
	| 'AO'
	| 'AQ'
	| 'AR'
	| 'AS'
	| 'AT'
	| 'AU'
	| 'AW'
	| 'AX'
	| 'AZ'
	| 'BA'
	| 'BB'
	| 'BD'
	| 'BE'
	| 'BF'
	| 'BG'
	| 'BH'
	| 'BI'
	| 'BJ'
	| 'BL'
	| 'BM'
	| 'BN'
	| 'BO'
	| 'BQ'
	| 'BR'
	| 'BS'
	| 'BT'
	| 'BV'
	| 'BW'
	| 'BY'
	| 'BZ'
	| 'CA'
	| 'CC'
	| 'CD'
	| 'CF'
	| 'CG'
	| 'CH'
	| 'CI'
	| 'CK'
	| 'CL'
	| 'CM'
	| 'CN'
	| 'CO'
	| 'CR'
	| 'CU'
	| 'CV'
	| 'CW'
	| 'CX'
	| 'CY'
	| 'CZ'
	| 'DE'
	| 'DJ'
	| 'DK'
	| 'DM'
	| 'DO'
	| 'DZ'
	| 'EC'
	| 'EE'
	| 'EG'
	| 'EH'
	| 'ER'
	| 'ES'
	| 'ET'
	| 'FI'
	| 'FJ'
	| 'FK'
	| 'FM'
	| 'FO'
	| 'FR'
	| 'GA'
	| 'GB'
	| 'GD'
	| 'GE'
	| 'GF'
	| 'GG'
	| 'GH'
	| 'GI'
	| 'GL'
	| 'GM'
	| 'GN'
	| 'GP'
	| 'GQ'
	| 'GR'
	| 'GS'
	| 'GT'
	| 'GU'
	| 'GW'
	| 'GY'
	| 'HK'
	| 'HM'
	| 'HN'
	| 'HR'
	| 'HT'
	| 'HU'
	| 'ID'
	| 'IE'
	| 'IL'
	| 'IM'
	| 'IN'
	| 'IO'
	| 'IQ'
	| 'IR'
	| 'IS'
	| 'IT'
	| 'JE'
	| 'JM'
	| 'JO'
	| 'JP'
	| 'KE'
	| 'KG'
	| 'KH'
	| 'KI'
	| 'KM'
	| 'KN'
	| 'KP'
	| 'KR'
	| 'KW'
	| 'KY'
	| 'KZ'
	| 'LA'
	| 'LB'
	| 'LC'
	| 'LI'
	| 'LK'
	| 'LR'
	| 'LS'
	| 'LT'
	| 'LU'
	| 'LV'
	| 'LY'
	| 'MA'
	| 'MC'
	| 'MD'
	| 'ME'
	| 'MF'
	| 'MG'
	| 'MH'
	| 'MK'
	| 'ML'
	| 'MM'
	| 'MN'
	| 'MO'
	| 'MP'
	| 'MQ'
	| 'MR'
	| 'MS'
	| 'MT'
	| 'MU'
	| 'MV'
	| 'MW'
	| 'MX'
	| 'MY'
	| 'MZ'
	| 'NA'
	| 'NC'
	| 'NE'
	| 'NF'
	| 'NG'
	| 'NI'
	| 'NL'
	| 'NO'
	| 'NP'
	| 'NR'
	| 'NU'
	| 'NZ'
	| 'OM'
	| 'PA'
	| 'PE'
	| 'PF'
	| 'PG'
	| 'PH'
	| 'PK'
	| 'PL'
	| 'PM'
	| 'PN'
	| 'PR'
	| 'PS'
	| 'PT'
	| 'PW'
	| 'PY'
	| 'QA'
	| 'RE'
	| 'RO'
	| 'RS'
	| 'RU'
	| 'RW'
	| 'SA'
	| 'SB'
	| 'SC'
	| 'SD'
	| 'SE'
	| 'SG'
	| 'SH'
	| 'SI'
	| 'SJ'
	| 'SK'
	| 'SL'
	| 'SM'
	| 'SN'
	| 'SO'
	| 'SR'
	| 'SS'
	| 'ST'
	| 'SV'
	| 'SX'
	| 'SY'
	| 'SZ'
	| 'TC'
	| 'TD'
	| 'TF'
	| 'TG'
	| 'TH'
	| 'TJ'
	| 'TK'
	| 'TL'
	| 'TM'
	| 'TN'
	| 'TO'
	| 'TR'
	| 'TT'
	| 'TV'
	| 'TW'
	| 'TZ'
	| 'UA'
	| 'UG'
	| 'UM'
	| 'US'
	| 'UY'
	| 'UZ'
	| 'VA'
	| 'VC'
	| 'VE'
	| 'VG'
	| 'VI'
	| 'VN'
	| 'VU'
	| 'WF'
	| 'WS'
	| 'YE'
	| 'YT'
	| 'ZA'
	| 'ZM'
	| 'ZW';
export const PhoneAreaCode: Record<CountryCode, string> = {
	AD: '+376',
	AE: '+971',
	AF: '+93',
	AG: '+1268',
	AI: '+1264',
	AL: '+355',
	AM: '+374',
	AO: '+244',
	AQ: '+672',
	AR: '+54',
	AS: '+1684',
	AT: '+43',
	AU: '+61',
	AW: '+297',
	AX: '+358',
	AZ: '+994',
	BA: '+387',
	BB: '+1246',
	BD: '+880',
	BE: '+32',
	BF: '+226',
	BG: '+359',
	BH: '+973',
	BI: '+257',
	BJ: '+229',
	BL: '+590',
	BM: '+1441',
	BN: '+673',
	BO: '+591',
	BQ: '+599',
	BR: '+55',
	BS: '+1242',
	BT: '+975',
	BV: '+47',
	BW: '+267',
	BY: '+375',
	BZ: '+501',
	CA: '+1',
	CC: '+61',
	CD: '+243',
	CF: '+236',
	CG: '+242',
	CH: '+41',
	CI: '+225',
	CK: '+682',
	CL: '+56',
	CM: '+237',
	CN: '+86',
	CO: '+57',
	CR: '+506',
	CU: '+53',
	CV: '+238',
	CW: '+599',
	CX: '+61',
	CY: '+357',
	CZ: '+420',
	DE: '+49',
	DJ: '+253',
	DK: '+45',
	DM: '+1767',
	DO: '+1809',
	DZ: '+213',
	EC: '+593',
	EE: '+372',
	EG: '+20',
	EH: '+212',
	ER: '+291',
	ES: '+34',
	ET: '+251',
	FI: '+358',
	FJ: '+679',
	FK: '+500',
	FM: '+691',
	FO: '+298',
	FR: '+33',
	GA: '+241',
	GB: '+44',
	GD: '+1473',
	GE: '+995',
	GF: '+594',
	GG: '+44',
	GH: '+233',
	GI: '+350',
	GL: '+299',
	GM: '+220',
	GN: '+224',
	GP: '+590',
	GQ: '+240',
	GR: '+30',
	GS: '+500',
	GT: '+502',
	GU: '+1671',
	GW: '+245',
	GY: '+592',
	HK: '+852',
	HM: '+672',
	HN: '+504',
	HR: '+385',
	HT: '+509',
	HU: '+36',
	ID: '+62',
	IE: '+353',
	IL: '+972',
	IM: '+44',
	IN: '+91',
	IO: '+246',
	IQ: '+964',
	IR: '+98',
	IS: '+354',
	IT: '+39',
	JE: '+44',
	JM: '+1876',
	JO: '+962',
	JP: '+81',
	KE: '+254',
	KG: '+996',
	KH: '+855',
	KI: '+686',
	KM: '+269',
	KN: '+1869',
	KP: '+850',
	KR: '+82',
	KW: '+965',
	KY: '+1345',
	KZ: '+7',
	LA: '+856',
	LB: '+961',
	LC: '+1758',
	LI: '+423',
	LK: '+94',
	LR: '+231',
	LS: '+266',
	LT: '+370',
	LU: '+352',
	LV: '+371',
	LY: '+218',
	MA: '+212',
	MC: '+377',
	MD: '+373',
	ME: '+382',
	MF: '+590',
	MG: '+261',
	MH: '+692',
	MK: '+389',
	ML: '+223',
	MM: '+95',
	MN: '+976',
	MO: '+853',
	MP: '+1670',
	MQ: '+596',
	MR: '+222',
	MS: '+1664',
	MT: '+356',
	MU: '+230',
	MV: '+960',
	MW: '+265',
	MX: '+52',
	MY: '+60',
	MZ: '+258',
	NA: '+264',
	NC: '+687',
	NE: '+227',
	NF: '+672',
	NG: '+234',
	NI: '+505',
	NL: '+31',
	NO: '+47',
	NP: '+977',
	NR: '+674',
	NU: '+683',
	NZ: '+64',
	OM: '+968',
	PA: '+507',
	PE: '+51',
	PF: '+689',
	PG: '+675',
	PH: '+63',
	PK: '+92',
	PL: '+48',
	PM: '+508',
	PN: '+64',
	PR: '+1787',
	PS: '+970',
	PT: '+351',
	PW: '+680',
	PY: '+595',
	QA: '+974',
	RE: '+262',
	RO: '+40',
	RS: '+381',
	RU: '+7',
	RW: '+250',
	SA: '+966',
	SB: '+677',
	SC: '+248',
	SD: '+249',
	SE: '+46',
	SG: '+65',
	SH: '+290',
	SI: '+386',
	SJ: '+47',
	SK: '+421',
	SL: '+232',
	SM: '+378',
	SN: '+221',
	SO: '+252',
	SR: '+597',
	SS: '+211',
	ST: '+239',
	SV: '+503',
	SX: '+1721',
	SY: '+963',
	SZ: '+268',
	TC: '+1649',
	TD: '+235',
	TF: '+262',
	TG: '+228',
	TH: '+66',
	TJ: '+992',
	TK: '+690',
	TL: '+670',
	TM: '+993',
	TN: '+216',
	TO: '+676',
	TR: '+90',
	TT: '+1868',
	TV: '+688',
	TW: '+886',
	TZ: '+255',
	UA: '+380',
	UG: '+256',
	UM: '+1',
	US: '+1',
	UY: '+598',
	UZ: '+998',
	VA: '+379',
	VC: '+1784',
	VE: '+58',
	VG: '+1284',
	VI: '+1340',
	VN: '+84',
	VU: '+678',
	WF: '+681',
	WS: '+685',
	YE: '+967',
	YT: '+262',
	ZA: '+27',
	ZM: '+260',
	ZW: '+263'
};
export type TranslateContent = {
	[k in LanguageCode]?: string;
};
export type Direction = 'ltr' | 'rtl';
