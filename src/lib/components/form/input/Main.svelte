<script lang="ts">
	//$components/form/input/Main.svelte
	import { iconify } from '$assets/icons/iconify';
	import { Button, Icon } from '$components/element';
	// Checkbox row chọn-để-xóa + select-all (type='file' quickDelete) — IMPORT
	// TRỰC TIẾP file .svelte (bài học wave 6: barrel $components/form re-export
	// Checkbox root → circular import "Cannot access before initialization";
	// mirror pattern DataTable Head/Body).
	import Checkbox from '$components/form/checkbox/Main.svelte';
	import type { MouseEvents } from '$components/interface';
	import { measureTextWidth, styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client, profile } from '$store/basic.svelte';
	import { onDestroy, onMount, untrack, type SvelteComponent } from 'svelte';
	import type {
		InputConfigs,
		InputProps,
		NumberKeyAllowed,
		ValidationCompact,
		ValidationFull
	} from './_interface';
	import type { TextFieldConfigs } from '$components/form/textField/_interface';
	import type { ButtonConfigs } from '$components/element/button/_interface';
	import {
		text_keys_allowed,
		number_keys_allowed,
		currency_keys_allowed,
		defaultValidation,
		createDefaultInputEvents
	} from '.';
	import type { BasicConfigs, EventListener } from '$components/interface';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { ensureKeyboardHost } from '$modules/keyboardHost.svelte';
	import { browser } from '$app/environment';
	import { getFormContext } from '../form';
	import { getTextFieldContext } from '../textField';
	import { Modal } from '$components/modal';
	import type { FullAutoFill } from 'svelte/elements';
	import { ensureBarcodeDetector, playBeep, primeAudio, vibratePattern, type BarcodeDetectorResult } from '$modules/barcode';

	let {
		value = $bindable(),
		disabled = $bindable(),
		files = $bindable([] as File[]),
		codes = $bindable([] as string[]),
		...props
	}: InputProps = $props();
	// Ghi nhớ giá trị ban đầu khi component được tạo ra, dùng để reset về đúng mốc ban đầu
	let _initialValue: string | undefined = value;
	// Mốc ban đầu của files (type='file') — so cho status.changed + reset().
	// Chụp length: files có thể undefined về lý thuyết → luôn array.
	let _initialFiles: File[] = (files ?? []).slice();
	// Mốc ban đầu của codes (type='barcode') — mirror _initialFiles.
	let _initialCodes: string[] = (codes ?? []).slice();
	// type='file': vừa reset → files effect bỏ qua trigger validation 1 lần
	// (hoist lên vì configs.reset() tham chiếu; default true để ignore mount lần đầu)
	let _filesJustReset = $state(true);
	// type='barcode': vừa reset → codes effect bỏ qua trigger validation 1 lần
	let _codesJustReset = $state(true);

	// Form/TextField context đọc ngay đầu phase init (getFormContext()/getTextFieldContext()
	// = getContext(), không reactive) — hoist lên đầu để các derived phía dưới
	// (inputId, sizeDerived…) dùng được mà không dính "used before its declaration".
	const formContext = getFormContext();
	const textFieldContext = getTextFieldContext();

	// Generate unique ID for label association if not provided
	const inputId = $derived(props.id ?? (textFieldContext?.name ? `field-${textFieldContext.name}` : undefined));
	const typeDerived = $derived(props.type ?? 'text');

	// inputmode mặc định theo data type để mobile hiện đúng bàn phím
	// (email → keyboard @, phone → số +, number → dấu thập phân).
	// Prop `inputmode` của user luôn ưu tiên hơn default.
	const inputModeDerived = $derived.by(() => {
		if (props.inputmode) return props.inputmode;
		switch (typeDerived) {
			case 'email':
				return 'email';
			case 'phone':
				return 'tel';
			case 'number':
				return 'decimal';
			default:
				return undefined;
		}
	});

	// Track if field was just reset programmatically - suppress validation until user interacts
	let _justReset = $state(true);
	const sizeDerived = $derived(props.size ?? textFieldContext?.size ?? formContext?.size ?? client.browser?.size ?? 'md');
	const roundedDerived = $derived(props.rounded ?? sizeDerived);

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'input-root',
			`size-${sizeDerived}`,
			configs.status.focus ? 'focus' : undefined,
			`variant-${variantDerived}`,
			disabledDerived ? 'disabled' : undefined,
			`rounded-${roundedDerived}`,
			props.loading ? 'loading' : undefined,
			`color-${colorDerived}`,
			// type='file': dropzone + previews → height auto (không cố định min-height text)
			typeDerived == 'file' ? 'input-file-mode' : undefined,
			// type='barcode': list detected → height auto (mirror file mode)
			typeDerived == 'barcode' ? 'input-barcode-mode' : undefined,
			configs.status.hover || textFieldContext?.status.hover ? 'hover' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});

	const delayDerived = $derived(client.browser?.delay ?? 300);
	const durationDerived = $derived(client.browser?.delay ?? 300);
	const variantDerived = $derived(props.variant ?? 'secondary');

	const placeholderDerived = $derived.by(() => {
		if (!props.placeholder) return undefined;
		if (typeof props.placeholder === 'string') return props.placeholder;
		const currentLang = client.browser?.language ?? 'en';
		const text = props.placeholder[currentLang] ?? props.placeholder.en ?? props.placeholder.vi;
		return text ? text : undefined;
	});

	const maxLengthDerived = $derived.by(() => {
		if (props.maxLength)
			return typeof props.maxLength == 'number' ? props.maxLength : parseFloat(props.maxLength);
		return undefined;
	});

	const maxNumberDerived = $derived.by(() => {
		return typeof props.maxNumber == 'number'
			? props.maxNumber
			: props.maxNumber
				? parseFloat(props.maxNumber)
				: undefined;
	});

	const minNumberDerived = $derived.by(() => {
		return typeof props.minNumber == 'number'
			? props.minNumber
			: props.minNumber
				? parseFloat(props.minNumber)
				: undefined;
	});

	// ── type='currency': locale + symbol + decimals mặc định theo currency ──
	// VND → vi-VN ("1.234 ₫", suffix, 0 decimals); USD/EUR/GBP/JPY → en-US
	// (prefix, USD 2, JPY 0). symbol prop ghi đè symbol từ currency.
	const CURRENCY_DEFAULTS: { [currencyCode: string]: { locale: string; prefix: boolean; decimals: number } } = {
		VND: { locale: 'vi-VN', prefix: false, decimals: 0 },
		USD: { locale: 'en-US', prefix: true, decimals: 2 },
		EUR: { locale: 'en-US', prefix: true, decimals: 2 },
		GBP: { locale: 'en-GB', prefix: true, decimals: 2 },
		JPY: { locale: 'ja-JP', prefix: true, decimals: 0 },
		CNY: { locale: 'zh-CN', prefix: true, decimals: 2 },
		KRW: { locale: 'ko-KR', prefix: true, decimals: 0 },
		SGD: { locale: 'en-SG', prefix: true, decimals: 2 },
		THB: { locale: 'th-TH', prefix: true, decimals: 2 }
	};
	const currencyDerived = $derived(props.currency ?? 'VND');
	const currencyConfigDerived = $derived.by(() => {
		return CURRENCY_DEFAULTS[currencyDerived.toUpperCase()] ?? { locale: 'vi-VN', prefix: false, decimals: 0 };
	});
	const currencySymbolDerived = $derived.by(() => {
		if (props.symbol) return props.symbol;
		try {
			const parts = new Intl.NumberFormat(currencyConfigDerived.locale, {
				style: 'currency',
				currency: currencyDerived.toUpperCase(),
				currencyDisplay: 'narrowSymbol'
			}).formatToParts(1);
			return parts.find((part) => part.type === 'currency')?.value ?? currencyDerived.toUpperCase();
		} catch {
			// RangeError: currency code invalid → dùng chính mã làm symbol
			return currencyDerived.toUpperCase();
		}
	});
	const currencySymbolPositionDerived = $derived(props.symbolPosition ?? (currencyConfigDerived.prefix ? 'prefix' : 'suffix'));
	const currencyDecimalsDerived = $derived(props.decimals ?? currencyConfigDerived.decimals);

	const colorDerived = $derived.by(() => {
		// Ưu tiên props.color nếu được set explicitly
		if (props.color) return props.color;

		// Khi đang loading (realtime check) → trả về default (màu trung tính)
		// Check both external loading prop and internal validation loading state
		if (props.loading || configs?.loading) return 'default';

		if (props.validation || requiredDerived || typeDerived == 'email' || typeDerived == 'file') {
			const validation = configs?.validation;
			const isValid = validation?.isValid;
			const process = validation?.process;

			// Chỉ có validation process khi đã blur/trigger
			if (process && process.size > 0) {
				if (isValid == 'pending') return 'default';
				return isValid ? 'success' : 'error';
			}
			// Chưa validate → trung tính
			return 'default';
		}
		return 'default';
	});

	const requiredDerived = $derived(props.required ?? textFieldContext?.required);

	let _disabled: undefined | boolean = $state(undefined);
	// type='file': ref dropzone (div role=button) — focus()/DnD dùng
	let dropzoneEl: HTMLDivElement | undefined;
	// Visual number keyboard cleanup — gán ở showVisualNumberKb(), gọi ở hideVisualNumberKb()
	// (window mousedown/focusout — không cần reactive)
	let visualNumberKbCleaner: (() => void) | undefined;
	// Visual cursor (Fix #5): trạng thái hiển thị + offset trái (px) đo bằng mirror span
	// theo currentCursor — mount khi keyboard số mở, unmount khi đóng.
	let visualCursorVisible = $state(false);
	let visualCursorLeft = $state(0);
	// Fix #3: ref input đang mở keyboard — focusout window capture so contains để hide.
	let visualKbInputRef: HTMLInputElement | undefined;
	const disabledDerived = $derived.by(() => {
		if (disabled) return disabled;
		return _disabled ?? formContext?.disabled;
	});

	const nameDerived = $derived(props.name ?? textFieldContext?.name);

	const clearDisplayDerived = $derived(props.actionButtons?.clear?.display ?? true);
	const copyDisplayDerived = $derived(props.actionButtons?.copy?.display ?? false);
	const pasteDisplayDerived = $derived(props.actionButtons?.paste?.display ?? false);
	const showPasswordDisplayDerived = $derived(props.actionButtons?.showPassword?.display ?? true);

	const highlightDerived = $derived(props.highlight);
	const caseSensitiveDerived = $derived(props.caseSensitive ?? false);

	/** Tính danh sách các đoạn { text, isMatch } để render highlight overlay */
	const highlightSegmentsDerived = $derived.by(() => {
		if (!highlightDerived || !value) return undefined;
		const flag = caseSensitiveDerived ? '' : 'i';
		let regex: RegExp;
		try {
			regex = new RegExp(highlightDerived.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), `g${flag}`);
		} catch {
			return undefined;
		}
		const segments: { text: string; isMatch: boolean }[] = [];
		let lastIndex = 0;
		for (const match of value.matchAll(regex)) {
			if (match.index > lastIndex) {
				segments.push({ text: value.slice(lastIndex, match.index), isMatch: false });
			}
			segments.push({ text: match[0], isMatch: true });
			lastIndex = match.index + match[0].length;
		}
		if (lastIndex < value.length) {
			segments.push({ text: value.slice(lastIndex), isMatch: false });
		}
		return segments;
	});

	// ── Email Auto-complete Suggestions ──
	let emailSuggestionsDismissed = $state(false);
	let emailHighlightedIndex = $state(0);

	const defaultPopularEmailDomains = [
		'gmail.com',
		'outlook.com',
		'icloud.com',
		'atomicmail.com',
		'proton.me',
		'protonmail.com',
		'yahoo.com',
		'hotmail.com'
	];

	const emailSuggestEnabled = $derived(props.emailSuggest ?? (typeDerived === 'email'));
	const emailDomainsDerived = $derived(props.emailDomains ?? defaultPopularEmailDomains);

	const emailPartsDerived = $derived.by(() => {
		if (!emailSuggestEnabled || typeof value !== 'string') {
			return null;
		}
		const firstAt = value.indexOf('@');
		const lastAt = value.lastIndexOf('@');
		// Trigger khi có đúng 1 ký tự '@' VÀ có ít nhất 1 ký tự hợp lệ trước @
		if (firstAt === -1 || firstAt !== lastAt) {
			return null;
		}
		const prefix = value.slice(0, firstAt);
		// Yêu cầu ít nhất 1 ký tự trước @
		if (prefix.length < 1) {
			return null;
		}
		const query = value.slice(firstAt + 1).toLowerCase();
		return { prefix, query };
	});

	const matchingEmailDomains = $derived.by(() => {
		if (!emailPartsDerived) return [];
		const { query } = emailPartsDerived;
		return emailDomainsDerived.filter((domain) => {
			const lower = domain.toLowerCase();
			// Thu gọn danh sách gợi ý theo độ chi tiết người dùng nhập sau @
			// Nếu đã hoàn thành nhập đúng toàn bộ domain thì ẩn gợi ý
			return lower.startsWith(query) && lower !== query;
		});
	});

	// Reset index khi danh sách domain gợi ý thay đổi
	$effect(() => {
		if (emailHighlightedIndex >= matchingEmailDomains.length) {
			emailHighlightedIndex = 0;
		}
	});

	// Mở lại gợi ý khi người dùng thay đổi giá trị (gõ, xoá, backspace)
	let _prevValueForSuggest: string | undefined = undefined;
	$effect(() => {
		if (value !== _prevValueForSuggest) {
			_prevValueForSuggest = value;
			emailSuggestionsDismissed = false;
		}
	});

	// Quản lý trạng thái focus: input đang focus HOẶC chuột đang trên popup
	let isInteractingWithSuggestions = $state(false);
	// Focus-hold cho email popup: mousedown giữ focus để click suggestion không mất popup
	let suggestionsFocusHeld = $state(false);
	// isFocused đọc configs (khai báo cuối file) — $derived bị lazy nên an toàn,
	// nhưng TS chặn "used before its declaration" → chuyển thành function-wrapper
	// để hoist được mà không vi phạm TDZ (gọi tại chỗ dùng, không evaluate sớm).
	function isFocused() {
		return !!(configs?.status?.focus || configs?.input?.status?.focus);
	}

	const emailSuggestionsOpen = $derived(
		emailSuggestEnabled &&
		!emailSuggestionsDismissed &&
		(isFocused() || isInteractingWithSuggestions) &&
		emailPartsDerived !== null &&
		matchingEmailDomains.length > 0
	);

	// ── Phone Auto-complete Suggestions ──
	let phoneSuggestionsDismissed = $state(false);
	let phoneHighlightedIndex = $state(0);

	// Common country codes with popular phone formats
	const defaultPhoneCountryCodes = [
		{ code: '+1', name: 'United States', format: '(XXX) XXX-XXXX', mask: '(###) ###-####', example: '+1 (555) 123-4567' },
		{ code: '+44', name: 'United Kingdom', format: 'XXXX XXXXXXX', mask: '#### #######', example: '+44 7911 123456' },
		{ code: '+84', name: 'Vietnam', format: 'XX XXXX XXXX', mask: '## #### ####', example: '+84 90 123 4567' },
		{ code: '+86', name: 'China', format: 'XXX XXXX XXXX', mask: '### #### ####', example: '+86 138 1234 5678' },
		{ code: '+81', name: 'Japan', format: 'XX XXXX XXXX', mask: '## #### ####', example: '+81 90 1234 5678' },
		{ code: '+82', name: 'South Korea', format: 'XX XXXX XXXX', mask: '## #### ####', example: '+82 10 1234 5678' },
		{ code: '+65', name: 'Singapore', format: 'XXXX XXXX', mask: '#### ####', example: '+65 8123 4567' },
		{ code: '+60', name: 'Malaysia', format: 'XX XXXX XXXX', mask: '## #### ####', example: '+60 12 345 6789' },
		{ code: '+66', name: 'Thailand', format: 'XX XXXX XXXX', mask: '## #### ####', example: '+66 81 234 5678' },
		{ code: '+62', name: 'Indonesia', format: 'XX XXXX XXXX', mask: '## #### ####', example: '+62 812 345 6789' },
		{ code: '+63', name: 'Philippines', format: 'XXX XXX XXXX', mask: '### ### ####', example: '+63 917 123 4567' },
		{ code: '+91', name: 'India', format: 'XXXXX XXXXX', mask: '##### #####', example: '+91 98765 43210' },
		{ code: '+49', name: 'Germany', format: 'XXXX XXXXXXX', mask: '#### #######', example: '+49 170 1234567' },
		{ code: '+33', name: 'France', format: 'XX XX XX XX XX', mask: '## ## ## ## ##', example: '+33 6 12 34 56 78' },
		{ code: '+39', name: 'Italy', format: 'XXX XXXXXXX', mask: '### #######', example: '+39 320 1234567' },
		{ code: '+34', name: 'Spain', format: 'XXX XX XX XX', mask: '### ## ## ##', example: '+34 600 12 34 56' },
		{ code: '+55', name: 'Brazil', format: 'XX XXXXX XXXX', mask: '## ##### ####', example: '+55 11 91234 5678' },
		{ code: '+7', name: 'Russia', format: 'XXX XXX XX XX', mask: '### ### ## ##', example: '+7 916 123 45 67' },
		{ code: '+27', name: 'South Africa', format: 'XX XXX XXXX', mask: '## ### ####', example: '+27 82 123 4567' },
		{ code: '+61', name: 'Australia', format: 'X XXXX XXXX', mask: '# #### ####', example: '+61 412 345 678' },
	];

	const phoneSuggestEnabled = $derived(props.phoneSuggest ?? (typeDerived === 'phone'));
	const phoneCountryCodesDerived = $derived(props.phoneCountryCodes ?? defaultPhoneCountryCodes);

	const phonePartsDerived = $derived.by(() => {
		if (!phoneSuggestEnabled || typeof value !== 'string') {
			return null;
		}
		// For phone, we match based on the starting digits (country code)
		// Remove non-digits for matching
		const digitsOnly = value.replace(/\D/g, '');
		if (!digitsOnly) return null;

		// Check if we have a potential country code prefix
		// Match when user has typed at least 1 digit
		if (digitsOnly.length >= 1) {
			return { digitsOnly, query: digitsOnly };
		}
		return null;
	});

	const matchingPhoneCountries = $derived.by(() => {
		if (!phonePartsDerived) return [];
		const { query, digitsOnly } = phonePartsDerived;
		return phoneCountryCodesDerived.filter((country) => {
			const countryCodeDigits = country.code.replace(/\D/g, '');
			// Match country code prefix
			// Show if query is a prefix of country code AND user hasn't typed more digits than the country code
			return countryCodeDigits.startsWith(query) && digitsOnly.length <= countryCodeDigits.length;
		});
	});

	// Reset index khi danh sách country code gợi ý thay đổi
	$effect(() => {
		if (phoneHighlightedIndex >= matchingPhoneCountries.length) {
			phoneHighlightedIndex = 0;
		}
	});

	// Mở lại gợi ý khi người dùng thay đổi giá trị
	let _prevValueForPhoneSuggest: string | undefined = undefined;
	$effect(() => {
		if (value !== _prevValueForPhoneSuggest) {
			_prevValueForPhoneSuggest = value;
			phoneSuggestionsDismissed = false;
		}
	});

	// Quản lý trạng thái focus cho phone suggestions
	let isInteractingWithPhoneSuggestions = $state(false);
	let phoneSuggestionsFocusHeld = $state(false);

	const phoneSuggestionsOpen = $derived(
		phoneSuggestEnabled &&
		!phoneSuggestionsDismissed &&
		(isFocused() || isInteractingWithPhoneSuggestions) &&
		phonePartsDerived !== null &&
		matchingPhoneCountries.length > 0
	);

	function selectEmailDomain(domain: string) {
		if (!emailPartsDerived) return;
		const newVal = `${emailPartsDerived.prefix}@${domain}`;
		value = newVal;
		_prevValueForSuggest = newVal;
		emailSuggestionsDismissed = true;
		isInteractingWithSuggestions = false;
		const inputRef = configs.input.email?.ref as HTMLInputElement | undefined;
		if (inputRef) {
			requestAnimationFrame(() => {
				inputRef.focus();
				try {
					inputRef.setSelectionRange(newVal.length, newVal.length);
				} catch {}
			});
		}
	}

	function selectPhoneCountry(country: typeof defaultPhoneCountryCodes[0]) {
		if (!phonePartsDerived) return;
		// If user just typed digits, prepend the country code
		const currentValue = value ?? '';
		const digitsOnly = currentValue.replace(/\D/g, '');
		const countryCodeDigits = country.code.replace(/\D/g, '');

		// If the current value already starts with this country code (with +), don't duplicate
		if (digitsOnly.startsWith(countryCodeDigits) && currentValue.startsWith('+')) {
			return;
		}

		// If the current digits are a prefix of the country code (e.g., user typed "8" and selects "+86"),
		// replace the prefix with the full country code
		if (countryCodeDigits.startsWith(digitsOnly)) {
			value = country.code + ' ';
		} else if (digitsOnly === countryCodeDigits && !currentValue.startsWith('+')) {
			// User typed full country code digits but without + (e.g., "84" for +84)
			value = country.code + ' ';
		} else {
			// Otherwise prepend the country code
			value = country.code + (digitsOnly ? ' ' + digitsOnly : '');
		}
		_prevValueForPhoneSuggest = value;
		phoneSuggestionsDismissed = true;
		isInteractingWithPhoneSuggestions = false;

		const type =
			configs.type === 'password' || configs.type === 'email' || configs.type === 'phone'
				? configs.type
				: 'text';
		const inputRef = configs.input[type]?.ref as HTMLInputElement | undefined;
		if (inputRef) {
			requestAnimationFrame(() => {
				inputRef.focus();
				try {
					if (['text', 'search', 'url', 'tel', 'password'].includes(inputRef.type)) {
						inputRef.setSelectionRange((value ?? '').length, (value ?? '').length);
					}
				} catch (e) {
					// Input type email/number không hỗ trợ setSelectionRange theo chuẩn WHATWG
				}
			});
		}
	}

	function handleEmailKeydown(e: KeyboardEvent) {
	if (!emailSuggestEnabled) return;
	if (emailSuggestionsOpen && matchingEmailDomains.length > 0) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			e.stopPropagation();
			emailHighlightedIndex = (emailHighlightedIndex + 1) % matchingEmailDomains.length;
			return;
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			e.stopPropagation();
			emailHighlightedIndex =
				(emailHighlightedIndex - 1 + matchingEmailDomains.length) % matchingEmailDomains.length;
			return;
		}
		if (e.key === 'Enter' || e.key === 'Tab') {
			e.preventDefault();
			e.stopPropagation();
			const chosen = matchingEmailDomains[emailHighlightedIndex] ?? matchingEmailDomains[0];
			if (chosen) {
				selectEmailDomain(chosen);
			}
			return;
		}
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			emailSuggestionsDismissed = true;
			return;
		}
	}
}

function handlePhoneKeydown(e: KeyboardEvent) {
		if (!phoneSuggestEnabled) return;
		if (phoneSuggestionsOpen && matchingPhoneCountries.length > 0) {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				e.stopPropagation();
				phoneHighlightedIndex = (phoneHighlightedIndex + 1) % matchingPhoneCountries.length;
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				e.stopPropagation();
				phoneHighlightedIndex =
					(phoneHighlightedIndex - 1 + matchingPhoneCountries.length) % matchingPhoneCountries.length;
				return;
			}
			if (e.key === 'Enter' || e.key === 'Tab') {
				e.preventDefault();
				e.stopPropagation();
				const chosen = matchingPhoneCountries[phoneHighlightedIndex] ?? matchingPhoneCountries[0];
				if (chosen) {
					selectPhoneCountry(chosen);
				}
				return;
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				phoneSuggestionsDismissed = true;
				return;
			}
		}
	}

	// Helper function to get country flag emoji from country code
	function getCountryFlag(countryCode: string): string {
		const code = countryCode.replace('+', '');
		const countryFlags: Record<string, string> = {
			'1': '🇺🇸', // US/Canada
			'44': '🇬🇧', // UK
			'84': '🇻🇳', // Vietnam
			'86': '🇨🇳', // China
			'81': '🇯🇵', // Japan
			'82': '🇰🇷', // South Korea
			'65': '🇸🇬', // Singapore
			'60': '🇲🇾', // Malaysia
			'66': '🇹🇭', // Thailand
			'62': '🇮🇩', // Indonesia
			'63': '🇵🇭', // Philippines
			'91': '🇮🇳', // India
			'49': '🇩🇪', // Germany
			'33': '🇫🇷', // France
			'39': '🇮🇹', // Italy
			'34': '🇪🇸', // Spain
			'55': '🇧🇷', // Brazil
			'7': '🇷🇺', // Russia
			'27': '🇿🇦', // South Africa
			'61': '🇦🇺', // Australia
		};
		return countryFlags[code] || '🌐';
	}

	// Stable reactive state for password visibility
	let passwordStatus = $state({
		_showing: undefined as undefined | boolean,
		get showing() {
			if (this._showing == undefined) return props.showPassword;
			return this._showing;
		},
		set showing(v) {
			this._showing = v;
		},
		// Khớp BasicConfigs['status'] — status prop của input.password phải có shape này
		hover: undefined as boolean | undefined,
		focus: undefined as boolean | undefined,
		loaded: undefined as boolean | undefined
	});

	let configs: InputConfigs = $state({
		status: {
			get changed() {
				if (configs.type == 'file') {
					// File: "đã đổi" = số lượng tệp khác mốc ban đầu (reset giữ files ban đầu)
					return (files?.length ?? 0) !== _initialFiles.length;
				}
				if (configs.type == 'barcode') {
					// Barcode: "đã đổi" = danh sách mã khác mốc ban đầu (mirror file mode)
					return (codes?.length ?? 0) !== _initialCodes.length ||
						(codes ?? []).some((c, i) => c !== _initialCodes[i]);
				}
				return (_initialValue ?? '') !== (configs.value ?? '');
			}
		},
		get type() { return typeDerived; },
		get size() { return sizeDerived; },
		get rounded() { return roundedDerived; },
		get style() { return styleDerived; },
		get delay() { return delayDerived; },
		get duration() { return durationDerived; },
		get variant() { return variantDerived; },
		get maxLength() { return maxLengthDerived; },
		get maxNumber() { return maxNumberDerived; },
		get minNumber() { return minNumberDerived; },
		get color() { return colorDerived; },
		get required() { return requiredDerived; },
		get _disabled() { return _disabled; },
		set _disabled(v) { _disabled = v; },
		get disabled() { return disabledDerived; },
		set disabled(v) { _disabled = v; },
		get name() { return nameDerived; },
		get highlight() { return highlightDerived; },
		get caseSensitive() { return caseSensitiveDerived; },
		// type='file': giới hạn số tệp / kích thước (bytes) — props là source of truth.
		// getter này chính là điều để cap/filter trong handleFileSelect +
		// default validators (maxFiles/maxFileSize) hoạt động.
		get maxFiles() { return props.maxFiles; },
		get maxSize() { return props.maxSize; },
		// type='barcode': formats chấp nhận (BarcodeDetector) — props là source of truth.
		get formats() { return props.formats; },
		validation: {
			_cachedIsValid: undefined as boolean | 'pending' | undefined,
			get isValid() {
				// Return cached value if set explicitly
				if (this._cachedIsValid !== undefined) return this._cachedIsValid;

				// After programmatic reset, suppress validation until user interacts
				if (_justReset) return true;

				// No validation needed for optional fields without custom validation and not email type
				if (!props.validation && !configs.required && configs.type !== 'email') return true;

				// If validation process exists, use its results
				if (configs.validation.process) {
					const operator = props.validation?.operator ?? 'and';
					const results = [...configs.validation.process.values()];
					if (results.some((rs) => rs == 'pending')) return 'pending';
					return operator == 'and' ? results.every((rs) => rs) : results.some((rs) => rs);
				}

				// No validation process yet (e.g., no blur yet) - for required fields, check value presence
				if (configs.required) {
					if (configs.type === 'file') {
						return (files?.length ?? 0) > 0;
					}
					if (configs.type === 'barcode') {
						return (codes?.length ?? 0) > 0;
					}
					const val = String(configs.value ?? '');
					return val.trim().length > 0;
				}

				// Optional field with no validation process yet - consider valid
				return true;
			},
			set isValid(v: boolean | 'pending' | undefined) {
				this._cachedIsValid = v;
			}
		},
		get event() {
			if (this.disabled) return [];

			const defaultValidators = getDefaultValidators();
			const hasCustomValidation = !!props.validation;
			const hasDefaultValidation = defaultValidators.length > 0;
			if (!hasCustomValidation && !hasDefaultValidation) {
				return [{ events: buildCoreEvents() }, ...(props.events ?? [])] as InputProps['events'];
			}
			if (!hasCustomValidation) {
				return [
					{
						events: {
							async blur() {
								if (textFieldContext) textFieldContext.status.touched = true;
								if (!configs.validation.process) configs.validation.process = new SvelteMap();
								const operator = 'and' as const;
								await processingValidation('blur', defaultValidators, operator);
							}
						}
					},
					{ events: buildCoreEvents() },
					...(props.events ?? [])
				] as InputProps['events'];
			}
			const globalOperator = props.validation?.operator ?? 'and';
			const validationEntries = props.validation
				? Object.entries(props.validation).filter(
						([key]) => key !== 'operator' && !['keyup', 'keydown'].includes(key)
					)
				: [];
			const hasBlurEntry = validationEntries.some(([key]) => key === 'blur');
			if (defaultValidators.length > 0 && !hasBlurEntry) {
				validationEntries.push(['blur', []]); // mảng rỗng — sẽ được merge defaultValidators bên dưới
			}
			const validationEvents =
				validationEntries.length > 0
					? {
							events: Object.fromEntries(
								validationEntries.map(([eventName, data]) => {
									return [
										eventName,
										async () => {
											const evName = eventName as keyof EventListener;
											if (evName === 'blur' && textFieldContext) {
												textFieldContext.status.touched = true;
											}

											if (!configs.validation.process) {
												configs.validation.process = new SvelteMap();
											}

											let dataArr: (ValidationCompact | ValidationFull)[];
											let operator: 'and' | 'or' = globalOperator;

											if (Array.isArray(data)) {
												dataArr = data;
											} else if (typeof data === 'object' && data != null) {
												operator = data.operator ?? globalOperator;
												dataArr = data.handles;
											} else {
												dataArr = [];
											}

											const finalHandles =
												evName === 'blur' && defaultValidators.length > 0
													? [...dataArr, ...defaultValidators]
													: dataArr;

											if (finalHandles.length === 0) return;

											await processingValidation(evName, finalHandles, operator);
										}
									];
								})
							)
						}
					: null;

			return [
				validationEvents,
				{ events: buildCoreEvents() },
				...(props.events ?? [])
			] as InputProps['events'];
		},
		placeholder: {
			get value() {
				if (!props.placeholder) return { vi: '', en: '' };
				if (typeof props.placeholder === 'string')
					return { vi: props.placeholder, en: props.placeholder };
				return props.placeholder;
			},
			get event() {
				if (configs.disabled) return [];
				return [
					{
						events: {
							mousedown() {
								configs.focus();
							}
						}
					}
				];
			}
		},
		input: {
			status: {},
			text: {
				get event() {
					if (configs.disabled) return [];
					return [
						props.validation
							? {
									events: Object.fromEntries(
										Object.entries(props.validation)
											.filter(([eventName, _]) => ['keyup', 'keydown'].includes(eventName))
											.map(([eventName, data]) => {
												return [
													eventName,
													async () => {
														const evName = eventName as keyof EventListener | 'operator';
														if (evName !== 'operator') {
															if (!configs.validation.process)
																configs.validation.process = new SvelteMap();
															if (typeof data == 'object' && Array.isArray(data)) {
																const operator = props.validation?.operator ?? 'and';
																await processingValidation(evName, data, operator);
															} else if (typeof data == 'object') {
																const operator =
																	data.operator ?? props.validation?.operator ?? 'and';
																await processingValidation(evName, data.handles, operator);
															}
														}
													}
												];
											})
									)
								}
							: { events: {} },
						{
							events: {
								load(e, data) {
									if (data?.node instanceof HTMLInputElement) {
										if (!configs.timeId) configs.timeId = new Map();
										const name = 'timeout-get-size-input';
										const timeId = configs.timeId.get(name);
										if (timeId) clearTimeout(timeId);
										configs.timeId.set(
											name,
											setTimeout(() => {
												if (data.node instanceof HTMLInputElement) {
													const rect = data.node.getBoundingClientRect();
													if (data.node.offsetWidth) configs.maskValue.width = rect.width;
													if (data.node.offsetHeight) configs.maskValue.height = rect.height;
												}
											}, configs.duration)
										);
									}
								},
								keydown(e) {
									const event = e as KeyboardEvent;
									if (
										event &&
										configs.maxLength &&
										configs.type == 'text' &&
										value?.length == configs.maxLength &&
										!text_keys_allowed.includes(event.key.toLowerCase())
									) {
										event.preventDefault();
									}
								}
							}
						},
						...(createDefaultInputEvents(
							untrack(() => value),
							configs,
							textFieldContext,
							formContext
						) ?? []),
						// type='barcode': blur ngoài root (click h2/nút khác) — window-level
						// mousedown capture reset status.focus (mirror currency, dòng 1261).
						// KHÔNG có listener này: focus class kẹt 'true' → effect focus/blur
						// (prevFocus) không dispatch 'blur' → validation blur không chạy.
						...(barcodeDisplayDerived
							? ([
									{
										events: {
											mousedown: {
												handler(e) {
													const ev = e as MouseEvent;
													if (
														configs.status.focus &&
														!configs.ref?.contains(ev.target as HTMLElement)
													) {
														configs.status.focus = false;
													}
												},
												options: {
													capture: true
												}
											}
										},
										target: window
									}
								] as NonNullable<InputConfigs['input']['text']['event']>)
							: [])
					] as NonNullable<InputConfigs['input']['text']['event']>;
				},
				get style() {
					const defaultStyles: (string | undefined)[] = ['input-editor'];
					return styleSynced({ defaultStyles });
				}
			},
			password: {
				get showPassword() {
					return passwordStatus.showing;
				},
				status: passwordStatus,
				get style() {
					return configs.input.text.style;
				},
				get event() {
					if (configs.disabled) return [];
					return [
						props.validation
							? {
									events: Object.fromEntries(
										Object.entries(props.validation)
											.filter(([eventName, _]) => ['keyup', 'keydown'].includes(eventName))
											.map(([eventName, data]) => {
												return [
													eventName,
													async () => {
														const evName = eventName as keyof EventListener | 'operator';
														if (evName == 'operator') {
															if (typeof data == 'string') {
															}
														} else {
															if (!configs.validation.process)
																configs.validation.process = new SvelteMap();
															if (typeof data == 'object' && Array.isArray(data)) {
																const operator = props.validation?.operator ?? 'and';
																await processingValidation(evName, data, operator);
															} else if (typeof data == 'object') {
																const operator =
																	data.operator ?? props.validation?.operator ?? 'and';
																await processingValidation(evName, data.handles, operator);
															}
														}
													}
												];
											})
									)
								}
							: { events: {} },
						...(createDefaultInputEvents(
							untrack(() => value),
							configs,
							textFieldContext,
							formContext
						) ?? [])
					] as InputConfigs['input']['password']['event'];
				}
			},
			email: {
				get style() {
					return configs.input.text.style;
				},
				get event() {
					if (configs.disabled) return [];
					return configs.input.text.event;
				}
			},
			phone: {
			get style() {
				return configs.input.text.style;
			},
			get event() {
				if (configs.disabled) return [];
				return configs.input.text.event;
			}
		},
			number: {
				get style() {
					return [...(configs.input.text.style ?? []), 'input-editor-number'];
				},
				get event() {
					if (!browser) return undefined;
					if (configs.disabled) return [];
					const events = [
						props.validation
							? {
									events: Object.fromEntries(
										Object.entries(props.validation)
											.filter(([eventName, _]) => ['keyup', 'keydown'].includes(eventName))
											.map(([eventName, data]) => {
												return [
													eventName,
													async () => {
														const evName = eventName as keyof EventListener | 'operator';
														if (evName == 'operator') {
															if (typeof data == 'string') {
															}
														} else {
															if (!configs.validation.process)
																configs.validation.process = new SvelteMap();
															if (typeof data == 'object' && Array.isArray(data)) {
																const operator = props.validation?.operator ?? 'and';
																await processingValidation(evName, data, operator);
															} else if (typeof data == 'object') {
																const operator =
																	data.operator ?? props.validation?.operator ?? 'and';
																await processingValidation(evName, data.handles, operator);
															}
														}
													}
												];
											})
									)
								}
							: { events: {} },
						{
							events: {
								async load(_, data) {
									if (data?.node instanceof HTMLInputElement && client.browser?.isMobile) {
										if (!value) {
											data.node.style.width = `0px`;
										} else {
											const w = measureTextWidth(value, data.node);
											const baseSize = getComputedStyle(document.body).fontSize;
											data.node.style.width = `${(w + 1) / parseFloat(baseSize)}rem`;
										}
									}
								},
								async keydown(e, data) {
									let event = e as KeyboardEvent;

									if (
										!client.browser?.isMobile &&
										!number_keys_allowed.includes(event.key.toLowerCase())
									) {
										event.preventDefault();
										return;
									}
									if (client.browser?.isMobile) {
										const event = e as CustomEvent<string>;
										event.preventDefault();
										const key = event.detail as NumberKeyAllowed;
										const currentIndex = configs.status.currentCursor;
										if (key == 'ac') {
											value = '';
											configs.status.currentCursor = 0;
										} else if (key == 'del') {
											if (value && configs.status.currentCursor) {
												if (currentIndex == value.length) {
													value = value.slice(0, -1);
													configs.status.currentCursor = value.length ?? 1;
												} else if (currentIndex !== undefined) {
													value =
														value.slice(0, currentIndex - 1) +
														value.slice(currentIndex, value.length);
													configs.status.currentCursor = Math.max(
														0,
														configs.status.currentCursor - 1
													);
												}
											}
										} else if (key == '=' && value) {
											if (!configs.timeId) configs.timeId = new Map();
											const name = 'timeout-calculate';
											const timeId = configs.timeId.get(name);
											if (timeId) {
												clearTimeout(timeId);
											}
											configs.timeId.set(
												name,
												setTimeout(() => {
													if (value) {
														const rs = calculatorString(value);
														if (rs && rs.toString() !== value) {
															value = rs.toString();
														}
													}
												}, configs.delay)
											);

											return;
										} else {
											if (!value) value = '';
											if (currentIndex === undefined) {
												value += key;
												configs.status.currentCursor = 1;
											} else {
												if (currentIndex == value.length) {
													value += key;
												} else {
													value =
														value.slice(0, currentIndex) +
														key +
														value.slice(currentIndex, value.length);
												}
												if (!configs.status.currentCursor) configs.status.currentCursor = 0;
												configs.status.currentCursor += 1;
											}
										}
										if (configs.status.currentCursor != undefined) {
											requestAnimationFrame(() => {
												const inputRef = configs.input.number.ref as HTMLInputElement;
												if (configs.status.currentCursor != undefined)
													if (inputRef)
														inputRef.setSelectionRange(
															configs.status.currentCursor,
															configs.status.currentCursor
														);
											});
										}
										if (configs.input.number.ref && value) {
											const w = measureTextWidth(value, configs.input.number.ref);
											configs.input.number.ref.style.width = `${w + 4}px`;
										}

										return;
									}
								},
								mousedown(e) {
									const ev = e as MouseEvent;
									// Mobile: input readonly + visual keyboard → preventDefault để
									// KHÔNG focus native (caret do visual keyboard quản lý).
									// PC: input text thường → PHẢI cho native focus. Nếu
									// preventDefault ở đây thì click không focus được ô → không
									// gõ được số (bug). caret PC do native xử lý, không cần
									// currentCursor (PC branch của keydown chỉ lọc phím số).
									if (client.browser?.isMobile) ev.preventDefault();
									let index: number | undefined;
									if (!value || !configs.input.number.ref) {
										// cursor 0-BASED (số ký tự trước con trỏ) — chuỗi rỗng → 0.
										// Trước đây là 1: gõ phím đầu chèn tại 1 rồi cursor += 1 = 2 trên
										// chuỗi 1 ký tự → Del tính "không ở cuối chuỗi" → bị nuốt 1 lần.
										index = 0;
									} else {
										index = calculatorCursor(e as MouseEvent, value, configs.input.number.ref);
									}
									configs.status.currentCursor = index ?? value?.length ?? 0;
								}
							}
						},
						...(createDefaultInputEvents(
							untrack(() => value),
							configs,
							textFieldContext,
							formContext
						) ?? []),
						{
							events: {
								mousedown: {
									handler(e) {
										const ev = e as MouseEvent;
										if (
											configs.status.focus &&
											!configs.ref?.contains(ev.target as HTMLElement) &&
											!client.browser?.visualKeyboard?.ref?.contains(ev.target as HTMLElement)
										) {
											hideVisualNumberKb();
										}
									},
									options: {
										capture: true
									}
								}
							},
							target: window
						}
					] as BasicConfigs['event'];
					return events;
				}
			},
			currency: {
				get style() {
					return [...(configs.input.text.style ?? []), 'input-editor-number'];
				},
				get event() {
					if (!browser) return undefined;
					if (configs.disabled) return [];
					const events = [
						props.validation
							? {
									events: Object.fromEntries(
										Object.entries(props.validation)
											.filter(([eventName, _]) => ['keyup', 'keydown'].includes(eventName))
											.map(([eventName, data]) => {
												return [
													eventName,
													async () => {
														const evName = eventName as keyof EventListener | 'operator';
														if (evName == 'operator') {
															if (typeof data == 'string') {
															}
														} else {
															if (!configs.validation.process)
																configs.validation.process = new SvelteMap();
															if (typeof data == 'object' && Array.isArray(data)) {
																const operator = props.validation?.operator ?? 'and';
																await processingValidation(evName, data, operator);
															} else if (typeof data == 'object') {
																const operator =
																	data.operator ?? props.validation?.operator ?? 'and';
																await processingValidation(evName, data.handles, operator);
															}
														}
													}
												];
											})
									)
								}
							: { events: {} },
						{
							events: {
								async load(_, data) {
									if (data?.node instanceof HTMLInputElement && client.browser?.isMobile) {
										if (!value) {
											data.node.style.width = `0px`;
										} else {
											const w = measureTextWidth(value, data.node);
											const baseSize = getComputedStyle(document.body).fontSize;
											data.node.style.width = `${(w + 1) / parseFloat(baseSize)}rem`;
										}
									}
								},
								async keydown(e, data) {
									let event = e as KeyboardEvent;

									if (
										!client.browser?.isMobile &&
										!currency_keys_allowed.includes(event.key.toLowerCase())
									) {
										event.preventDefault();
										return;
									}
									if (client.browser?.isMobile) {
										const event = e as CustomEvent<string>;
										event.preventDefault();
										const key = event.detail as NumberKeyAllowed;
										const currentIndex = configs.status.currentCursor;
										if (key == 'ac') {
											value = '';
											configs.status.currentCursor = 0;
										} else if (key == 'del') {
											if (value && configs.status.currentCursor) {
												if (currentIndex == value.length) {
													value = value.slice(0, -1);
													configs.status.currentCursor = value.length ?? 1;
												} else if (currentIndex !== undefined) {
													value =
														value.slice(0, currentIndex - 1) +
														value.slice(currentIndex, value.length);
													configs.status.currentCursor = Math.max(
														0,
														configs.status.currentCursor - 1
													);
												}
											}
										} else if (key == '=' && value) {
											currencyApplyCalculate();
											return;
										} else {
											if (!value) value = '';
											if (currentIndex === undefined) {
												value += key;
												configs.status.currentCursor = 1;
											} else {
												if (currentIndex == value.length) {
													value += key;
												} else {
													value =
														value.slice(0, currentIndex) +
														key +
														value.slice(currentIndex, value.length);
												}
												if (!configs.status.currentCursor) configs.status.currentCursor = 0;
												configs.status.currentCursor += 1;
											}
										}
										if (configs.status.currentCursor != undefined) {
											requestAnimationFrame(() => {
												const inputRef = configs.input.currency.ref as HTMLInputElement;
												if (configs.status.currentCursor != undefined)
													if (inputRef)
														inputRef.setSelectionRange(
															configs.status.currentCursor,
															configs.status.currentCursor
														);
											});
										}
										if (configs.input.currency.ref && value) {
											const w = measureTextWidth(value, configs.input.currency.ref);
											configs.input.currency.ref.style.width = `${w + 4}px`;
										}

										return;
									}
								},
								mousedown(e) {
									const ev = e as MouseEvent;
									// Mirror number: mobile preventDefault (caret do visual keyboard);
									// PC cho native focus.
									if (client.browser?.isMobile) ev.preventDefault();
									let index: number | undefined;
									if (!value || !configs.input.currency.ref) {
										// cursor 0-BASED — chuỗi rỗng → 0 (mirror number, Del bị nuốt 1 lần).
										index = 0;
									} else {
										index = calculatorCursor(e as MouseEvent, value, configs.input.currency.ref);
									}
									configs.status.currentCursor = index ?? value?.length ?? 0;
								}
							}
						},
						...(createDefaultInputEvents(
							untrack(() => value),
							configs,
							textFieldContext,
							formContext
						) ?? []),
						{
							events: {
								mousedown: {
									handler(e) {
										const ev = e as MouseEvent;
										if (
											configs.status.focus &&
											!configs.ref?.contains(ev.target as HTMLElement) &&
											!client.browser?.visualKeyboard?.ref?.contains(ev.target as HTMLElement)
										) {
											hideVisualNumberKb();
										}
									},
									options: {
										capture: true
									}
								}
							},
							target: window
						}
					] as BasicConfigs['event'];
					return events;
				}
			},
			// type='file': chỉ cần ref (input[type=file] hidden) + style. event/giao diện
			// xử lý bởi render branch riêng (dropzone), không dùng input-editor text.
			file: {
				get style() {
					const defaultStyles: (string | undefined)[] = ['input-file-editor'];
					return styleSynced({ defaultStyles });
				}
			},
			// type='barcode' — events window-level mousedown khai báo động ở text.event
			// (không có style riêng); giữ key đủ để khớp InputConfigs['input'].
			barcode: {}
		},
		maskValue: {
			get style() {
				const defaultStyles: (string | undefined)[] = [
					'input-mask',
					...(configs.input.text?.style ?? [])
				];
				return styleSynced({ defaultStyles });
			},
			get event() {
				if (configs.disabled) return [];
				return [
					{
						events: {
							async load(e?: Event | MouseEvents | TouchEvent | KeyboardEvent, data?: { node?: HTMLElement | Window | Document | Body | VisualViewport }) {
								if (data?.node instanceof HTMLElement) {
									data.node.style.width = `${configs.maskValue.width}px`;
									data.node.style.height = `${configs.maskValue.height}px`;
									data.node.scrollTo({ left: data.node.scrollWidth, behavior: 'smooth' });

									if (value && configs.type == 'number') {
										if (!configs.timeId) configs.timeId = new Map();
										const name = 'timeout-calculate';
										const timeId = configs.timeId.get(name);
										if (timeId) {
											clearTimeout(timeId);
										}
										configs.timeId.set(
											name,
											setTimeout(() => {
												if (value) {
													const rs = calculatorString(value);
													if (rs && rs.toString() !== value) {
														value = rs.toString();
													}
												}
											}, configs.delay)
										);
									}
								}
								return () => {
									requestAnimationFrame(() => {
										const ref = configs.input[configs.type].ref;
										if (ref) {
											ref.focus();
											configs.ref?.classList.add('animation-bounce');
											setTimeout(() => {
												configs.ref?.classList.remove('animation-bounce');
											}, configs.duration);
										}
									});
								};
							}
						}
					}
				];
			}
		},
		actionButtons: {
			clear: {
				get display() { return clearDisplayDerived; },
				event: [
					{
						events: {
							mousedown: {
								handler() {
									if (configs.type == 'password') {
										configs.input.password.value = '';
									}
									value = '';
									configs.status.currentCursor = 0;
									onFocus();
								},
								options: {}
							}
						}
					}
				],
				get ref(): HTMLElement | undefined {
					const component = configs.actionButtons.clear.component as SvelteComponent & {
						configs: ButtonConfigs;
					};
					if (component && component.configs) return component.configs.ref as HTMLElement;
					return undefined;
				}
			},
			copy: {
				get display() { return copyDisplayDerived; },
				status: {},
				event: [
					{
						events: {
							async mousedown() {
								if (!value) return;
								const date = new Date();
								localStorage.setItem('clipboard', JSON.stringify({ [`${date.getTime()}`]: value }));
								if (!client.browser) client.browser = {};
								if (!client.browser?.clipboard) client.browser.clipboard = new Map();
								client.browser.clipboard.set(date.getTime(), value);
								configs.actionButtons.copy.status.copied = true;
								if (!configs.timeId) configs.timeId = new Map();
								const name = 'timeout-copy';
								const timeId = configs.timeId.get(name);
								if (timeId) clearTimeout(timeId);
								configs.timeId.set(
									name,
									setTimeout(() => {
										configs.actionButtons.copy.status.copied = false;
									}, configs.duration)
								);
								return () => {
									if (configs.timeId) {
										const timeId = configs.timeId.get(name);
										if (timeId) clearTimeout(timeId);
									}
								};
							}
						}
					}
				]
			},
			paste: {
				get display() { return pasteDisplayDerived; },
				status: {},
				event: [
					{
						events: {
							async load() {},
							async mousedown() {
								if (!client.browser?.clipboard) return;
								const lastTime = [...client.browser.clipboard.keys()].sort(
									(timeA, timeB) => timeB - timeA
								)[0];
								if (!lastTime) return;
								const clipboard = client.browser.clipboard.get(lastTime);
								if (!clipboard) return;
								value = clipboard.slice(0, configs.maxLength ? configs.maxLength : -1);
								if (configs.type == 'password') configs.input.password.value = value;
								configs.actionButtons.paste.status.pasted = true;
								if (!configs.timeId) configs.timeId = new Map();
								const name = 'timeout-paste';
								const timeId = configs.timeId.get(name);
								if (timeId) clearTimeout(timeId);
								configs.timeId.set(
									name,
									setTimeout(() => {
										configs.actionButtons.paste.status.pasted = false;
									}, configs.duration)
								);
								return () => {
									if (configs.timeId) {
										const timeId = configs.timeId.get(name);
										if (timeId) clearTimeout(timeId);
									}
								};
							}
						}
					}
				]
			},
			showPassword: {
				get display() { return showPasswordDisplayDerived; },
				status: passwordStatus,
				event: [
					{
						events: {
							mousedown(e) {
								// Prevent focus loss on mousedown
								(e as Event | undefined)?.preventDefault?.();
							},
							click() {
								const newShowing = !passwordStatus.showing;
								passwordStatus.showing = newShowing;
								if (newShowing) {
									configs.input.password.value = value;
								}
								requestAnimationFrame(() => {
									if (configs.input.password.ref) {
										(configs.input.password.ref as HTMLInputElement).setSelectionRange(
											configs.status.currentCursor ?? 1,
											configs.status.currentCursor ?? 1
										);
									}
								});
							}
						}
					}
				]
			}
		},
		leading: {
			get style() {
				const defaultStyles: (string | undefined)[] = ['input-leading input-snippet'];
				return styleSynced({ defaultStyles });
			}
		},
		trailing: {
			get style() {
				const defaultStyles: (string | undefined)[] = ['input-trailing input-snippet'];
				return styleSynced({ defaultStyles });
			}
		},
		focus() {
			// Clear just-reset flag when user focuses the field
			_justReset = false;
			// type='file' → focus dropzone (không có text input để focus)
			if (configs.type === 'file') {
				if (dropzoneEl && document.activeElement !== dropzoneEl) dropzoneEl.focus();
				configs.status.focus = true;
				return;
			}
			if (client.browser?.isMobile && !client.browser?.visualKeyboard) {
				// Mobile: focus visual input (kb ảo) — TRỪ khi kb visual number đã đo
				// meta (visualKeyboard set): kb hệ thống KHÔNG được mở đè lên kb visual.
				if (!client.browser.visualInput) client.createInputVisual();
				if (client.browser.visualInput) {
					client.browser.visualInput.focus();
				}
			}
			configs.status.focus = true;
			requestAnimationFrame(() => {
				const type = configs.type === 'password' || configs.type === 'email' || configs.type === 'phone' ? configs.type : 'text';
				const ref = configs.input[type]?.ref as HTMLInputElement | undefined;
				if (ref && typeof ref.focus === 'function' && document.activeElement !== ref) {
					ref.focus();
				}
			});
		},
		reset() {
			// Khôi phục về đúng giá trị ban đầu (khi mount), không xóa trắng
			value = _initialValue;
			if (configs.type == 'password') configs.input.password.value = _initialValue;
			if (configs.type == 'file') {
				// GẮN ARRAY MỚI (kỷ luật $bindable) — không mutation tại chỗ
				files = _initialFiles.slice();
				_filesJustReset = true; // bỏ qua 1 lần trigger validation của files effect
			}
			if (configs.type == 'barcode') {
				// Mirror file mode: gán array mới + bỏ qua 1 lần trigger validation
				codes = _initialCodes.slice();
				_codesJustReset = true;
				editingCodeIndex = -1;
				editingCodeValue = '';
				selectedCodes = [];
			}
			configs.validation.process = undefined;
			configs.validation.messages = undefined;
			configs.validation.isValid = undefined; // Clear cached validation
			_justReset = true; // Suppress validation until user interacts
			//    R54T
		}
	});

	function onFocus() {
		// if (!configs.status.focus) configs.status.focus = true;
		requestAnimationFrame(() => {
			configs.input.text?.ref?.focus();
		});
	}
	let resolver: () => void;
	async function processingValidation(
		eventName: keyof EventListener,
		handles: (ValidationCompact | ValidationFull)[],
		operator: 'and' | 'or'
	) {
		if (!props.validation && !configs.required && configs.type !== 'email' && configs.type !== 'file' && configs.type !== 'barcode') return;
		if (!configs.validation.messages) configs.validation.messages = new SvelteMap();
		if (!configs.timeId) configs.timeId = new Map();
		const name = `timeout-validation-${eventName}`;
		const timeId = configs.timeId.get(name);
		if (timeId) clearTimeout(timeId);
		if (resolver) {
			resolver();
		}

		return new Promise<void>((resolve) => {
			resolver = resolve;
			if (!configs.timeId) configs.timeId = new Map();
			configs.timeId.set(
				name,
				setTimeout(async () => {
					// Pending + loading chỉ bật khi validation thực sự chạy (trong timer),
					// không bật đồng bộ ngay khi nhận event: nếu không, blur xảy ra giữa
					// pointerdown→pointerup của cú click nhanh sẽ disable nút submit
					// (Form quét childrens) và nuốt click.
					if (!configs.validation.process) configs.validation.process = new SvelteMap();
					configs.validation.process.set(eventName, 'pending');
					configs.loading = true;
					if (configs.ref) {
						configs.ref.classList.add('validation-loading');
					}
					const promises = await Promise.all(
						handles.map(async (validateHandler) => {
							if (!configs.validation.messages) configs.validation.messages = new SvelteMap();
							let result;
							let isValid;
							// type='file' → validators nhận File[]; barcode → codes[]; các type
							// khác nhận string value
							const input =
								configs.type === 'file'
									? untrack(() => files ?? [])
									: configs.type === 'barcode'
										? untrack(() => codes ?? [])
										: untrack(() => value);
							if (typeof validateHandler == 'function') {
								isValid = validateHandler;
								result = await isValid(input);
							} else {
								isValid = validateHandler.isValid;
								result = await isValid(input);
								const content = result
									? validateHandler.message?.valid
									: validateHandler.message?.invalid;
								const kind = result ? 'valid' : 'invalid';
								configs.validation.messages.set(isValid, { content, kind });
							}
							return result;
						})
					);
					configs.validation.process.set(
						eventName,
						operator == 'and'
							? promises.every((isValid) => isValid)
							: promises.some((isValid) => isValid)
					);
						const overallValid = operator == 'and' ? promises.every((isValid) => isValid) : promises.some((isValid) => isValid);
						configs.validation.isValid = overallValid;
					if (configs.ref && configs.validation._cachedIsValid !== 'pending') {
						configs.ref.classList.remove('validation-loading');
					}
					configs.loading = false;
					resolve();
				}, configs.delay)
			);
		});
	}
	function calculatorCursor(event: MouseEvent, value: string, inputElement: HTMLElement) {
		let index: number | undefined = undefined;
		const mirroEl = document.createElement('span');
		mirroEl.classList.add('input-mirror');
		if (!configs.maskValue.positionCharacters) configs.maskValue.positionCharacters = new Map();
		// appendChild: @types/node override Body.append đè ParentNode.append
		document.body.appendChild(mirroEl);
		for (let i = 0; i <= value.length; i++) {
			mirroEl.textContent = value.slice(0, i);
			if (
				mirroEl.offsetWidth >=
				event.clientX - (inputElement.getBoundingClientRect().left ?? 0) + inputElement.scrollLeft
			) {
				index = i;
				break;
			}
		}
		mirroEl.remove();
		return index;
	}
	function showVisualNumberKb() {
		// Kb hệ thống KHÔNG được mở đè kb visual: blur visual input (mỏ giữ
		// kb hệ thống) ngay từ đầu hàm.
		client.browser?.visualInput?.blur();
		const target = {
			get value() {
				return value;
			},
			set value(v: string | undefined) {
				value = v; // gán thẳng vào biến $bindable(), Svelte tự lo phần reactivity
			},
			// type='currency' → ref nằm ở configs.input.currency.ref (không phải number)
			ref:
				(configs.input.currency.ref as HTMLInputElement | undefined) ??
				(configs.input.number.ref as HTMLInputElement),
			maxLength: configs.maxLength
		};
		visualKbInputRef = target.ref;
		configs.status.focus = true; // Fix #3: focus status phải true → hide-handler gate hoạt động
		visualCursorVisible = true; // Fix #5: hiện visual cursor khi keyboard mở
		visualNumberKbCleaner = ensureKeyboardHost(target);
	}
	/** Fix #3: đóng visual keyboard + dọn mọi trạng thái kèm theo (focus/cursor).
	 *  Điểm gọi duy nhất cho mọi đường hide — window mousedown, focusout (Tab/
	 *  blur programmatic), unmount. Idempotent (cleaner tự no-op lần 2). */
	function hideVisualNumberKb() {
		if (visualNumberKbCleaner) visualNumberKbCleaner();
		visualNumberKbCleaner = undefined;
		visualKbInputRef = undefined;
		visualCursorVisible = false;
		// Blur visual input (nếu còn giữ focus) — chặn kb hệ thống nhảy lên khi
		// kb visual vừa đóng.
		client.browser?.visualInput?.blur();
		configs.status.focus = false;
	}
	// Fix #5: đo vị trí caret — mirror span (measureTextWidth) với prefix
	// value.slice(0, currentCursor), cộng thêm scrollLeft của input (value dài
	// hơn khung → input cuộn ngang, caret phải trừ theo scroll hiện tại).
	// Chạy lại khi value HOẶC currentCursor đổi trong lúc keyboard mở.
	$effect(() => {
		if (!visualCursorVisible) return;
		const ref = visualKbInputRef;
		if (!ref) return;
		const cursor = configs.status.currentCursor ?? value?.length ?? 0;
		const text = (value ?? '').slice(0, cursor);
		const textWidth = text ? measureTextWidth(text, ref) : 0;
		// type='currency' symbol prefix đứng TRƯỚC input → caret lệch phải thêm
		// bề rộng symbol (span flex-shrink 0). Suffix không ảnh hưởng (đứng sau).
		const symbolW =
			configs.type === 'currency' && currencySymbolPositionDerived == 'prefix'
				? (ref.previousElementSibling as HTMLElement | null)?.offsetWidth ?? 0
				: 0;
		// editor padding-inline = 0 (input-editor-number) → offset = symbol + text;
		// min clientWidth giữ caret trong khung khi ở cuối chuỗi dài.
		visualCursorLeft = Math.min(symbolW + textWidth - ref.scrollLeft, ref.clientWidth);
	});
	// Fix #3: focusout capture trên window — bắt blur không qua mousedown (Tab,
	// blur() programmatic). focusout bubble (khác blur) → window nhận được; so
	// relatedTarget: rời input VÀ không vào keyboard → hide. Keyboard phím
	// preventDefault mousedown nên click phím không tạo focusout về input.
	$effect(() => {
		if (typeof window === 'undefined') return;
		const onFocusout = (e: FocusEvent) => {
			if (!visualNumberKbCleaner || !visualKbInputRef) return;
			const to = e.relatedTarget as Node | null;
			const kbRef = client.browser?.visualKeyboard?.ref;
			const intoKb = to instanceof Node && kbRef?.contains(to);
			const intoInput = to instanceof Node && visualKbInputRef.contains(to);
			if (!intoInput && !intoKb) hideVisualNumberKb();
		};
		window.addEventListener('focusout', onFocusout, { capture: true });
		return () => window.removeEventListener('focusout', onFocusout, { capture: true });
	});
	function calculatorString(input: string): number | undefined {
		let calculated: number;
		try {
			calculated = Function(
				`'use strict'; return (${input?.toString().replaceAll('x', '*').replaceAll(':', '/')})`
			)();
			configs.previousValue = calculated.toString();
			return calculated;
		} catch (e) {
			return configs.previousValue ? parseFloat(configs.previousValue) : undefined;
		}
	}

	/**
	 * Resolve token số currency ("1.234.567", "1234,56", "1234") → number.
	 * Heuristic: DÙNG cùng locale currencyConfigDerived — dấu phân cách nhóm nghìn
	 * của locale (vi-VN '.', en-US ',') bị bỏ; dấu thập phân của locale (vi-VN ',',
	 * en-US '.') được giữ. Parse thủ công digits trước/sau dấu thập phân — KHÔNG
	 * parseFloat toàn token (vi-VN "1.234" parseFloat → 1.234, sai — phải là 1234).
	 */
	function resolveCurrencyNumberToken(token: string): number | undefined {
		const groupSep = currencyConfigDerived.locale === 'vi-VN' ? '.' : ',';
		const decSep = currencyConfigDerived.locale === 'vi-VN' ? ',' : '.';
		let cleaned = token.replaceAll(groupSep, '');
		const decIndex = cleaned.indexOf(decSep);
		let intPart = cleaned;
		let fracPart = '';
		if (decIndex !== -1) {
			intPart = cleaned.slice(0, decIndex);
			fracPart = cleaned.slice(decIndex + 1);
		}
		const intDigits = intPart.replace(/\D/g, '');
		const fracDigits = fracPart.replace(/\D/g, '');
		if (!intDigits && !fracDigits) return undefined;
		const intNum = intDigits ? parseInt(intDigits, 10) : 0;
		const num = fracDigits ? parseFloat(`${intNum}.${fracDigits}`) : intNum;
		return Number.isFinite(num) ? num : undefined;
	}

	// ── type='currency': safe expression parser (recursive descent, KHÔNG eval) ──
	// Grammar: expr := term (('+'|'-') term)* ; term := factor (('x'|'*'|':'|'/'|'%') factor)*
	// factor := number | '(' expr ')' | ('+'|'-') factor. 'x'→'*', ':'→'/' (mirror
	// keyboard số). Trả undefined khi biểu thức không hợp lệ (chữ cái lạ, thừa
	// toán tử, thiếu ngoặc đóng, chia 0 không xử lý riêng — JS cho Infinity).
	function parseCurrencyExpression(input: string): number | undefined {
		const src = input.toString().replaceAll('x', '*').replaceAll(':', '/');
		let pos = 0;
		const peek = () => src[pos];
		function parseExpr(): number | undefined {
			let left = parseTerm();
			if (left === undefined) return undefined;
			while (peek() === '+' || peek() === '-') {
				const op = src[pos++];
				const right = parseTerm();
				if (right === undefined) return undefined;
				left = op === '+' ? left + right : left - right;
			}
			return left;
		}
		function parseTerm(): number | undefined {
			let left = parseFactor();
			if (left === undefined) return undefined;
			while (peek() === '*' || peek() === '/' || peek() === '%') {
				const op = src[pos++];
				const right = parseFactor();
				if (right === undefined) return undefined;
				left = op === '*' ? left * right : op === '/' ? left / right : left % right;
			}
			return left;
		}
		function parseFactor(): number | undefined {
			const ch = peek();
			if (ch === '+') {
				pos++;
				return parseFactor();
			}
			if (ch === '-') {
				pos++;
				const v = parseFactor();
				return v === undefined ? undefined : -v;
			}
			if (ch === '(') {
				pos++;
				const v = parseExpr();
				if (v === undefined || peek() !== ')') return undefined;
				pos++; // consume ')'
				return v;
			}
			// number: token gồm digits + dấu '.' / ',' (nhóm nghìn từ autoFormat hoặc
			// thập phân user gõ) — resolve qua heuristic nhóm trước, parseFloat sau.
			const start = pos;
			while (pos < src.length && /[0-9.,]/.test(src[pos])) pos++;
			if (pos === start || src[start] === '.') return undefined; // không có digit
			const num = resolveCurrencyNumberToken(src.slice(start, pos));
			return num;
		}
		const result = parseExpr();
		// Còn ký tự chưa consume → biểu thức thừa (vd "1+2)")
		if (result === undefined || pos !== src.length) return undefined;
		return result;
	}
	/** Format number → chuỗi currency theo locale/decimals (Intl.NumberFormat). */
	function formatCurrency(num: number): string {
		try {
			return new Intl.NumberFormat(currencyConfigDerived.locale, {
				style: 'decimal',
				minimumFractionDigits: currencyDecimalsDerived,
				maximumFractionDigits: currencyDecimalsDerived
			}).format(num);
		} catch {
			return num.toString();
		}
	}

	/**
	 * autoCalculate: parse biểu thức hiện tại (an toàn, KHÔNG eval) → gán lại
	 * value = kết quả số (raw string). Gọi khi nhấn '=' (PC Enter/mobile phím =)
	 * hoặc blur có toán tử. Kết quả không parse được → giữ nguyên value.
	 */
	function currencyApplyCalculate() {
		if (!value) return;
		const rs = parseCurrencyExpression(value);
		if (rs !== undefined) {
			const next = String(rs);
			if (next !== value) value = next;
		}
	}

	/**
	 * autoFormat LIVE khi nhập (type='currency', PC): chèn nhóm nghìn theo locale
	 * (không đụng phần thập phân đang gõ). Token số đã format ("1.234" vi-VN) phải
	 * strip group-sep locale TRƯỚC khi group lại — nếu không, chấm nhóm bị coi là
	 * thập phân → double-group ("1.000" + "000" → "1.000.000" khi gõ tiếp).
	 */
	function currencyFormatLive(): string | undefined {
		if (!value) return undefined;
		const groupSep = currencyConfigDerived.locale === 'vi-VN' ? '.' : ',';
		const decSep = currencyConfigDerived.locale === 'vi-VN' ? ',' : '.';
		const groupNumber = (digitsOnly: string): string | undefined => {
			if (!digitsOnly) return undefined;
			try {
				return new Intl.NumberFormat(currencyConfigDerived.locale, {
					style: 'decimal',
					useGrouping: true,
					maximumFractionDigits: 0
				}).format(parseFloat(digitsOnly));
			} catch {
				return undefined;
			}
		};
		// Format 1 token số: strip group-sep → tách thập phân (decSep hoặc '.' raw
		// đang gõ) → group phần nguyên, giữ nguyên phần sau.
		const formatToken = (part: string): string => {
			const stripped = part.replaceAll(groupSep, '');
			// Phần thập phân: dấu decSep locale (',' vi-VN) HOẶC '.' đang gõ trực tiếp
			const decIndex = Math.max(stripped.indexOf(decSep), stripped.indexOf('.'));
			if (decIndex === -1) return groupNumber(stripped.replace(/\D/g, '')) ?? part;
			const intPart = stripped.slice(0, decIndex).replace(/\D/g, '');
			const fracPart = stripped.slice(decIndex + 1);
			const grouped = groupNumber(intPart);
			if (!grouped) return part;
			return fracPart ? `${grouped}.${fracPart}` : grouped;
		};
		// Có toán tử biểu thức → format từng token số trong biểu thức
		if (/[+\-*/%()x:]/.test(value)) {
			const parts = value.split(/([+\-*/%()x:])/);
			return parts
				.map((part) => {
					if (/[+\-*/%()x:]/.test(part) || !part) return part;
					return formatToken(part);
				})
				.join('');
		}
		// Số thuần
		return formatToken(value);
	}

	function buildCoreEvents() {
		return {
			async load() {
				if (client.browser?.isMobile && !client.browser.visualInput) {
					client.createInputVisual();
				}
				let clipboardRaw: string | undefined | null;
				clipboardRaw = localStorage.getItem('clipboard');
				if (!clipboardRaw) return;
				if (!client.browser) client.browser = {};
				if (!client.browser.clipboard) client.browser.clipboard = new Map();
				try {
					const [time, content] = (
						Object.entries(JSON.parse(clipboardRaw)) as [string, string][]
					)[0];
					client.browser.clipboard.set(parseFloat(time), content);
				} catch (e) {
					console.log(e);
				}
			},
			mousedown: {
				async handler(e: MouseEvent) {
					// type='file': dropzone tự xử lý tương tác (click/Enter/Space → dialog) —
					// không dùng text-input mousedown (select-all/focus text ref).
					if (configs.type === 'file') return;
					configs.status.mousePos = { clientX: e.clientX, clientY: e.clientY };

					const target = e.target as HTMLElement;
					const type = configs.type as 'text' | 'email' | 'password' | 'number' | 'phone';
					const ref = configs.input[type]?.ref as HTMLElement | undefined;

					if (target !== ref) {
						e.preventDefault();
					}

					if (e.detail == 1) {
						if (
							(configs.type === 'number' || configs.type === 'currency') &&
							client.browser?.isMobile &&
							!client.browser?.visualKeyboard
						) {
							if (!client.browser?.visualInput) client.createInputVisual();
							await client.getVisualKeyboardMeta();
							requestAnimationFrame(() => showVisualNumberKb());
						} else {
							if (configs.status.focus) {
								if (target !== ref) {
									const name = 'animation-bounce';
									if (!configs.timeId) configs.timeId = new Map();
									const timeId = configs.timeId.get(name);
									if (timeId) clearTimeout(timeId);
									configs.timeId.set(
										name,
										setTimeout(() => {
											configs.ref?.classList.add('animation-bounce');
											setTimeout(
												() => configs.ref?.classList.remove('animation-bounce'),
												configs.duration
											);
										}, configs.delay)
									);
								}
							} else {
								configs.focus();
								if (
									(configs.type === 'number' || configs.type === 'currency') &&
									client.browser?.isMobile
								) {
									requestAnimationFrame(() => showVisualNumberKb());
								}
							}
						}
					} else {
						configs.status.selectAll = true;
					}
				},
				options: { stopPropagation: true }
			},
			keydown: {
				handler(e: KeyboardEvent) {
					const type = configs.type as 'text' | 'email' | 'password' | 'number' | 'phone';
					const ref = configs.input[type]?.ref as HTMLElement | undefined;
					// Allow Enter/Space to focus the input when root div is focused
					if ((e.key === 'Enter' || e.key === ' ') && ref && !configs.status.focus) {
						e.preventDefault();
						configs.focus();
					}
				}
			}
		};
	}
	function getDefaultValidators(): (ValidationCompact | ValidationFull)[] {
		const validators: (ValidationCompact | ValidationFull)[] = [];
		if (configs.required) {
			validators.push(defaultValidation.required(configs.name));
		}
		if (configs.type === 'number') {
			if (configs.minNumber != null && defaultValidation.minNumber) {
				validators.push(defaultValidation.minNumber(configs.minNumber, configs.name));
			}
			if (configs.maxNumber != null && defaultValidation.maxNumber) {
				validators.push(defaultValidation.maxNumber(configs.maxNumber, configs.name));
			}
		} else if (configs.type === 'currency') {
			// Currency: chỉ chặn nội dung không parse được; minNumber/maxNumber
			// dùng chung validators number (parseFloat trên chuỗi raw).
			if (defaultValidation.isCurrency) {
				validators.push(defaultValidation.isCurrency(configs.name));
			}
			if (configs.minNumber != null && defaultValidation.minNumber) {
				validators.push(defaultValidation.minNumber(configs.minNumber, configs.name));
			}
			if (configs.maxNumber != null && defaultValidation.maxNumber) {
				validators.push(defaultValidation.maxNumber(configs.maxNumber, configs.name));
			}
		} else if (configs.type === 'email' && defaultValidation.isEmail) {
			validators.push(defaultValidation.isEmail(configs.name));
		} else if (configs.type === 'phone' && defaultValidation.isPhone) {
			validators.push(defaultValidation.isPhone(configs.name));
		} else if (configs.type === 'file') {
			// File: required → hasFile (≥1 tệp). maxFiles/maxSize chỉ khi có prop.
			// Non-required + không có max* → mảng rỗng (không validate, giống text bare).
			if (configs.required) {
				validators.push(defaultValidation.hasFile?.(configs.name) ?? defaultValidation.required(configs.name));
			}
			if (configs.maxFiles != null && defaultValidation.maxFiles) {
				validators.push(defaultValidation.maxFiles(configs.maxFiles, configs.name));
			}
			if (configs.maxSize != null && defaultValidation.maxFileSize) {
				validators.push(defaultValidation.maxFileSize(configs.maxSize, configs.name));
			}
		} else if (configs.type === 'barcode') {
			// Barcode: required → hasBarcode (≥1 mã, mirror hasFile). Non-required +
			// không có validation → mảng rỗng (không validate, giống text bare).
			if (configs.required) {
				validators.push(defaultValidation.hasBarcode?.(configs.name) ?? defaultValidation.required(configs.name));
			}
		}
		return validators;
	}
	let prevFocus: boolean | undefined;
	$effect(() => {
		if (!configs.ref) return;
		const focus = configs.status.focus;
		if (focus !== undefined && focus !== prevFocus) {
			// type='file' → KHÔNG dispatch focus/blur: validation file chạy theo
			// `change` (files effect). Blur synthetic khi mở file dialog (focus rời
			// root) sẽ validate với files cũ (race) và nạp message không đúng nhịp.
			if (configs.type !== 'file') {
				configs.ref.dispatchEvent(new Event(focus ? 'focus' : 'blur'));
			}
		}
		prevFocus = focus;
		if ((!focus || value?.length) && configs.status.selectAll) {
			// configs.status.selectAll = false;
		}
	});
	$effect(() => {
		if (!configs.ref || configs.status.reseting) return;
		const previousValue = value;
		if (value) {
			configs.ref.dispatchEvent(new Event('input'));
			configs.ref.dispatchEvent(new Event('keypress'));
		}
		if (value != configs.previousValue && !configs.status.focus) {
			configs.ref.dispatchEvent(new Event('change'));
		}
		return () => {
			if (!configs.status.focus) configs.previousValue = previousValue;
		};
	});
	$effect(() => {
		if (textFieldContext) {
			if (textFieldContext.setValue && textFieldContext.value != value)
				textFieldContext.setValue(value);
			if (textFieldContext.validation?.setValid)
				textFieldContext.validation.setValid(configs.validation.isValid);
			textFieldContext.status.focus = configs.status.focus ?? configs.input.status.focus;
			textFieldContext.loading = configs.loading;
		}
		// Sync configs.value with bound value prop for validation getter.
		// SKIP khi type='file': configs KHÔNG được phép có key `value` — Form serialize
		// check `'value' in children` (form/Main.svelte) và sẽ bỏ qua field nếu thiếu.
		// File upload do page làm qua FormData + bind:files. Barcode mirror (codes).
		if (configs.type !== 'file' && configs.type !== 'barcode' && configs.value !== value) {
			configs.value = value;
		}
	});
	$effect(() => {
		if (
			configs.input.status.focus &&
			(textFieldContext?.status.selectAll || configs.status.selectAll) &&
			value?.length
		) {
			try {
				const el = configs.input[configs.type]?.ref as HTMLInputElement | undefined;
				if (el && ['text', 'search', 'url', 'tel', 'password'].includes(el.type)) {
					el.setSelectionRange(0, value.length);
				} else if (el) {
					el.select();
				}
			} catch (e) {
				// Ignore for unsupported types like email/number
			}
			if (textFieldContext?.status.selectAll) textFieldContext.status.selectAll = false;
			if (configs.status.selectAll) configs.status.selectAll = false;
		}
	});

	$effect(() => {
		if (configs.type == 'number' && !configs.status.focus && value) {
			if (!configs.timeId) configs.timeId = new Map();
			const name = 'timeout-calculate';
			const timeId = configs.timeId.get(name);
			if (timeId) clearTimeout(timeId);
			configs.timeId.set(
				name,
				setTimeout(() => {
					if (value) {
						const rs = calculatorString(value);
						if (rs && rs.toString() !== value) {
							value = rs.toString();
						}
					}
				}, configs.delay)
			);
		}
	});

	// ── type='currency': autoFormat LIVE khi nhập (nhóm nghìn theo locale, giữ caret) ──
	// Chỉ chạy khi đang focus (blur có effect riêng ép decimals đầy đủ). Mapping caret
	// theo digits: đếm digits trước cursor cũ → tìm vị trí tương ứng trong chuỗi mới
	// (nhóm nghìn chèn ký tự phân cách, digits giữ nguyên thứ tự → caret không nhảy).
	$effect(() => {
		if (configs.type !== 'currency') return;
		const current = value;
		// PC: format live khi đang focus (blur có effect riêng). Mobile: LUÔN format
		// live — status.focus không được set trong flow CustomEvent keyboard (readonly
		// input, preventDefault mousedown), value chỉ đổi qua phím visual keyboard.
		if (!current || (!client.browser?.isMobile && !configs.status.focus)) return;
		const inputRef = configs.input.currency.ref as HTMLInputElement | undefined;
		// oldCursor: PC gõ phím → native caret đúng nằm trên DOM (selectionStart);
		// mobile caret do visual keyboard quản lý (currentCursor). Fallback cuối chuỗi.
		const oldCursor =
			(inputRef && configs.status.focus ? inputRef.selectionStart : undefined) ??
			configs.status.currentCursor ??
			current.length;
		const formatted = currencyFormatLive();
		if (!formatted || formatted === current) return;
		// Đếm digits trước cursor cũ trong chuỗi raw → vị trí tương ứng trong chuỗi formatted
		const digitsBefore = current.slice(0, oldCursor).replace(/\D/g, '').length;
		let seen = 0;
		let newCursor = formatted.length;
		for (let i = 0; i < formatted.length; i++) {
			if (formatted[i] >= '0' && formatted[i] <= '9') {
				seen++;
				if (seen === digitsBefore) {
					newCursor = i + 1;
					break;
				}
			}
		}
		value = formatted;
		configs.status.currentCursor = newCursor;
		// rAF: bind:value cập nhật DOM sau effect — setSelectionRange ngay sẽ bị
		// DOM render đè (caret về cuối chuỗi).
		requestAnimationFrame(() => {
			if (inputRef && configs.status.currentCursor != undefined) {
				inputRef.setSelectionRange(configs.status.currentCursor, configs.status.currentCursor);
			}
		});
	});

	// ── type='currency': autoCalculate + ép format đầy đủ khi blur (không focus) ──
	// Có toán tử → parse (recursive descent, KHÔNG eval) → gán kết quả số raw.
	// Không có toán tử → reformat decimals đầy đủ theo currency (vd 1234 →
	// "1,234.00" USD 2 decimals, "1.234" VND 0 decimals). value rỗng → bỏ qua
	// (không hiện "0" giả). STRIP group-sep locale TRƯỚC khi parse — nếu không,
	// "1,234.00" USD → digits "123400" (nhân 100 mỗi lần blur → "∞").
	$effect(() => {
		if (configs.type !== 'currency') return;
		const current = value;
		// CHỈ chạy khi focus là false TƯỜNG MINH (PC blur thật / click ngoài khi
		// focus đang true). Mobile flow: keydown CustomEvent không set status.focus
		// (undefined) — nếu coi undefined là "đã blur", effect parse rút gọn biểu
		// thức giữa chừng khi gõ ("1.000+5" → "1005" → "1.005", mất '+' và digit).
		if (!current || configs.status.focus !== false) return;
		const groupSep = currencyConfigDerived.locale === 'vi-VN' ? '.' : ',';
		const decSep = currencyConfigDerived.locale === 'vi-VN' ? ',' : '.';
		if (/[+\-*/%()x:]/.test(current)) {
			const rs = parseCurrencyExpression(current);
			if (rs !== undefined && String(rs) !== current) {
				value = String(rs);
			}
			return;
		}
		const stripped = current.replaceAll(groupSep, '');
		const decIndex = stripped.indexOf(decSep);
		const intPart = decIndex === -1 ? stripped : stripped.slice(0, decIndex);
		const fracPart = decIndex === -1 ? '' : stripped.slice(decIndex + 1);
		const digits = intPart.replace(/\D/g, '');
		const fracDigits = fracPart.replace(/\D/g, '');
		if (!digits && !fracDigits) return;
		// Parse thủ công (mirror resolveCurrencyNumberToken) — KHÔNG parseFloat toàn
		// token: vi-VN "1.234" parseFloat → 1.234 sai (phải là 1234).
		const intNum = digits ? parseInt(digits, 10) : 0;
		const num = fracDigits ? parseFloat(`${intNum}.${fracDigits}`) : intNum;
		if (!Number.isFinite(num)) return;
		// Format decimals đầy đủ (formatCurrency nhận number — nhóm nghìn theo
		// locale + decimals ép). value mới = chuỗi formatted (đã gồm nhóm nghìn).
		const formatted = formatCurrency(num);
		if (formatted !== current) {
			value = formatted;
		}
	});

	// ── type='file': validation pipeline (trigger khi files đổi — không có "blur" cho file) ──
	// Mirror pattern value/previousValue: đọc `files` (reactive dep), so với previousFiles (untrack),
	// changed → debounce (processingValidation, timeId key 'change').
	// Handles: user (props.validation.change) + defaultValidators (required/max*) — merge song hành
	// với blur path trong event getter. Non-required bare (không validator) → bỏ qua (giữ neutral).
	let previousFiles: File[] | undefined;
	$effect(() => {
		if (configs.type !== 'file') return;
		const current = files;
		const changed = untrack(() => previousFiles) !== current;
		untrack(() => {
			previousFiles = current;
		});
		if (_filesJustReset) {
			// Vừa reset programmatic → bỏ qua trigger này (nếu có), bật cờ cho các lần sau.
			// Kiểm tra TRƯỚC early-return: kể cả lần reset không đổi files (không re-run)
			// thì lần files đổi THẬT kế tiếp cũng không bị nuốt bởi cờ stale.
			_filesJustReset = false;
			return;
		}
		if (!changed) return;
		const userChange = props.validation?.change;
		let userHandles: (ValidationCompact | ValidationFull)[] = [];
		let operator: 'and' | 'or' = props.validation?.operator ?? 'and';
		if (Array.isArray(userChange)) {
			userHandles = userChange;
		} else if (userChange && typeof userChange === 'object' && Array.isArray(userChange.handles)) {
			userHandles = userChange.handles;
			operator = userChange.operator ?? operator;
		}
		const defaultValidators = getDefaultValidators();
		const finalHandles = defaultValidators.length > 0 ? [...userHandles, ...defaultValidators] : userHandles;
		if (finalHandles.length === 0) return;
		void processingValidation('change', finalHandles, operator);
	});

	// ── type='barcode': validation pipeline (trigger khi codes đổi — mirror file) ──
	// codes effect: đọc `codes` (reactive dep), so previousCodes (untrack),
	// changed → debounce processingValidation với input = codes[].
	let previousCodes: string[] | undefined;
	$effect(() => {
		if (configs.type !== 'barcode') return;
		const current = codes;
		const changed = untrack(() => previousCodes) !== current;
		untrack(() => {
			previousCodes = current;
		});
		if (_codesJustReset) {
			// Vừa reset programmatic → bỏ qua trigger này (mirror file discipline)
			_codesJustReset = false;
			return;
		}
		if (!changed) return;
		const userChange = props.validation?.change;
		let userHandles: (ValidationCompact | ValidationFull)[] = [];
		let operator: 'and' | 'or' = props.validation?.operator ?? 'and';
		if (Array.isArray(userChange)) {
			userHandles = userChange;
		} else if (userChange && typeof userChange === 'object' && Array.isArray(userChange.handles)) {
			userHandles = userChange.handles;
			operator = userChange.operator ?? operator;
		}
		const defaultValidators = getDefaultValidators();
		const finalHandles = defaultValidators.length > 0 ? [...userHandles, ...defaultValidators] : userHandles;
		if (finalHandles.length === 0) return;
		void processingValidation('change', finalHandles, operator);
	});

	// ── type='file': build filePreviews + ObjectURL lifecycle ──
	// Ảnh → URL.createObjectURL (revoke trong effect cleanup + onDestroy).
	// Text/CSV/JSON → đọc slice(0, 512KB).text() (file lớn hơn → chỉ name+size).
	type FilePreview = { id: number; file: File; kind: 'image' | 'csv' | 'json' | 'text' | 'other'; url?: string; preview?: string };
	let filePreviews: FilePreview[] = $state([]);
	// Counter id preview — each key duy nhất (key theo name+size trùng khi chọn lại
	// cùng tệp → Svelte 5 throw each_key_duplicate, trang trắng).
	let previewSeq = 0;
	const MAX_TEXT_PREVIEW = 512 * 1024; // 512KB — tránh OOM file lớn
	function detectKind(file: File): FilePreview['kind'] {
		const name = file.name.toLowerCase();
		const mime = file.type;
		if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/.test(name)) return 'image';
		if (mime === 'text/csv' || /\.csv$/.test(name)) return 'csv';
		if (mime === 'application/json' || /\.json$/.test(name)) return 'json';
		if (/\.(txt|md|log|yaml|yml)$/.test(name) || mime.startsWith('text/')) return 'text';
		return 'other';
	}
	$effect(() => {
		if (configs.type !== 'file') return;
		const list = files ?? [];
		let cancelled = false;
		const built: FilePreview[] = [];
		(async () => {
			for (const file of list) {
				const kind = detectKind(file);
				const item: FilePreview = { id: ++previewSeq, file, kind };
				try {
					if (kind === 'image') {
						item.url = URL.createObjectURL(file);
					} else if ((kind === 'csv' || kind === 'json' || kind === 'text') && file.size <= MAX_TEXT_PREVIEW) {
						const raw = await file.slice(0, MAX_TEXT_PREVIEW).text();
						if (cancelled) return; // cleanup sẽ revoke built (kể cả item chưa push)
						if (kind === 'json') {
							try {
								item.preview = JSON.stringify(JSON.parse(raw), null, 2).slice(0, 2000);
							} catch {
								item.preview = raw.slice(0, 2000);
							}
						} else if (kind === 'csv') {
							item.preview = raw.split(/\r?\n/).slice(0, 5).join('\n');
						} else {
							item.preview = raw.slice(0, 2000);
						}
					}
				} catch (e) {
					// Preview fail → giữ name+size (không preview content)
				}
				if (cancelled) return;
				built.push(item);
			}
			if (!cancelled) filePreviews = built;
		})();
		return () => {
			// Effect chạy lại / unmount → revoke objectURL của danh sách cũ
			cancelled = true;
			for (const item of built) {
				if (item.url) URL.revokeObjectURL(item.url);
			}
		};
	});

	// ── type='file': handlers (chọn/xóa/DnD) ──
	// Đối chiếu accept (mime/* hoặc .ext hoặc mime chính xác)
	function matchesAccept(file: File): boolean {
		const accept = props.accept;
		if (!accept) return true;
		const tokens = accept.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
		for (const token of tokens) {
			if (token.endsWith('/*')) {
				if (file.type.toLowerCase().startsWith(token.slice(0, -1))) return true;
			} else if (token.startsWith('.')) {
				if (file.name.toLowerCase().endsWith(token)) return true;
			} else if (file.type.toLowerCase() === token) {
				return true;
			}
		}
		return false;
	}
	// Chọn tệp từ dialog/DnD: filter accept+maxSize, cap maxFiles; single→thay thế, multiple→append.
	function handleFileSelect(list: FileList | null, e?: Event) {
		if (configs.disabled || !list) return;
		_filesJustReset = false;
		const validFiles = Array.from(list).filter((f) => {
			if (!matchesAccept(f)) return false;
			if (configs.maxSize != null && f.size > configs.maxSize) return false;
			return true;
		});
		let next: File[];
		if (props.multiple) {
			const current = files ?? [];
			if (configs.maxFiles != null) {
				const room = Math.max(0, configs.maxFiles - current.length);
				next = [...current, ...validFiles.slice(0, room)];
			} else {
				next = [...current, ...validFiles];
			}
		} else {
			// single → chọn mới THAY THẾ (không giữ file cũ)
			next = validFiles.slice(0, 1);
		}
		files = next; // gán array MỚI (kỷ luật $bindable)
		if (e?.target instanceof HTMLInputElement) e.target.value = ''; // cho phép chọn lại file cùng tên
	}
	function removeFile(f: File) {
		if (configs.disabled) return;
		_filesJustReset = false;
		files = (files ?? []).filter((x) => x !== f);
	}
	function openFilePicker() {
		if (configs.disabled) return;
		_filesJustReset = false;
		configs.input.file?.ref?.click();
	}
	function handleDropzoneKeydown(e: KeyboardEvent) {
		if (configs.disabled) return;
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			openFilePicker();
		}
	}
	// DnD (HTML5) — EventListener không có dragover/drop/dragleave → dùng inline handler
	let fileDragover = $state(false);
	function handleDragOver(e: DragEvent) {
		if (configs.disabled) return;
		e.preventDefault();
		e.stopPropagation();
		fileDragover = true;
	}
	function handleDragLeave() {
		fileDragover = false;
	}
	function handleDrop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		fileDragover = false;
		if (configs.disabled) return;
		handleFileSelect(e.dataTransfer?.files ?? null);
	}
	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		const kb = bytes / 1024;
		if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
		const mb = kb / 1024;
		if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
		const gb = mb / 1024;
		return `${gb < 10 ? gb.toFixed(1) : Math.round(gb)} GB`;
	}
	// Hint accept/kích thước/số lượng cho dropzone (text phụ)
	const fileHint = $derived.by(() => {
		const parts: string[] = [];
		if (props.accept) parts.push(props.accept);
		if (configs.maxSize != null) parts.push(`≤ ${formatBytes(configs.maxSize)}`);
		if (props.multiple && configs.maxFiles != null) parts.push(`tối đa ${configs.maxFiles} tệp`);
		return parts.join(' · ');
	});
	const fileAriaLabel = $derived(
		`Chọn tệp.${fileHint ? ` Yêu cầu: ${fileHint}.` : ''}${files?.length ? ` Đã chọn ${files.length} tệp.` : ''}`
	);

	// ── type='file': file details modal (opt-in props.fileDetails) ──
	// Click 1 card preview → mở Modal chi tiết: ảnh size gốc (object-contain,
	// max-height lớn) + kích thước/mime/lastModified/path. File API KHÔNG có
	// full path → chỉ có `name` (+ webkitRelativePath nếu upload folder).
	let detailFile: FilePreview | undefined = $state(undefined);
	// Display riêng cho Modal (Modal render {#if display} — bind:display là
	// bắt buộc, KHÔNG có giá trị mặc định; pattern select fullscreen reuse).
	let detailDisplay = $state(false);
	// FilePreview KHÔNG có lastModified top-level — đọc qua f.file.lastModified
	// (f.lastModified = undefined → new Date(undefined) = "Invalid Date").
	const detailModified = $derived.by(() => {
		const f = detailFile?.file;
		if (!f) return undefined;
		try {
			return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'medium' }).format(
				new Date(f.lastModified)
			);
		} catch {
			return new Date(f.lastModified).toString();
		}
	});
	const detailRelativePath = $derived.by(() => {
		const rel = (detailFile?.file as File & { webkitRelativePath?: string })?.webkitRelativePath;
		return rel ? rel : undefined;
	});
	// Copy reference của preview đang mở — khi modal đóng → trả focus về card.
	let detailCardEl: HTMLElement | undefined;
	function openFileDetails(p: FilePreview, cardEl?: HTMLElement) {
		if (configs.disabled) return;
		detailFile = p;
		detailCardEl = cardEl;
		detailDisplay = true;
	}
	function closeFileDetails() {
		detailDisplay = false;
		detailFile = undefined;
		// Modal tự restore focus về trigger (nó lưu trigger khi mở) — đây là
		// phòng thủ khi autoFocus=false (card vẫn giữ focus qua click).
		detailCardEl?.focus?.();
		detailCardEl = undefined;
	}

	// ── type='file': quick delete (opt-in props.quickDelete) ──
	// Ô tick trên mỗi card → tick ≥1 tệp → hiện thanh hành động "Xóa N tệp
	// đã chọn" → removeFile hàng loạt (gán array MỚI, kỷ discipline $bindable).
	let selectedFiles: File[] = $state([]);
	const hasSelection = $derived(selectedFiles.length > 0);
	function toggleFileSelected(f: File) {
		if (configs.disabled) return;
		_filesJustReset = false;
		// Gán array MỚI (không mutation tại chỗ) — kỷ luật $state/$bindable
		selectedFiles = selectedFiles.includes(f)
			? selectedFiles.filter((x) => x !== f)
			: [...selectedFiles, f];
	}
	function removeSelectedFiles() {
		if (configs.disabled || !hasSelection) return;
		_filesJustReset = false;
		const removed = selectedFiles;
		selectedFiles = [];
		// Duy nhất 1 lần gán files mới — 1 run validation (không burst)
		files = (files ?? []).filter((x) => !removed.includes(x));
	}
	// files đổi (chọn mới/reset/xóa) → dọn selection rác (file không còn trong list)
	$effect(() => {
		if (configs.type !== 'file') return;
		const list = files ?? [];
		if (selectedFiles.length && !list.some((f) => selectedFiles.includes(f))) {
			selectedFiles = [];
		} else if (selectedFiles.length) {
			const kept = list.filter((f) => selectedFiles.includes(f));
			if (kept.length !== selectedFiles.length) selectedFiles = kept;
		}
	});

	// ── type='file': clear all (opt-in props.clearable) ──
	// Nút "Xóa tất cả" ở header row previews — hiện khi ≥1 file.
	// files = [] + _filesJustReset đúng discipline (KHÔNG bung validation).
	const clearableDisplay = $derived(props.clearable === true && (files?.length ?? 0) > 0);
	function clearAllFiles() {
		if (configs.disabled) return;
		_filesJustReset = false;
		selectedFiles = [];
		files = []; // gán array MỚI — files effect trigger validation 1 lần (discipline)
	}

	// ── type='file': select all (opt-in props.quickDelete) ──
	// Checkbox "chọn tất cả" ở header previews (mirror DataTable Head):
	// all → checked; một phần → indeterminate (aria-checked="mixed").
	// Toggle: all/mixed → deselect hết, chưa đủ → chọn tất cả (DataTable
	// togglePageSelection pattern).
	const allFilesSelected = $derived.by(() => {
		const list = files ?? [];
		return list.length > 0 && selectedFiles.length === list.length;
	});
	const indeterminateSelectAll = $derived(
		selectedFiles.length > 0 && !allFilesSelected && (files?.length ?? 0) > 0
	);
	function toggleAllFilesSelected() {
		if (configs.disabled) return;
		_filesJustReset = false;
		selectedFiles = allFilesSelected ? [] : [...(files ?? [])];
	}
	// Events cho Checkbox row/select-all — KHÔNG tự toggle qua mousedown được:
	// mousedown nội bộ Checkbox mutate local $bindable (transient, không báo về
	// selectedFiles) → bắt buộc click/keydown handler cập nhật state này rồi
	// prop sync ngược (mirror DataTable rowCheckEvents/selectAllEvents).
	// Memoize bằng Map — KHÔNG tạo mảng mới mỗi render (tránh re-attach handleEvents).
	// FIX: Checkbox component có inline onkeydown (Space/Enter → toggle local $bindable).
	// Ta dùng stopImmediatePropagation để tránh double-toggle + focus shift sang dropzone.
	const fileCheckEventsCache = new Map<File, { events: { click: () => void; keydown: (e?: Event | MouseEvents | TouchEvent | KeyboardEvent) => void } }[]>();
	let selectAllCheckEventsCache: { events: { click: () => void; keydown: (e?: Event | MouseEvents | TouchEvent | KeyboardEvent) => void } }[] | undefined;
	function getFileCheckEvents(f: File) {
		let cached = fileCheckEventsCache.get(f);
		if (!cached) {
			cached = [{
				events: {
					click: () => toggleFileSelected(f),
					keydown: (e?: Event | MouseEvents | TouchEvent | KeyboardEvent) => {
						const ke = e as KeyboardEvent | undefined;
						const key = ke?.key;
						if (key === ' ' || key === 'Enter') {
							ke?.preventDefault?.();
							ke?.stopImmediatePropagation?.();
							toggleFileSelected(f);
						}
					}
				}
			}];
			fileCheckEventsCache.set(f, cached);
		}
		return cached;
	}
	function getSelectAllCheckEvents() {
		if (!selectAllCheckEventsCache) {
			selectAllCheckEventsCache = [{
				events: {
					click: () => toggleAllFilesSelected(),
					keydown: (e?: Event | MouseEvents | TouchEvent | KeyboardEvent) => {
						const ke = e as KeyboardEvent | undefined;
						const key = ke?.key;
						if (key === ' ' || key === 'Enter') {
							ke?.preventDefault?.();
							ke?.stopImmediatePropagation?.();
							toggleAllFilesSelected();
						}
					}
				}
			}];
		}
		return selectAllCheckEventsCache;
	}

	// Events Checkbox card barcode (selectDeleteOn) — mirror getFileCheckEvents:
	// click/keydown → toggleCodeSelected (memoize theo mã, KHÔNG tạo mảng mới
	// mỗi render). keydown Space/Enter → stopImmediatePropagation để tránh
	// double-toggle với inline onkeydown của Checkbox.
	const codeCheckEventsCache = new Map<string, { events: { click: () => void; keydown: (e?: Event | MouseEvents | TouchEvent | KeyboardEvent) => void } }[]>();
	function getCodeCheckEvents(raw: string) {
		let cached = codeCheckEventsCache.get(raw);
		if (!cached) {
			cached = [{
				events: {
					click: () => toggleCodeSelected(raw),
					keydown: (e?: Event | MouseEvents | TouchEvent | KeyboardEvent) => {
						const ke = e as KeyboardEvent | undefined;
						const key = ke?.key;
						if (key === ' ' || key === 'Enter') {
							ke?.preventDefault?.();
							ke?.stopImmediatePropagation?.();
							toggleCodeSelected(raw);
						}
					}
				}
			}];
			codeCheckEventsCache.set(raw, cached);
		}
		return cached;
	}

	// ── type='barcode': state + handlers (mirror pattern file quickDelete/clearable) ──
	// codes (props, $bindable) = source-of-truth; barcodeInput = value nhập tay.
	// Scan camera: overlay inline (KHÔNG Modal — video + detect loop đơn giản hơn,
	// đóng bằng nút ×; Modal bind:display bắt buộc là bẫy đã biết → tránh hẳn).
	let barcodeInput = $state('');
	// Ô tick chọn nhanh (selectDeleteOn) — mirror selectedFiles
	let selectedCodes: string[] = $state([]);
	const hasCodeSelection = $derived(selectedCodes.length > 0);
	// Clear-all mới: hiện khi selected ≥2, click chỉ xóa PHẦN ĐÃ CHỌN (giữ phần
	// chưa tick). Quickbar trùng chức năng (hiện khi selected ≥1) → ẨN quickbar
	// khi clear-all hiển thị (selected ≥2) để không trùng lặp nút.
	const codeSelectionMulti = $derived(selectedCodes.length >= 2);
	const barcodeDisplayDerived = $derived(typeDerived == 'barcode');
	// Yêu cầu (4): class tạm khi nút add vừa thêm mã (Enter hoặc click) —
	// animation pulse + glow + shake 600ms rồi tự gỡ (triggerAddFlash).
	let addFlash = $state(false);
	// Tùy chọn scan/camera/beep/list — props là source of truth (mirror maxFiles getter)
	const cameraOnDerived = $derived(props.cameraOn === true);
	const beepOnDerived = $derived(props.beepOn === true);
	const updateOnDerived = $derived(props.updateOn === true);
	const deleteOnDerived = $derived(props.deleteOn === true);
	const selectDeleteOnDerived = $derived(props.selectDeleteOn === true);
	const selectAllOnDerived = $derived(props.selectAllOn === true);
	// Nút "Chọn tất cả" — tách prop riêng khỏi selectAllOn ("Xóa tất cả") để
	// trang gọi có thể bật một mình (chọn nhanh rồi dùng quickbar xóa phần)
	const selectAllButtonOnDerived = $derived(props.selectAllButtonOn === true);
	const formatsDerived = $derived(props.formats);
	// Import ảnh tĩnh (thư viện) → detect barcode/QR không cần camera
	const importOnDerived = $derived(props.importOn === true);

	// Yêu cầu (6): mã vừa quét/nhập TRÙNG → toast + animate card hiện có (bounce
	// + rung + tỏa sáng 900ms rồi tự gỡ, timer 1 lần dùng chung như addFlash).
	let dupFlashCode: string | undefined = $state();
	let dupFlashTimer: ReturnType<typeof setTimeout> | undefined;
	function triggerDupFlash(raw: string) {
		dupFlashCode = undefined;
		// rAF: force reflow giữa 2 lần gắn class → animation restart đúng (card
		// trùng đã flash lần trước cũng phải chạy lại).
		requestAnimationFrame(() => {
			dupFlashCode = raw;
			if (dupFlashTimer) clearTimeout(dupFlashTimer);
			dupFlashTimer = setTimeout(() => {
				dupFlashCode = undefined;
				dupFlashTimer = undefined;
			}, 900);
		});
	}

	function addBarcode(raw: string) {
		if (configs.disabled || !raw?.trim()) return;
		const code = raw.trim();
		// Yêu cầu (6): trùng → toast + animate card (bounce/rung/tỏa sáng), KHÔNG
		// thêm bản sao. Toast qua store global (ToastWrapper root layout) —
		// mirror pattern admin pages dùng client.browser?.toasts?.create().
			if ((codes ?? []).includes(code)) {
			if (browser) {
				client.browser?.toasts?.create({
					title: `Mã "${code}" đã tồn tại trong danh sách`,
					color: 'warning'
				});
				triggerDupFlash(code);
				// Touch feedback trùng mã (warning — nhịp ngắn 40ms, song song toast)
				vibratePattern('warning');
			}
			return;
		}
		_codesJustReset = false;
		codes = [...(codes ?? []), code]; // gán array MỚI (kỷ luật $bindable)
		// Yêu cầu (4): Enter/click nút add → nút add flash (pulse ring + glow +
		// shake ~600ms) rồi tự bỏ class — guard nhiều lần gõ liên tiếp.
		if (browser) triggerAddFlash();
	}

	// Flash animation nút add — 1 timer dùng chung: gõ liên tiếp → reset timer
	// (không chồng class); gỡ class sau 600ms. prefers-reduced-motion → CSS
	// animation: none nên class có gắn cũng không animate.
	let addFlashTimer: ReturnType<typeof setTimeout> | undefined;
	function triggerAddFlash() {
		addFlash = false;
		// rAF: force reflow giữa 2 lần gắn class → animation restart đúng
		// (không bị nuốt khi class chưa kịp remove/attach lại).
		requestAnimationFrame(() => {
			addFlash = true;
			if (addFlashTimer) clearTimeout(addFlashTimer);
			addFlashTimer = setTimeout(() => {
				addFlash = false;
				addFlashTimer = undefined;
			}, 600);
		});
	}

	function removeBarcode(raw: string) {
		if (configs.disabled) return;
		_codesJustReset = false;
		codes = (codes ?? []).filter((x) => x !== raw);
	}

	function toggleCodeSelected(raw: string) {
		if (configs.disabled) return;
		_codesJustReset = false;
		selectedCodes = selectedCodes.includes(raw)
			? selectedCodes.filter((x) => x !== raw)
			: [...selectedCodes, raw];
	}

	function removeSelectedCodes() {
		if (configs.disabled || !hasCodeSelection) return;
		_codesJustReset = false;
		const removed = selectedCodes;
		selectedCodes = [];
		// Duy nhất 1 lần gán codes mới — 1 run validation (không burst)
		codes = (codes ?? []).filter((x) => !removed.includes(x));
	}

	// ── Select-all (button "Chọn tất cả", mirror allFilesSelected/toggleAllFilesSelected) ──
	// Chỉ trong chế độ selection (selectDeleteOn — item mới selectable). Hiện khi
	// ≥2 mã selectable (dưới 2 nút vô nghĩa: 1 mã tick trực tiếp trên card).
	// all → label "Bỏ chọn tất cả"; một phần → indeterminate (dot giữa).
	const allCodesSelected = $derived.by(() => {
		const list = codes ?? [];
		return selectDeleteOnDerived && list.length > 0 && selectedCodes.length === list.length;
	});
	function toggleAllCodesSelected() {
		if (configs.disabled || !selectDeleteOnDerived) return;
		_codesJustReset = false;
		selectedCodes = allCodesSelected ? [] : [...(codes ?? [])];
	}

	// Yêu cầu (3): clear-all (selectAllOn) — Có tick card (selectDeleteOn) → bấm
	// CHỈ XÓA PHẦN ĐÃ CHỌN (lọc codes giữ phần chưa tick), KHÔNG codes = [] như
	// trước; hàm removeSelectedCodes đã đúng pattern → tái dùng (không trùng
	// logic). KHÔNG có tick card → selection không thể tồn tại → giữ nghĩa đen
	// "Xóa tất cả" (hành vi prop gốc) — nếu không, section chỉ selectAllOn (vd
	// ib-required) mất hoàn toàn nút xóa (regression probe cũ IB6).
	function clearAllCodes() {
		if (selectDeleteOnDerived) {
			removeSelectedCodes();
			return;
		}
		if (configs.disabled) return;
		_codesJustReset = false;
		selectedCodes = [];
		codes = [];
	}

	// codes đổi (thêm/reset/xóa) → dọn selection rác (mã không còn trong list)
	$effect(() => {
		if (!barcodeDisplayDerived) return;
		const list = codes ?? [];
		if (selectedCodes.length && !list.some((c) => selectedCodes.includes(c))) {
			selectedCodes = [];
		} else if (selectedCodes.length) {
			const kept = list.filter((c) => selectedCodes.includes(c));
			if (kept.length !== selectedCodes.length) selectedCodes = kept;
		}
	});

	// ── type='barcode': edit item (opt-in props.updateOn) ──
	// Click nút edit → input inline trên card (value cũ làm mặc định) → Enter/blur
	// commit; Escape hủy. Index theo position trong list (rawValue trùng được phép
	// — each key dùng index-seq, KHÔNG key theo rawValue).
	let editingCodeIndex = $state(-1);
	let editingCodeValue = $state('');
	let editCodeEl: HTMLInputElement | undefined;
	function startEditCode(index: number, current: string) {
		if (configs.disabled) return;
		editingCodeIndex = index;
		editingCodeValue = current;
		requestAnimationFrame(() => editCodeEl?.focus());
	}
	function commitEditCode() {
		if (editingCodeIndex < 0) return;
		const next = editingCodeValue.trim();
		if (next && next !== (codes ?? [])[editingCodeIndex]) {
			_codesJustReset = false;
			const list = (codes ?? []).slice();
			list[editingCodeIndex] = next;
			codes = list; // gán array MỚI
		}
		editingCodeIndex = -1;
		editingCodeValue = '';
	}
	function cancelEditCode() {
		editingCodeIndex = -1;
		editingCodeValue = '';
	}

	// ── type='barcode': camera scan overlay ──
	// getUserMedia → video stream → detect loop (interval 300ms) →
	//   1 mã: addBarcode + beep single → đóng overlay.
	//   >1 mã: freeze frame (canvas capture) + bounding box overlay → click vùng
	//     chọn → addBarcode mã đó + beep single → đóng overlay.
	// Fullscreen API thật: mở scan → overlayEl.requestFullscreen() (fallback
	// overlay thường nếu browser chặn/unsupported); đóng → exitFullscreen (guard
	// document.fullscreenElement); listener fullscreenchange cleanup khi user
	// Esc khỏi fullscreen.
	// SSR guard: browser check + navigator.mediaDevices undefined → hiện lỗi
	// (KHÔNG crash). Camera permission probe headless có thể DENIED → probe
	// assert UI structure + mock getUserMedia qua addInitScript.
	let scanOpen = $state(false);
	let scanError = $state('');
	let scanFrozen = $state(false);
	// Yêu cầu (5): pause/resume detect loop — GIỮ stream + video hiển thị.
	let scanPaused = $state(false);
	// Kết quả detect trên frame freeze — click chọn (bounding box từ video coords)
	let scanResults: BarcodeDetectorResult[] = $state([]);
	let videoEl: HTMLVideoElement | undefined;
	let overlayEl: HTMLDivElement | undefined;
	let canvasEl: HTMLCanvasElement | undefined;
	let scanStream: MediaStream | undefined;
	let scanTimer: ReturnType<typeof setInterval> | undefined;
	// Dedup: cùng 1 mã trong frame liên tiếp không re-beep (so rawValue cuối đã add)
	let lastDetectedRaw: string | undefined;
	// Fullscreen: cleanup listener khi đóng overlay/unmount
	let fullscreenChangeCleanup: (() => void) | undefined;
	// ── type='barcode': import ảnh tĩnh (thư viện) ──
	// hidden input file (clip ẩn — mirror type='file', KHÔNG display:none vì
	// .click() cần). Kết quả detect nhiều mã → tái dùng overlay scan (mode
	// 'import': canvas freeze hiển thị ảnh thay video, regions map theo ảnh).
	let importFileEl: HTMLInputElement | undefined;
	// Overlay mode: 'camera' (getUserMedia + detect loop) | 'import' (ảnh tĩnh
	// 1 lần → detect ngay khi mở, không loop, không pause)
	let scanMode: 'camera' | 'import' = $state('camera');
	// Ảnh import đang xử lý (đợi decode/detect) → hint trên overlay
	let importBusy = $state(false);
	// Kích thước ảnh gốc (naturalWidth/Height) — boxStyle map % theo ảnh này
	let importImgW = 1;
	let importImgH = 1;

	async function enterOverlayFullscreen() {
		if (!browser || !overlayEl) return;
		if (document.fullscreenElement) return; // đã fullscreen (hoặc tab khác giữ) → bỏ qua
		try {
			await overlayEl.requestFullscreen();
		} catch {
			// Fallback: browser chặn (permission/iframe) → overlay fixed vẫn dùng được
		}
	}

	function exitOverlayFullscreen() {
		if (!browser) return;
		if (document.fullscreenElement) {
			void document.exitFullscreen().catch(() => {
				// browser từ chối (đang transition) → bỏ qua
			});
		}
	}

	function handleFullscreenChange() {
		// User Esc khỏi fullscreen khi overlay đang mở KHÔNG qua closeScan (VD
		// Esc) → sync state: overlay vẫn mở (fallback inline), detect loop vẫn chạy.
		// Không cần action riêng — chỉ đảm bảo không leak listener (cleanup ở onDestroy).
	}

	async function openScan() {
		if (configs.disabled) return;
		scanError = '';
		scanFrozen = false;
		scanPaused = false;
		scanResults = [];
		lastDetectedRaw = undefined;
		scanMode = 'camera';
		// Yêu cầu (7): blur input text — mở camera xong keyboard mobile KHÔNG còn
		// đè overlay (activeElement dừng trigger soft keyboard), caret ẩn.
		configs.input.text?.ref?.blur();
		if (configs.status.focus) configs.status.focus = false;
		// primeAudio trong gesture click — AudioContext resume trước khi beep sau
		if (beepOnDerived) primeAudio();
		scanOpen = true;
		if (!browser) return;
		// Yêu cầu (5): fullscreen ngay khi mở (overlay render xong → rAF)
		requestAnimationFrame(() => void enterOverlayFullscreen());
		if (!navigator.mediaDevices?.getUserMedia) {
			scanError = 'Camera không khả dụng trên trình duyệt này';
			return;
		}
		try {
			scanStream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
				audio: false
			});
			// videoEl gắn sau khi overlay render — chờ rAF
			requestAnimationFrame(() => {
				if (!videoEl) return;
				videoEl.srcObject = scanStream ?? null;
				void videoEl.play();
			});
			startDetectLoop();
		} catch (e) {
			scanError =
				e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')
					? 'Quyền camera bị từ chối — cho phép truy cập camera để quét'
					: e instanceof DOMException && e.name === 'NotFoundError'
						? 'Không tìm thấy camera trên thiết bị này'
						: 'Không mở được camera — thử lại';
		}
	}

	function closeScan() {
		stopDetectLoop();
		exitOverlayFullscreen();
		if (scanStream) {
			for (const track of scanStream.getTracks()) track.stop();
			scanStream = undefined;
		}
		if (videoEl) videoEl.srcObject = null;
		scanOpen = false;
		scanFrozen = false;
		scanPaused = false;
		scanResults = [];
		scanError = '';
		scanMode = 'camera';
		importBusy = false;
	}

	// Yêu cầu (5): pause/resume — pause dừng detect loop, GIỮ stream + video;
	// resume chạy lại interval. Freeze state không đụng (pause ≠ freeze).
	function toggleScanPause() {
		if (!scanOpen || scanFrozen) return;
		scanPaused = !scanPaused;
		if (scanPaused) {
			stopDetectLoop();
		} else {
			lastDetectedRaw = undefined; // cho phép re-detect cùng mã sau resume
			startDetectLoop();
		}
	}

	function startDetectLoop() {
		stopDetectLoop();
		scanTimer = setInterval(() => void detectFrame(), 300);
	}

	function stopDetectLoop() {
		if (scanTimer) {
			clearInterval(scanTimer);
			scanTimer = undefined;
		}
	}

	async function detectFrame() {
		if (!videoEl || videoEl.readyState < 2 || scanFrozen || scanPaused) return;
		const detector = await ensureBarcodeDetector();
		if (!detector) {
			scanError = 'BarcodeDetector không khả dụng';
			stopDetectLoop();
			return;
		}
		let results: BarcodeDetectorResult[];
		try {
			results = (await detector.detect(videoEl)) as BarcodeDetectorResult[];
		} catch {
			return; // frame tạm lỗi (video đang seek…) → bỏ qua, loop chạy tiếp
		}
		if (scanFrozen || scanPaused) return;
		const valid = formatsDerived?.length
			? results.filter((r) => formatsDerived!.includes(r.format))
			: results;
		if (valid.length === 0) return;
		if (valid.length === 1) {
			// Single: thêm thẳng + beep 1 nốt + đóng overlay. Dedup: cùng mã liên
			// tiếp (loop 300ms quét 2 lần trước khi đóng) → beep đúng 1 lần.
			const raw = valid[0].rawValue;
			if (raw === lastDetectedRaw) return;
			lastDetectedRaw = raw;
			if (beepOnDerived) playBeep('single');
			// Touch feedback song song beep (mobile tắt tiếng vẫn rung)
			vibratePattern('single');
			addBarcode(raw);
			closeScan();
		} else {
			// Multiple: freeze frame + bounding box overlay + beep 2 nốt (cấp cao
			// hơn) NGAY khi freeze — báo hiệu cần chọn. Vùng chọn click → beep
			// single (chọn 1 mã) —KHÔNG beep lại multiple.
			scanFrozen = true;
			stopDetectLoop();
			if (beepOnDerived) playBeep('multiple');
			// Touch feedback nhiều mã (pattern ngắt [60,60,60] — phân biệt single)
			vibratePattern('multiple');
			captureFreezeFrame();
			scanResults = valid;
		}
	}

	/**
	 * Chụp frame video hiện tại vào canvas (freeze) — DOMRect của bounding box
	 * nằm trên hệ coords VIDEO (videoWidth×videoHeight), map sang CSS qua tỉ lệ
	 * video hiển thị (object-fit: cover → tính theo max scale trục).
	 */
	function captureFreezeFrame() {
		if (!videoEl || !canvasEl) return;
		const vw = videoEl.videoWidth;
		const vh = videoEl.videoHeight;
		if (!vw || !vh) return;
		canvasEl.width = vw;
		canvasEl.height = vh;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;
		try {
			ctx.drawImage(videoEl, 0, 0);
		} catch {
			// Video chưa kịp render frame (stream vừa gắn) → canvas trống — vẫn
			// hiện regions (bounding box vị trí đúng, nền đen overlay).
		}
	}

	function pickScanResult(r: BarcodeDetectorResult) {
		if (beepOnDerived) playBeep('single');
		// Chọn 1 mã từ multi-region — vibrate single như detect thường
		vibratePattern('single');
		addBarcode(r.rawValue);
		closeScan();
	}

	/** Map bounding box (video coords) → % vị trí trên overlay (object-fit cover). */
	function boxStyle(r: BarcodeDetectorResult) {
		const box = r.boundingBox;
		if (!box) return undefined;
		// Nguồn coords: ảnh import (naturalWidth/Height) hoặc video (videoWidth/Height)
		const vw = scanMode === 'import' ? importImgW : videoEl?.videoWidth || 1;
		const vh = scanMode === 'import' ? importImgH : videoEl?.videoHeight || 1;
		const ow = overlayEl?.clientWidth || 1;
		const oh = overlayEl?.clientHeight || 1;
		// object-fit: cover → scale = max(ow/vw, oh/vh); ảnh hiển thị lớn hơn
		// overlay, căn giữa → offset âm nửa phần tràn.
		const scale = Math.max(ow / vw, oh / vh);
		const dispW = vw * scale;
		const dispH = vh * scale;
		const offX = (ow - dispW) / 2;
		const offY = (oh - dispH) / 2;
		const left = ((box.x * scale + offX) / ow) * 100;
		const top = ((box.y * scale + offY) / oh) * 100;
		const width = (box.width * scale / ow) * 100;
		const height = (box.height * scale / oh) * 100;
		return `left:${left}%;top:${top}%;width:${width}%;height:${height}%`;
	}

	// ── Import ảnh tĩnh: chọn file → decode → detect 1 lần → semantic như
	// detectFrame (1 mã thêm thẳng + đóng; nhiều mã mở overlay chọn vùng;
	// 0 mã → toast). Overlay mode 'import' hiển thị canvas freeze (ảnh) +
	// regions, KHÔNG video/pause/detect loop.
	function openImportPicker() {
		if (configs.disabled) return;
		configs.input.text?.ref?.blur();
		// primeAudio trong gesture click (mirror openScan)
		if (beepOnDerived) primeAudio();
		importFileEl?.click();
	}

	async function handleImportSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		// Reset value ngay → chọn lại CÙNG file lần sau vẫn bung onchange
		input.value = '';
		if (!file) return;
		if (configs.disabled) return;
		if (!file.type.startsWith('image/')) {
			if (browser) {
				client.browser?.toasts?.create({
					title: 'Tệp không phải ảnh — chọn ảnh chứa mã vạch/QR',
					color: 'warning'
				});
			}
			return;
		}
		const detector = await ensureBarcodeDetector();
		if (!detector) {
			if (browser) {
				client.browser?.toasts?.create({
					title: 'BarcodeDetector không khả dụng',
					color: 'warning'
				});
			}
			return;
		}
		// objectURL → <img> decode() — img là CanvasImageSource hợp lệ cho detect()
		const url = URL.createObjectURL(file);
		try {
			const img = new Image();
			img.src = url;
			await img.decode();
			let results: BarcodeDetectorResult[];
			try {
				results = (await detector.detect(img)) as BarcodeDetectorResult[];
			} catch {
				results = [];
			}
			const valid = formatsDerived?.length
				? results.filter((r) => formatsDerived!.includes(r.format))
				: results;
			if (valid.length === 1) {
				// Single: thêm thẳng + beep + đóng (không mở overlay) — mirror detectFrame
				if (beepOnDerived) playBeep('single');
				vibratePattern('single');
				addBarcode(valid[0].rawValue);
			} else if (valid.length > 1) {
				// Multiple: mở overlay mode 'import' + freeze canvas vẽ ảnh + regions
				importImgW = img.naturalWidth || 1;
				importImgH = img.naturalHeight || 1;
				scanError = '';
				scanFrozen = false;
				scanPaused = false;
				scanMode = 'import';
				scanOpen = true;
				importBusy = true;
				requestAnimationFrame(() => {
					if (canvasEl) {
						canvasEl.width = importImgW;
						canvasEl.height = importImgH;
						canvasEl.getContext('2d')?.drawImage(img, 0, 0);
					}
					scanFrozen = true; // render regions + hint sau khi canvas có ảnh
					importBusy = false;
					scanResults = valid;
				});
				if (beepOnDerived) playBeep('multiple');
				vibratePattern('multiple');
			} else {
				// 0 mã: ảnh không chứa mã nhận diện được → toast (không mở overlay)
				if (browser) {
					client.browser?.toasts?.create({
						title: 'Không tìm thấy mã vạch/QR trong ảnh',
						color: 'warning'
					});
				}
			}
		} finally {
			URL.revokeObjectURL(url);
		}
	}


	onMount(() => {
		if (textFieldContext) {
			if (!textFieldContext.children) textFieldContext.children = {};
			textFieldContext.children.input = configs;
		}
		// Register this Input with the Form context for validation
		if (formContext) {
			if (!formContext.childrens) formContext.childrens = new SvelteSet();
			// InputConfigs không nằm trong union FormConfigs.childrens (thiếu mode/
			// searchable/… của Select) — Form chỉ đọc .validation/.loading/.name qua
			// 'checked'/'value' in checks, cast an toàn.
			formContext.childrens.add(configs as unknown as TextFieldConfigs);
		}
		// type='barcode' fullscreen: theo dõi fullscreenchange — user Esc khỏi
		// fullscreen (KHÔNG qua closeScan) → fullscreenchange bung, cleanup guard.
		if (browser && configs.type == 'barcode') {
			const onChange = () => handleFullscreenChange();
			document.addEventListener('fullscreenchange', onChange);
			fullscreenChangeCleanup = () => document.removeEventListener('fullscreenchange', onChange);
		}
	});
	onDestroy(() => {
		value = undefined;
		if (configs.type == 'password') configs.input.password.value = undefined;
		// type='barcode': dọn camera stream/timer khi unmount (đóng overlay)
		if (configs.type == 'barcode') {
			closeScan();
			fullscreenChangeCleanup?.();
			fullscreenChangeCleanup = undefined;
		}
		// type='barcode': hủy flash timer nút add khi unmount
		if (addFlashTimer) {
			clearTimeout(addFlashTimer);
			addFlashTimer = undefined;
		}
		// type='barcode': hủy flash timer card trùng khi unmount
		if (dupFlashTimer) {
			clearTimeout(dupFlashTimer);
			dupFlashTimer = undefined;
		}
		// type='file': revoke mọi objectURL còn lại (effect cleanup đã revoke phần lớn,
		// đây là phòng thủ nếu preview build chưa kịp chạy cleanup)
		if (configs.type == 'file') {
			for (const item of filePreviews) {
				if (item.url) URL.revokeObjectURL(item.url);
			}
		}
		// number/currency: input unmount khi visual keyboard đang mở → keyboard
		// kẹt trên màn hình vĩnh viễn (host là singleton refCount, không ai giải
		// phóng). hideVisualNumberKb dọn cleaner + cursor + focus status (Fix #3).
		// isShow nằm trên profile.visualKeyboard (useVisualKeyboard), không phải
		// browser.visualKeyboard (VisualKeyboardMeta — chỉ width/height/ref).
		if (visualNumberKbCleaner) {
			hideVisualNumberKb();
		} else if (profile.visualKeyboard.isShow && configs.status?.focus) {
			profile.visualKeyboard.isShow = false;
		}
		[...(configs.timeId?.values() ?? [])].forEach((time) => {
			clearTimeout(time);
		});
		configs.timeId?.clear();
	});

	export { configs };
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	class={configs.style}
	style:--duration={`${configs.duration}ms`}
	{@attach handleEvents(configs.event)}
>
	{#if props.leading}
		{@render props.leading({
			defaultStyles: configs.leading.style,
			get size() {
				return configs.size;
			}
		})}
	{/if}
	{#if configs.type == 'file'}
		<!-- type='file': hidden native input (source) + dropzone (click/DnD) + previews.
		     input ẩn bằng clip (KHÔNG display:none — mất khả năng .click() trên 1 số browser). -->
		<input
			type="file"
			accept={props.accept}
			multiple={props.multiple ? true : undefined}
			name={props.name}
			id={inputId}
			tabindex="-1"
			aria-hidden="true"
			style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0"
			bind:this={configs.input.file.ref}
			onchange={(e) => handleFileSelect((e.currentTarget as HTMLInputElement).files, e)}
		/>
		<div
			bind:this={dropzoneEl}
			class="input-file-dropzone"
			class:input-file-dragover={fileDragover}
			role="button"
			tabindex={configs.disabled ? -1 : 0}
			aria-label={fileAriaLabel}
			aria-disabled={configs.disabled ? 'true' : undefined}
			aria-invalid={configs.validation.isValid === false ? 'true' : undefined}
			onclick={() => openFilePicker()}
			onkeydown={handleDropzoneKeydown}
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			ondrop={handleDrop}
			onfocus={() => (configs.status.focus = true)}
			onblur={() => (configs.status.focus = false)}
		>
			<svg class="input-file-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<path
					d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				<path
					d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
			<span class="input-file-cta">{fileDragover ? 'Thả tệp vào đây' : 'Kéo thả tệp vào đây hoặc bấm để chọn'}</span>
			{#if fileHint}
				<span class="input-file-hint">{fileHint}</span>
			{/if}
		</div>
		{#if filePreviews.length}
			<div class="input-file-previews-head" data-test="input-file-previews-head">
				{#if hasSelection}
					<span class="input-file-selected-count" aria-live="polite">
						Đã chọn {selectedFiles.length}/{filePreviews.length} tệp
					</span>
				{:else}
					<span class="input-file-count" aria-live="polite">{filePreviews.length} tệp</span>
				{/if}
				{#if props.quickDelete && !configs.disabled}
					<div class="input-file-selectall-wrap" data-test="input-file-select-all">
						<Checkbox
							checked={allFilesSelected}
							indeterminate={indeterminateSelectAll}
							size="sm"
							color="primary"
							aria-label={allFilesSelected ? 'Bỏ chọn tất cả tệp' : 'Chọn tất cả tệp'}
							class="input-file-selectall-checkbox"
							events={getSelectAllCheckEvents()}
						/>
					</div>
				{/if}
				{#if clearableDisplay && !hasSelection}
					<button
						type="button"
						class="input-file-clear-all"
						data-test="input-file-clear-all"
						aria-label="Xóa tất cả tệp đã chọn"
						onclick={clearAllFiles}
					>
						<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path
								d="M6 6l12 12M18 6L6 18"
								stroke="currentColor"
								stroke-width="1.75"
								stroke-linecap="round"
							/>
						</svg>
						<span>Xóa tất cả</span>
					</button>
				{/if}
			</div>
			{#if hasSelection}
				<div class="input-file-quickbar" data-test="input-file-quickbar" role="toolbar" aria-label="Hành động tệp đã chọn">
					<button
						type="button"
						class="input-file-quickbar-delete"
						data-test="input-file-quickbar-delete"
						onclick={removeSelectedFiles}
					>
						<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path
								d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"
								stroke="currentColor"
								stroke-width="1.75"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
						Xóa {selectedFiles.length} tệp đã chọn
					</button>
				</div>
			{/if}
			<ul class="input-file-previews">
				{#each filePreviews as p (p.id)}
					{#snippet previewBody()}
						{#if p.kind == 'image' && p.url}
							<img class="input-file-thumb" src={p.url} alt={p.file.name} />
						{:else if p.kind == 'csv' || p.kind == 'json' || p.kind == 'text'}
							<pre class="input-file-preview-text">{p.preview ?? ''}</pre>
						{:else}
							<span class="input-file-glyph" aria-hidden="true">
								<svg viewBox="0 0 24 24" fill="none">
									<path
										d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"
										stroke="currentColor"
										stroke-width="1.75"
										stroke-linejoin="round"
									/>
									<path d="M14 3v5h5" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" />
								</svg>
							</span>
						{/if}
						<div class="input-file-meta">
							<span class="input-file-name" title={p.file.name}>{p.file.name}</span>
							<span class="input-file-size">{formatBytes(p.file.size)}</span>
						</div>
					{/snippet}
					<li
						class="input-file-card"
						class:input-file-selected={selectedFiles.includes(p.file)}
						aria-label={`${p.file.name}, ${formatBytes(p.file.size)}`}
					>
						{#if props.quickDelete && !configs.disabled}
							<!-- Checkbox component (reuse) — mirror DataTable Body rowCheckEvents:
							     checked one-way + click/keydown → toggleFileSelected; mousedown
							     nội bộ Checkbox mutate local $bindable (transient) → prop sync
							     ngược khi selectedFiles đổi → net đúng 1 lần toggle.
							     data-test KHÔNG render lên DOM (BasicProps không spread) → hook
							     DOM qua wrapper span data-test + class input-file-check. -->
							<span class="input-file-check-wrap" data-test="input-file-check">
								<Checkbox
									checked={selectedFiles.includes(p.file)}
									size="sm"
									color="primary"
									aria-label={`Chọn ${p.file.name} để xóa`}
									class="input-file-check"
									events={getFileCheckEvents(p.file)}
								/>
							</span>
						{/if}
						{#if props.fileDetails && !configs.disabled}
							<button
								type="button"
								class="input-file-detail-trigger"
								data-test="input-file-detail-trigger"
								aria-haspopup="dialog"
								aria-label={`Xem chi tiết ${p.file.name}`}
								onclick={(e) => {
									e.stopPropagation();
									openFileDetails(p, e.currentTarget);
								}}
							>
								{@render previewBody()}
							</button>
						{:else}
							<div class="input-file-detail-body">
								{@render previewBody()}
							</div>
						{/if}
						{#if !configs.disabled}
							<button
								type="button"
								class="input-file-remove"
								aria-label={`Xóa ${p.file.name}`}
								onclick={(e) => {
									e.stopPropagation();
									removeFile(p.file);
								}}
							>
								<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
									<path
										d="M6 6l12 12M18 6L6 18"
										stroke="currentColor"
										stroke-width="1.75"
										stroke-linecap="round"
									/>
								</svg>
							</button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
		{#if detailDisplay}
			<!-- type='file': file details modal (opt-in) — Modal sync hệ thống
			     (focus trap, ARIA, scroll lock, ESC, nút close error).
			     Children snippet là TRẺ TRỰC TIẾP của Modal.Container (bẫy #5).
			     bind:display BẮT BUỘC — Modal render {#if display} (không có
			     bind → display=undefined → không bao giờ render). -->
			<Modal
				bind:display={detailDisplay}
				size="md"
				variant="blur"
				transitionType={client.browser?.isMobile ? 'fly' : 'fade'}
				onClose={closeFileDetails}
				data-test="input-file-details-modal"
			>
				<Modal.Container class="input-file-detail-modal">
					<Modal.Container.Header class="input-file-detail-header">
						{detailFile?.file.name}
					</Modal.Container.Header>
					<Modal.Container.Body class="input-file-detail-body-modal">
						<div class="input-file-detail-grid" data-test="input-file-details-modal">
							{#if detailFile?.kind == 'image' && detailFile.url}
								<div class="input-file-detail-media">
									<img class="input-file-detail-image" src={detailFile.url} alt={detailFile.file.name} />
								</div>
							{:else if detailFile?.preview}
								<div class="input-file-detail-media">
									<pre class="input-file-detail-preview-text">{detailFile.preview}</pre>
								</div>
							{:else if detailFile}
								<div class="input-file-detail-media input-file-detail-media-empty">
									<span class="input-file-glyph" aria-hidden="true">
										<svg viewBox="0 0 24 24" fill="none">
											<path
												d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"
												stroke="currentColor"
												stroke-width="1.75"
												stroke-linejoin="round"
											/>
											<path d="M14 3v5h5" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" />
										</svg>
									</span>
								</div>
							{/if}
							{#if detailFile}
								<dl class="input-file-detail-list">
									<div class="input-file-detail-row">
										<dt>Tên tệp</dt>
										<dd title={detailFile.file.name}>{detailFile.file.name}</dd>
									</div>
									{#if detailRelativePath}
										<div class="input-file-detail-row">
											<dt>Đường dẫn tương đối</dt>
											<dd title={detailRelativePath}>{detailRelativePath}</dd>
										</div>
									{/if}
									<div class="input-file-detail-row">
										<dt>Kích thước</dt>
										<dd>{formatBytes(detailFile.file.size)} ({detailFile.file.size.toLocaleString('vi-VN')} bytes)</dd>
									</div>
									<div class="input-file-detail-row">
										<dt>Loại tệp</dt>
										<dd>{detailFile.file.type || detailFile.kind}</dd>
									</div>
									{#if detailModified}
										<div class="input-file-detail-row">
											<dt>Sửa lần cuối</dt>
											<dd>{detailModified}</dd>
										</div>
									{/if}
								</dl>
							{/if}
						</div>
					</Modal.Container.Body>
				</Modal.Container>
			</Modal>
		{/if}
	{:else if configs.type == 'barcode'}
		<!-- type='barcode': input text + nút scanner (Button children SVG — iconify
		     không có icon camera) + danh sách detected + overlay camera inline
		     (KHÔNG Modal). codes = source-of-truth (bindable), value string không
		     dùng. Nút action dùng Button component (element) — aspect-square scale
		     theo --min-height của Input root; tick card = Checkbox component reuse
		     (mirror file mode). -->
		{#snippet barcodeCard(index: number, raw: string)}
			{#if selectDeleteOnDerived && !configs.disabled}
				<!-- Checkbox component (reuse) — mirror DataTable/file rowCheckEvents:
				     checked one-way + click/keydown → toggleCodeSelected; mousedown
				     nội bộ Checkbox mutate local $bindable (transient) → prop sync
				     ngược khi selectedCodes đổi → net đúng 1 lần toggle.
				     data-test KHÔNG render lên DOM (BasicProps không spread) → hook
				     DOM qua wrapper span data-test + class input-barcode-check. -->
				<span
					class="input-barcode-check-wrap"
					data-test="input-barcode-check"
					class:input-barcode-checked={selectedCodes.includes(raw)}
				>
					<Checkbox
						checked={selectedCodes.includes(raw)}
						size="sm"
						color="primary"
						aria-label={`Chọn mã ${raw} để xóa`}
						class="input-barcode-check"
						events={getCodeCheckEvents(raw)}
					/>
				</span>
			{/if}
			{#if editingCodeIndex == index}
				<input
					class="input-barcode-edit"
					data-test="input-barcode-edit"
					type="text"
					bind:value={editingCodeValue}
					bind:this={editCodeEl}
					onkeydown={(e) => {
						if (e.key === 'Enter') commitEditCode();
						else if (e.key === 'Escape') cancelEditCode();
					}}
					onblur={commitEditCode}
				/>
			{:else}
				<span
					class="input-barcode-value"
					class:input-barcode-value-offset={selectDeleteOnDerived && !configs.disabled}
					title={raw}
				>{raw}</span>
			{/if}
			{#if updateOnDerived && !configs.disabled && editingCodeIndex != index}
				<!-- Button component (reuse) — ghost + aspect-square + Icon pencil
				     (iconify fetch online). Size tự scale theo --min-height Input root.
				     Wrapper span data-test hook DOM (Button không spread props). -->
				<span data-test="input-barcode-edit-trigger" class="input-barcode-action-hook">
					<Button
						variant="ghost"
						color="default"
						size="xs"
						aspect-square
						class="input-barcode-edit-trigger"
						aria-label={`Sửa mã ${raw}`}
						onclick={() => startEditCode(index, raw)}
					>
						<Icon icon="lucide:pencil" class="input-barcode-icon" />
					</Button>
				</span>
			{/if}
			{#if deleteOnDerived && !configs.disabled}
				<!-- Wrapper span data-test hook DOM (Button không spread props) -->
				<span data-test="input-barcode-remove" class="input-barcode-action-hook">
					<Button
						variant="ghost"
						color="error"
						size="xs"
						aspect-square
						class="input-barcode-remove"
						aria-label={`Xóa mã ${raw}`}
						onclick={() => removeBarcode(raw)}
					>
						<Icon icon="lucide:x" class="input-barcode-icon" />
					</Button>
				</span>
			{/if}
		{/snippet}
		<div class="input-barcode-row">
			<input
				type="text"
				class="bg-transparent outline-none border-none w-full"
				placeholder={placeholderDerived}
				id={inputId}
				data-test="input-barcode-input"
				bind:value={barcodeInput}
				// bind ref vào configs.input.text (mirror text/number/currency) —
				// configs.focus() focus được input thật (click vào root ngoài input),
				// native blur → status.focus=false → effect dispatch 'blur' → validation.
				bind:this={configs.input.text.ref}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						addBarcode(barcodeInput);
						barcodeInput = '';
					}
				}}
				{@attach handleEvents(configs.input.text.event)}
			/>
			{#if importOnDerived}
				<!-- Import ảnh tĩnh từ thư viện: hidden input file (clip ẩn — mirror
				     type='file', KHÔNG display:none vì .click()) + nút image. data-test
				     hook DOM qua wrapper span (Button không spread props). -->
				<input
					type="file"
					accept="image/*"
					tabindex="-1"
					aria-hidden="true"
					style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0"
					bind:this={importFileEl}
					onchange={(e) => void handleImportSelect(e)}
				/>
				<span data-test="input-barcode-import-trigger" class="input-barcode-action-hook">
					<Button
						variant="ghost"
						color="info"
						size="sm"
						aspect-square
						class="input-barcode-import-trigger"
						aria-label="Nhập ảnh chứa mã để nhận diện"
						onclick={() => openImportPicker()}
					>
						<Icon icon="lucide:image" class="input-barcode-icon" />
					</Button>
				</span>
			{/if}
			{#if cameraOnDerived}
				<!-- Button component (reuse) — iconify KHÔNG có icon camera → giữ SVG
				     camera inline nhưng bọc trong Button qua children snippet.
				     data-test KHÔNG render lên DOM (Button không spread props) → hook
				     DOM qua wrapper span data-test (mirror file mode). -->
				<span data-test="input-barcode-scan-trigger" class="input-barcode-action-hook">
					<Button
						variant="ghost"
						color="info"
						size="sm"
						aspect-square
						class="input-barcode-scan-trigger"
						aria-label="Quét mã bằng camera"
						onclick={() => void openScan()}
					>
						<svg class="input-barcode-scan-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path
								d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"
								stroke="currentColor"
								stroke-width="1.75"
								stroke-linecap="round"
							/>
							<path d="M4 12h16" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
						</svg>
					</Button>
				</span>
			{/if}
			{#if (barcodeInput.length || addFlash) && !configs.disabled}
				<!-- Button component (reuse) — Icon plus (iconify). class tạm
				     barcode-add-flash khi vừa add (Enter/click) → pulse+glow+shake 600ms.
				     addFlash giữ nút hiển thị sau khi input rỗng (Enter → flash vẫn thấy
				     trong 600ms rồi nút mới ẩn). Wrapper span data-test hook DOM
				     (Button không spread props). -->
				<span data-test="input-barcode-add" class="input-barcode-action-hook">
					<Button
						variant="ghost"
						color="success"
						size="sm"
						aspect-square
						class={addFlash ? 'input-barcode-add barcode-add-flash' : 'input-barcode-add'}
						aria-label="Thêm mã đã nhập"
						onclick={() => {
							addBarcode(barcodeInput);
							barcodeInput = '';
						}}
					>
						<Icon icon="lucide:plus" class="input-barcode-icon" />
					</Button>
				</span>
			{/if}
		</div>
		{#if (codes?.length ?? 0) > 0 || selectAllOnDerived}
			<div class="input-file-previews-head" data-test="input-barcode-list-head">
				{#if hasCodeSelection}
					<span class="input-file-selected-count" aria-live="polite">
						Đã chọn {selectedCodes.length}/{codes?.length ?? 0} mã
					</span>
				{:else}
					<span class="input-file-count" aria-live="polite">{codes?.length ?? 0} mã</span>
				{/if}
				<!-- Yêu cầu (3) + giữ hành vi prop gốc: Có tick card (selectDeleteOn)
				     → clear-all hiện khi selected ≥2, click CHỈ XÓA PHẦN ĐÃ CHỌN;
				     KHÔNG có tick card → selection không thể tồn tại → clear-all là
				     nút "Xóa tất cả" nghĩa đen (hành vi prop gốc, luôn hiện khi có mã).
				     Quickbar (selected ≥1) ẨN khi clear-all hiển thị → không trùng nút. -->
				<!-- Select-all (chọn tất cả) — cần cả selectAllButtonOn + selectDeleteOn
				     (chế độ selection — không tick card thì không có gì để "chọn tất cả")
				     và ≥2 mã selectable (dưới 2 nút vô nghĩa). Đặt CẠNH clear-all trong
				     head list, cùng phong cách ghost-xs. all → label đổi "Bỏ chọn tất cả"
				     (indeterminate hiển thị qua count "Đã chọn X/Y" phía trái, nút nhấn =
				     aria-pressed). -->
				{#if selectAllButtonOnDerived && selectDeleteOnDerived && !configs.disabled && (codes?.length ?? 0) >= 2}
					<!-- Wrapper span data-test hook DOM (Button không spread props) -->
					<span data-test="input-barcode-select-all" class="input-barcode-action-hook">
						<Button
							variant="ghost"
							color="default"
							size="xs"
							class="input-barcode-selectall-btn"
							aria-label={allCodesSelected ? 'Bỏ chọn tất cả mã' : 'Chọn tất cả mã'}
							onclick={toggleAllCodesSelected}
						>
							<Icon icon={allCodesSelected ? 'lucide:x' : 'lucide:check-check'} class="input-barcode-icon" />
							<span>{allCodesSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</span>
						</Button>
					</span>
				{/if}
				{#if selectAllOnDerived && (selectDeleteOnDerived ? codeSelectionMulti : (codes?.length ?? 0) > 0)}
					<!-- Wrapper span data-test hook DOM (Button không spread props) -->
					<span data-test="input-barcode-clear-all" class="input-barcode-action-hook">
						<Button
							variant="ghost"
							color="error"
							size="xs"
							class="input-file-clear-all input-barcode-clear-all-btn"
							aria-label={selectDeleteOnDerived ? 'Xóa các mã đã chọn' : 'Xóa tất cả mã'}
							onclick={clearAllCodes}
						>
							<Icon icon="lucide:x" class="input-barcode-icon" />
							<span>
								{selectDeleteOnDerived ? `Xóa ${selectedCodes.length} mã đã chọn` : 'Xóa tất cả'}
							</span>
						</Button>
					</span>
				{/if}
			</div>
		{/if}
		<!-- Quickbar khi có selection (selected ≥1). Khi clear-all đang hiển thị
		     (selectAllOn + selected ≥2) thì ẩn quickbar để không trùng nút xóa —
		     nhưng nếu KHÔNG có selectAllOn thì clear-all không render → giữ nguyên
		     quickbar, nếu không sẽ mất nút xóa hàng loạt (regression IB4). -->
		{#if hasCodeSelection && !(selectAllOnDerived && codeSelectionMulti)}
			<div class="input-file-quickbar" data-test="input-barcode-quickbar" role="toolbar" aria-label="Hành động mã đã chọn">
				<span data-test="input-barcode-quickbar-delete" class="input-barcode-action-hook">
					<Button
						variant="outline"
						color="error"
						size="xs"
						class="input-file-quickbar-delete"
						onclick={removeSelectedCodes}
					>
						<Icon icon="lucide:trash-2" class="input-barcode-icon" />
						Xóa {selectedCodes.length} mã đã chọn
					</Button>
				</span>
			</div>
		{/if}
		{#if (codes?.length ?? 0) > 0}
			<ul class="input-barcode-list">
				{#each codes ?? [] as raw, i (i)}
					<li
						class="input-barcode-card"
						class:input-barcode-selected={selectedCodes.includes(raw)}
						class:input-barcode-dup-flash={dupFlashCode === raw}
						data-test="input-barcode-card"
					>
						{@render barcodeCard(i, raw)}
					</li>
				{/each}
			</ul>
		{/if}
		{#if scanOpen}
			<!-- Overlay camera inline (KHÔNG Modal) — video + khung scan + detect loop.
			     Multiple detect → freeze frame canvas + bounding box regions click chọn
			     (label divided top hiển thị giá trị). Mode 'import' (ảnh tĩnh):
			     KHÔNG video/frame/pause — canvas freeze hiển thị ảnh import + regions. -->
			<div
				class="input-barcode-overlay"
				data-test="input-barcode-overlay"
				bind:this={overlayEl}
				role="dialog"
				aria-modal="true"
				aria-label={scanMode === 'import' ? 'Chọn mã trong ảnh đã nhập' : 'Quét mã bằng camera'}
			>
				{#if scanMode !== 'import'}
					<video
						class="input-barcode-video"
						bind:this={videoEl}
						playsinline
						muted
					></video>
				{/if}
				<canvas class="input-barcode-freeze" bind:this={canvasEl} class:input-barcode-freeze-on={scanFrozen}></canvas>
				{#if !scanFrozen && scanMode !== 'import'}
					<div class="input-barcode-frame" aria-hidden="true"></div>
				{/if}
				{#if importBusy && scanMode === 'import'}
					<div class="input-barcode-hint" data-test="input-barcode-import-busy">Đang nhận diện mã…</div>
				{/if}
				{#if scanError}
					<div class="input-barcode-scan-error" data-test="input-barcode-scan-error" role="alert">{scanError}</div>
				{/if}
				{#if scanFrozen}
					<div class="input-barcode-hint" data-test="input-barcode-hint">
						Phát hiện {scanResults.length} mã — bấm vào mã cần chọn
					</div>
					{#each scanResults as r, ri (ri)}
						<button
							type="button"
							class="input-barcode-region"
							data-test="input-barcode-region"
							style={boxStyle(r)}
							aria-label={`Chọn mã ${r.rawValue}`}
							onclick={() => pickScanResult(r)}
						>
							<span class="input-barcode-region-label">{r.rawValue}</span>
						</button>
					{/each}
				{/if}
				<!-- Nút pause/resume (Yêu cầu 5) + close — Button component, góc trên
				     phải cạnh nhau. Pause dừng detect loop GIỮ stream + video; resume
				     chạy lại interval. Mode 'import' KHÔNG pause (ảnh tĩnh 1 lần). -->
				<div class="input-barcode-overlay-actions">
					<!-- Wrapper span data-test hook DOM (Button không spread props) -->
					{#if scanMode !== 'import'}
						<span data-test="input-barcode-overlay-pause" class="input-barcode-action-hook">
							<Button
								variant="ghost"
								color="default"
								size="sm"
								aspect-square
								rounded="full"
								class="input-barcode-overlay-btn"
								aria-label={scanPaused ? 'Tiếp tục quét' : 'Tạm dừng quét'}
								onclick={toggleScanPause}
							>
								{#if scanPaused}
									<Icon icon="lucide:play" class="input-barcode-icon" />
								{:else}
									<Icon icon="lucide:pause" class="input-barcode-icon" />
								{/if}
							</Button>
						</span>
					{/if}
					<span data-test="input-barcode-overlay-close" class="input-barcode-action-hook">
						<Button
							variant="ghost"
							color="default"
							size="sm"
							aspect-square
							rounded="full"
							class="input-barcode-overlay-btn"
							aria-label="Đóng camera"
							onclick={closeScan}
						>
							<Icon icon="lucide:x" class="input-barcode-icon" />
						</Button>
					</span>
				</div>
			</div>
		{/if}
	{:else if configs.type == 'number'}
		<div class={configs.input.number.style}>
			<input
				type="text"
				bind:value
				bind:this={configs.input.number.ref}
				class="bg-transparent outline-none border-none w-full"
				placeholder={placeholderDerived}
				readonly={client.browser?.isMobile}
				inputmode={client.browser?.isMobile ? 'none' : undefined}
				id={inputId}
				{@attach handleEvents(configs.input.number.event)}
			/>
			{#if client.browser?.isMobile && visualCursorVisible}
				<!-- Fix #5: visual caret currency — offset symbol đã gộp trong visualCursorLeft -->
				<div
					class="input-visual-cursor"
					data-test="input-visual-cursor"
					style:left={`${visualCursorLeft}px`}
				></div>
			{/if}
		</div>
	{:else if configs.type == 'currency'}
		<!-- type='currency': symbol = span RIÊNG ngoài input (prefix/suffix) —
		     luôn hiển thị, không nằm trong value. value = chuỗi raw người dùng
		     nhập (số hoặc biểu thức), autoFormat live nhóm nghìn theo locale. -->
		<div class={configs.input.currency.style}>
			{#if currencySymbolPositionDerived == 'prefix'}
				<span class="input-currency-symbol" data-test="input-currency-symbol" aria-hidden="true">{currencySymbolDerived}</span>
			{/if}
			<input
				type="text"
				bind:value
				bind:this={configs.input.currency.ref}
				class="bg-transparent outline-none border-none w-full"
				placeholder={placeholderDerived}
				readonly={client.browser?.isMobile}
				inputmode={client.browser?.isMobile ? 'none' : undefined}
				id={inputId}
				{@attach handleEvents(configs.input.currency.event)}
			/>
			{#if currencySymbolPositionDerived == 'suffix'}
				<span class="input-currency-symbol" data-test="input-currency-symbol" aria-hidden="true">{currencySymbolDerived}</span>
			{/if}
			{#if client.browser?.isMobile && visualCursorVisible}
				<!-- Fix #5: visual caret currency — offset theo prefix symbol (nếu có) -->
				<div
					class="input-visual-cursor"
					data-test="input-visual-cursor"
					style:left={`${visualCursorLeft}px`}
				></div>
			{/if}
		</div>
	{:else}
		<div class="input-highlight-wrapper">
			{#if highlightSegmentsDerived && configs.type !== 'password'}
				<div
					class="input-highlight-layer"
					aria-hidden="true"
					{@attach (node) => {
						// Sync scroll position from input to highlight layer
						const inputKey = configs.type === 'email' || configs.type === 'phone' ? configs.type : 'text';
						const inputRef = configs.input[inputKey]?.ref as HTMLInputElement | undefined;
						if (!inputRef) return;
						const onScroll = () => { node.scrollLeft = inputRef.scrollLeft; };
						inputRef.addEventListener('scroll', onScroll);
						return () => inputRef.removeEventListener('scroll', onScroll);
					}}
				>
					{#each highlightSegmentsDerived as seg}
						{#if seg.isMatch}
							<mark class="input-highlight-mark">{seg.text}</mark>
						{:else}
							<span>{seg.text}</span>
						{/if}
					{/each}
					<!-- whitespace char to preserve height when empty -->
					&#x200B;
				</div>
			{/if}
			<input
				type={configs.type == 'password' ? (configs.input.password.showPassword ? 'text' : 'password') : (configs.type == 'email' ? 'email' : configs.type == 'phone' ? 'tel' : 'text')}
				bind:value
				bind:this={configs.input[configs.type == 'password' || configs.type == 'email' || configs.type == 'phone' ? configs.type : 'text'].ref}
				class={[
					...( configs.input[configs.type == 'password' || configs.type == 'email' || configs.type == 'phone' ? configs.type : 'text'].style ?? []),
					highlightSegmentsDerived && configs.type !== 'password' ? 'input-transparent-text' : '',
											'bg-transparent outline-none border-none w-full',
						((configs.actionButtons.clear.display && value) || configs.actionButtons.copy.display || configs.type == 'password') ? 'pr-10' : ''
				]}
				placeholder={placeholderDerived}
				autocomplete={props.autocomplete ?? 'off' as FullAutoFill}
				inputmode={inputModeDerived}
				name={nameDerived}
					id={inputId}
				onkeydown={(e) => {
						handleEmailKeydown(e);
						handlePhoneKeydown(e);
					}}
				{@attach handleEvents(configs.input[configs.type == 'password' || configs.type == 'email' || configs.type == 'phone' ? configs.type : 'text'].event)}
			/>
		</div>
	{/if}
	{#if configs.maxLength && configs.type == 'text'}
		<div class="input-max-length">{value?.length ?? 0}/{configs.maxLength}</div>
	{/if}

	<div class="input-group-actions">
		{#if value}
			<!-- Clear button - FIRST priority when value exists -->
			{#if configs.actionButtons.clear.display}
				{#if configs.loading}
					<div class="input-loading-indicator p-1!" aria-live="polite" aria-label="Validating...">
						<svg class="spinner" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
							<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25" />
							<path
								d="M12 2C12 2 12 4 12 4"
								stroke="currentColor"
								stroke-width="3"
								stroke-linecap="round"
								stroke-dasharray="12 24"
								stroke-dashoffset="0"
							>
								<animateTransform
									attributeName="transform"
									type="rotate"
									from="0 12 12"
									to="360 12 12"
									dur="1s"
									repeatCount="indefinite"
								/>
							</path>
						</svg>
					</div>
				{:else}
					<Button
						bind:this={configs.actionButtons.clear.component}
						icon={iconify['close-rounded']}
						size="xs"
						aspect-square
						events={configs.actionButtons.clear.event}
						class="input-clear p-1!"
						color="error"
						variant="ghost"
					/>
				{/if}
			{/if}

			<!-- Copy button when value exists -->
			{#if configs.actionButtons.copy.display}
				<Button
					icon={configs.actionButtons.copy.status.copied
						? iconify['check-rounded']
						: iconify['content-copy-outline-rounded']}
					class="input-copy p-1!"
					size="xs"
					aspect-square
					color="success"
					events={configs.actionButtons.copy.event}
					disabled={configs.actionButtons.copy.status.copied ||
						value ==
							client.browser?.clipboard?.get(
								[...(client.browser?.clipboard?.keys() ?? [])].sort(
									(timeA, timeB) => timeB - timeA
								)[0]
							)}
				/>
			{/if}
		{:else if !value && client.browser?.clipboard?.size && configs.actionButtons.paste.display}
			<!-- Paste button when no value and clipboard available -->
			<Button
				icon={configs.actionButtons.copy.status.copied
					? iconify['check-rounded']
					: iconify['content-paste-rounded']}
				class="input-paste p-1!"
				size="xs"
				aspect-square
				color="success"
				events={configs.actionButtons.paste.event}
				disabled={configs.actionButtons.paste.status.pasted}
			/>
		{/if}

		<!-- Password show/hide - LAST -->
		{#if configs.type == 'password'}
			<Button
				icon={configs.input.password.showPassword
					? iconify['password-2-off-rounded']
					: iconify['password-2-rounded']}
				class="p-1! opacity-70 hover:opacity-100 transition-opacity"
				events={configs.actionButtons.showPassword.event}
				size="xs"
				variant="ghost"
				aspect-square
			/>
		{/if}
	</div>

	{#if props.trailing}
		{@render props.trailing({
			defaultStyles: configs.trailing.style,
			get size() {
				return configs.size;
			}
		})}
	{/if}

	{#if emailSuggestionsOpen && matchingEmailDomains.length > 0}
		<div
			class="email-suggestions-popup"
			role="listbox"
			aria-label="Email domain suggestions"
			tabindex="0"
			onfocus={() => {
				suggestionsFocusHeld = true;
				isInteractingWithSuggestions = true;
			}}
			onblur={() => {
				suggestionsFocusHeld = false;
				if (!configs?.status?.focus && !configs?.input?.status?.focus) {
					isInteractingWithSuggestions = false;
				}
			}}
			onpointerenter={() => {
				isInteractingWithSuggestions = true;
			}}
			onpointerleave={() => {
				isInteractingWithSuggestions = false;
				if (!configs?.status?.focus && !configs?.input?.status?.focus) {
					suggestionsFocusHeld = false;
				}
			}}
			onpointerdown={(e) => {
				e.stopPropagation();
			}}
			onmousedown={(e) => {
				e.stopPropagation();
			}}
			onclick={(e) => {
				e.stopPropagation();
			}}
			onkeydown={(e) => {
				if (e.key === 'ArrowDown') {
					e.preventDefault();
					e.stopPropagation();
					emailHighlightedIndex = (emailHighlightedIndex + 1) % matchingEmailDomains.length;
				} else if (e.key === 'ArrowUp') {
					e.preventDefault();
					e.stopPropagation();
					emailHighlightedIndex =
						(emailHighlightedIndex - 1 + matchingEmailDomains.length) % matchingEmailDomains.length;
				} else if (e.key === 'Enter' || e.key === 'Tab') {
					e.preventDefault();
					e.stopPropagation();
					const chosen = matchingEmailDomains[emailHighlightedIndex] ?? matchingEmailDomains[0];
					if (chosen) {
						selectEmailDomain(chosen);
					}
				} else if (e.key === 'Escape') {
					e.preventDefault();
					e.stopPropagation();
					emailSuggestionsDismissed = true;
				}
			}}
		>
			<div class="email-suggestions-header">
				<span>Gợi ý domain</span>
			</div>
			<div class="email-suggestions-list">
				{#each matchingEmailDomains as domain, idx (domain)}
					<button
						type="button"
						role="option"
						aria-selected={emailHighlightedIndex === idx}
						class="email-suggestion-item {emailHighlightedIndex === idx ? 'active' : ''}"
						onpointerdown={(e) => {
							e.preventDefault();
							e.stopPropagation();
							selectEmailDomain(domain);
						}}
						onmousedown={(e) => {
							e.preventDefault();
							e.stopPropagation();
							selectEmailDomain(domain);
						}}
						onclick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							selectEmailDomain(domain);
						}}
						ontouchstart={(e) => {
							e.preventDefault();
							e.stopPropagation();
							selectEmailDomain(domain);
						}}
						onmouseenter={() => {
							emailHighlightedIndex = idx;
						}}
					>
						<span class="email-suggestion-icon">@</span>
						<span class="email-suggestion-text">
							<span class="email-suggestion-prefix">{emailPartsDerived?.prefix ?? ''}@</span>
							<span class="email-suggestion-match">{emailPartsDerived?.query ?? ''}</span>
							<span class="email-suggestion-rest">{domain.slice(emailPartsDerived?.query.length ?? 0)}</span>
						</span>
						{#if emailHighlightedIndex === idx}
							<span class="email-suggestion-hint">Tab ↵</span>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	{/if}

		{#if phoneSuggestionsOpen && matchingPhoneCountries.length > 0}
			<div
				class="phone-suggestions-popup"
				role="listbox"
				aria-label="Phone country code suggestions"
				tabindex="0"
				onfocus={() => {
					phoneSuggestionsFocusHeld = true;
					isInteractingWithPhoneSuggestions = true;
				}}
				onblur={() => {
					phoneSuggestionsFocusHeld = false;
					if (!configs?.status?.focus && !configs?.input?.status?.focus) {
						isInteractingWithPhoneSuggestions = false;
					}
				}}
				onpointerenter={() => {
					isInteractingWithPhoneSuggestions = true;
				}}
				onpointerleave={() => {
					isInteractingWithPhoneSuggestions = false;
					if (!configs?.status?.focus && !configs?.input?.status?.focus) {
						phoneSuggestionsFocusHeld = false;
					}
				}}
				onpointerdown={(e) => {
					e.stopPropagation();
				}}
				onmousedown={(e) => {
					e.stopPropagation();
				}}
				onclick={(e) => {
					e.stopPropagation();
				}}
				onkeydown={(e) => {
					if (e.key === 'ArrowDown') {
						e.preventDefault();
						e.stopPropagation();
						phoneHighlightedIndex = (phoneHighlightedIndex + 1) % matchingPhoneCountries.length;
					} else if (e.key === 'ArrowUp') {
						e.preventDefault();
						e.stopPropagation();
						phoneHighlightedIndex =
							(phoneHighlightedIndex - 1 + matchingPhoneCountries.length) % matchingPhoneCountries.length;
					} else if (e.key === 'Enter' || e.key === 'Tab') {
						e.preventDefault();
						e.stopPropagation();
						const chosen = matchingPhoneCountries[phoneHighlightedIndex] ?? matchingPhoneCountries[0];
						if (chosen) {
							selectPhoneCountry(chosen);
						}
					} else if (e.key === 'Escape') {
						e.preventDefault();
						e.stopPropagation();
						phoneSuggestionsDismissed = true;
					}
				}}
			>
				<div class="phone-suggestions-header">
					<span>Chọn mã quốc gia</span>
				</div>
				<div class="phone-suggestions-list">
					{#each matchingPhoneCountries as country, idx (country.code)}
						<button
							type="button"
							role="option"
							aria-selected={phoneHighlightedIndex === idx}
							class="phone-suggestion-item {phoneHighlightedIndex === idx ? 'active' : ''}"
							onpointerdown={(e) => {
								e.preventDefault();
								e.stopPropagation();
								selectPhoneCountry(country);
							}}
							onmousedown={(e) => {
								e.preventDefault();
								e.stopPropagation();
								selectPhoneCountry(country);
							}}
							onclick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								selectPhoneCountry(country);
							}}
							ontouchstart={(e) => {
								e.preventDefault();
								e.stopPropagation();
								selectPhoneCountry(country);
							}}
							onmouseenter={() => {
								phoneHighlightedIndex = idx;
							}}
						>
							<span class="phone-suggestion-flag">{getCountryFlag(country.code)}</span>
							<span class="phone-suggestion-info">
								<span class="phone-suggestion-code">{country.code}</span>
								<span class="phone-suggestion-name">{country.name}</span>
							</span>
							<span class="phone-suggestion-format">{country.format}</span>
							{#if phoneHighlightedIndex === idx}
								<span class="phone-suggestion-hint">Tab ↵</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		{/if}
</svelte:element>

<style lang="scss">
	@use './styles.scss';
</style>
