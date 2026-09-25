<script lang="ts">
	//$components/form/input/Main.svelte
	import { iconify } from '$assets/icons/iconify';
	import { Button, Icon } from '$components/element';
	import { measureTextWidth, styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { onDestroy, onMount, untrack, type SvelteComponent } from 'svelte';
	import type {
		InputConfigs,
		InputProps,
		NumberKeyAllowed,
		ValidationCompact,
		ValidationFull
	} from './_interface';
	import type { ButtonConfigs } from '$components/element/button/_interface';
	import {
		text_keys_allowed,
		number_keys_allowed,
		defaultValidation,
		createDefaultInputEvents
	} from '.';
	import type { BasicConfigs, EventListener } from '$components/interface';
	import { SvelteMap } from 'svelte/reactivity';
	import { ensureKeyboardHost } from '$modules/keyboardHost.svelte';
	import { browser } from '$app/environment';
	import { getFormContext } from '../form';
	import { getTextFieldContext } from '../textField';
	import type { FullAutoFill } from 'svelte/elements';

	let { value = $bindable(), disabled = $bindable(), ...props }: InputProps = $props();
	// Ghi nhớ giá trị ban đầu khi component được tạo ra, dùng để reset về đúng mốc ban đầu
	let _initialValue: string | undefined = value;

	// Generate unique ID for label association if not provided
	const inputId = $derived(props.id ?? (textFieldContext?.name ? `field-${textFieldContext.name}` : undefined));
	const typeDerived = $derived(props.type ?? 'text');
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

	const colorDerived = $derived.by(() => {
		// Ưu tiên props.color nếu được set explicitly
		if (props.color) return props.color;

		// Khi đang loading (realtime check) → trả về default (màu trung tính)
		// Check both external loading prop and internal validation loading state
		if (props.loading || configs?.loading) return 'default';

		if (props.validation || requiredDerived || typeDerived == 'email') {
			const isValid = configs?.validation?.isValid;
			if (isValid == 'pending') return 'default';
			// Trường rỗng chưa từng validate (chưa blur nên chưa có process) → màu trung tính,
			// tránh hiển thị error đỏ ngay khi mount (regression: color-error mặc định)
			if (!isValid && !configs?.validation?.process && !value) return 'default';
			return isValid ? 'success' : 'error';
		}
		return 'default';
	});

	const requiredDerived = $derived(props.required ?? textFieldContext?.required);

	let _disabled: undefined | boolean = $state(undefined);
	// Visual number keyboard cleanup — gán ở showVisualNumberKb(), gọi ở window mousedown (không cần reactive)
	let visualNumberKbCleaner: (() => void) | undefined;
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
	const isFocused = $derived(!!(configs?.status?.focus || configs?.input?.status?.focus));

	const emailSuggestionsOpen = $derived(
		emailSuggestEnabled &&
		!emailSuggestionsDismissed &&
		(isFocused || isInteractingWithSuggestions) &&
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
		(isFocused || isInteractingWithPhoneSuggestions) &&
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
		const currentValue = value;
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
						inputRef.setSelectionRange(value.length, value.length);
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
		}
	});

	let configs: InputConfigs = $state({
		status: {
			get changed() {
				// So sánh giá trị hiện tại vs mốc ban đầu (closure _initialValue,
				// chuẩn hóa undefined thành ''): false → pristine, true → dirty.
				// Button submit disabled-logic và Form.status.changed đọc getter này
				// qua formContext.childrens — Input đăng ký vào childrens nhưng trước
				// đây không có changed → form chỉ chứa Input bị coi là pristine vĩnh viễn
				// (submit disabled dù đã nhập dữ liệu).
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
		validation: {
			get isValid() {
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
					const val = configs.value ?? '';
					return val.trim().length > 0;
				}

				// Optional field with no validation process yet - consider valid
				return true;
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
						) ?? [])
					] as InputConfigs['input']['text']['event'];
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
									ev.preventDefault();
									let index: number | undefined;
									if (!value || !configs.input.number.ref) {
										index = 1;
									} else {
										index = calculatorCursor(e as MouseEvent, value, configs.input.number.ref);
									}
									configs.status.currentCursor = index ?? value?.length ?? 1;
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
											configs.status.focus = false;
											if (visualNumberKbCleaner) visualNumberKbCleaner();
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
			currency: {}
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
							async load(e, data) {
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
								e.preventDefault();
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
			if (client.browser?.isMobile) {
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
			configs.validation.process = undefined;
			configs.validation.messages = undefined;
			if (configs.timeId) {
				for (const id of configs.timeId.values()) clearTimeout(id);
				configs.timeId.clear();
			}
			configs.loading = false;
			configs.status.focus = false;
			configs.input.status.focus = false;
			if (configs.ref) {
				configs.ref.classList.remove('validation-loading');
			}
		}
	});
	const formContext = getFormContext();
	const textFieldContext = getTextFieldContext();

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
		if (!props.validation && !configs.required && configs.type !== 'email') return;
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
							if (typeof validateHandler == 'function') {
								isValid = validateHandler;
								result = await isValid(untrack(() => value));
							} else {
								isValid = validateHandler.isValid;
								result = await isValid(untrack(() => value));
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
					if (configs.ref && configs.validation.isValid != 'pending') {
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
		document.body.append(mirroEl);
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
		const target = {
			get value() {
				return value;
			},
			set value(v: string | undefined) {
				value = v; // gán thẳng vào biến $bindable(), Svelte tự lo phần reactivity
			},
			ref: configs.input.number.ref as HTMLInputElement,
			maxLength: configs.maxLength
		};
		visualNumberKbCleaner = ensureKeyboardHost(target);
	}
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
					configs.status.mousePos = { clientX: e.clientX, clientY: e.clientY };
					
					const target = e.target as HTMLElement;
					const type = configs.type as 'text' | 'email' | 'password' | 'number' | 'phone';
					const ref = configs.input[type]?.ref as HTMLElement | undefined;
					
					if (target !== ref) {
						e.preventDefault();
					}

					if (e.detail == 1) {
						if (
							configs.type === 'number' &&
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
								if (configs.type === 'number' && client.browser?.isMobile) {
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
		} else if (configs.type === 'email' && defaultValidation.isEmail) {
			validators.push(defaultValidation.isEmail(configs.name));
		}
		return validators;
	}
	let prevFocus: boolean | undefined;
	$effect(() => {
		if (!configs.ref) return;
		const focus = configs.status.focus;
		if (focus !== undefined && focus !== prevFocus) {
			configs.ref.dispatchEvent(new Event(focus ? 'focus' : 'blur'));
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
		// Sync configs.value with bound value prop for validation getter
		if (configs.value !== value) {
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

	onMount(() => {
		if (textFieldContext) {
			if (!textFieldContext.children) textFieldContext.children = {};
			textFieldContext.children.input = configs;
		}
		// Register this Input with the Form context for validation
		if (formContext) {
			if (!formContext.childrens) formContext.childrens = new SvelteSet();
			formContext.childrens.add(configs);
		}
	});
	onDestroy(() => {
		value = undefined;
		if (configs.type == 'password') configs.input.password.value = undefined;
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
	{#if configs.type == 'number'}
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
			{#if client.browser?.isMobile}
				<div class="input-visual-cursor"></div>
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
				type={configs.type == 'password' ? (configs.input.password.showPassword ? 'text' : 'password') : (configs.type == 'email' || configs.type == 'phone' ? configs.type : 'text')}
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
				inputmode={props.inputmode}
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
		{#if !value && client.browser?.clipboard?.size && configs.actionButtons.paste.display}
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
		{:else if value}
			{#if configs.actionButtons.clear.display}
				{#if configs.loading}
					<!-- Loading indicator during validation/realtime check -->
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
		{/if}
		{#if configs.type == 'password'}
			<Button
				icon={configs.input.password.showPassword
					? iconify['password-2-off-rounded']
					: iconify['password-2-rounded']}
				class="p-1!"
				events={configs.actionButtons.showPassword.event}
				size="xs"
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
