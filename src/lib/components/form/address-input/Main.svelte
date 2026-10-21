<script lang="ts">
	// src\lib\components\form\address-input\Main.svelte
	// AddressInput — nhập địa chỉ VN với auto complete nhận dạng chuỗi:
	// 1) ô text nhập địa chỉ chi tiết (số nhà, tên đường...)
	// 2) gõ chuỗi địa chỉ đầy đủ → gợi ý nhận dạng Tỉnh/Thành + Quận/Huyện
	//    (+ Phường/Xã) từ data tĩnh VN (vn-geo.json + vn-geo-wards.json)
	//    → chọn qua select/option
	// 3) 3 Select cascading: chọn Tỉnh → lọc Quận/Huyện → lọc Phường/Xã
	// Tái sử dụng: Input (text), Select (tỉnh/huyện/ward) — import trực tiếp (tránh circular barrel)
	import Input from '../input/Main.svelte';
	import Select from '../select/Main.svelte';
	import type { AddressInputProps, AddressBreakdown } from './_interface';

	let { value = $bindable(''), breakdown = $bindable({ province: '', district: '' }), label = '', placeholder, disabled = false }: AddressInputProps = $props();

	interface GeoProvince { n: string; c: number; d: { n: string; c: number }[] }
	/** wards: key 'Tên tỉnh|code' → { 'Tên huyện': ['Phường A', 'Xã B'...] } */
	type WardMap = Record<string, Record<string, string[]>>;
	let provinces = $state<GeoProvince[]>([]);
	let wardMap = $state<WardMap>({});
	let geoLoaded = $state(false);

	// Load data địa chỉ 1 lần (lazy — fetch static file; geo 27KB + wards 208KB)
	$effect(() => {
		if (geoLoaded) return;
		geoLoaded = true;
		Promise.all([
			fetch('/data/vn-geo.json').then((r) => r.json() as Promise<GeoProvince[]>),
			fetch('/data/vn-geo-wards.json').then((r) => r.json() as Promise<WardMap>)
		])
			.then(([g, w]) => {
				provinces = g;
				wardMap = w;
			})
			.catch(() => {
				// data tĩnh — lỗi chỉ mất gợi ý, không chặn nhập tay
			});
	});

	const provinceOptions = $derived(provinces.map((p) => ({ value: p.n, label: p.n })));
	const selectedProvince = $derived(provinces.find((p) => p.n === breakdown.province));
	const districtOptions = $derived((selectedProvince?.d ?? []).map((d) => ({ value: d.n, label: d.n })));
	/** wards của tỉnh đang chọn (khớp qua key 'tên|code') */
	const provinceWards = $derived(
		breakdown.province ? wardMap[`${breakdown.province}|${selectedProvince?.c ?? ''}`] ?? {} : {}
	);
	const wardOptions = $derived((provinceWards[breakdown.district] ?? []).map((w) => ({ value: w, label: w })));

	// Auto nhận dạng: quét chuỗi value tìm tên tỉnh/huyện khớp (word-boundary)
	function detectFromText(raw: string): AddressBreakdown | null {
		const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
		const text = ` ${norm(raw)} `;
		if (text.trim().length < 4) return null;
		// match name ở ranh giới từ (tránh "hue" ăn trong "nguyen hue")
		const hasWord = (name: string, hay: string) => hay.includes(` ${name} `) || hay.includes(`, ${name} `) || hay.includes(`. ${name} `);
		// quét ward trước (cụ thể nhất) — chỉ trong tỉnh/huyện đã breakdown (tránh quét 10k ward)
		if (breakdown.province && breakdown.district) {
			const ws = provinceWards[breakdown.district] ?? [];
			for (const w of ws) {
				const wn = norm(w);
				const wnBare = wn.replace(/^(phuong|xa|thi tran)\s+/, '');
				if (wnBare.length >= 3 && hasWord(wnBare, text)) return { province: breakdown.province, district: breakdown.district, ward: w };
				if (wnBare.length < 3 && hasWord(wn, text)) return { province: breakdown.province, district: breakdown.district, ward: w };
			}
		}
		// quét huyện trước (cụ thể hơn), mỗi huyện có province_code để suy ra tỉnh
		for (const p of provinces) {
			for (const d of p.d) {
				const dn = norm(d.n);
				// bỏ prefix loại hành chính để match "Ba Đình" như "Q. Ba Đình"/"quận ba đình"
				const dnBare = dn.replace(/^(thanh pho|quan|huyen|thi xa|thi tran|tp|q|h)\s+/, '');
				// bare ngắn (vd "1", "7") chỉ match khi có kèm prefix loại hành chính
				if (dnBare.length >= 3 && hasWord(dnBare, text)) return { province: p.n, district: d.n };
				if (dnBare.length < 3 && hasWord(dn, text)) return { province: p.n, district: d.n };
			}
		}
		for (const p of provinces) {
			const pn = norm(p.n);
			const pnBare = pn.replace(/^(thanh pho|tinh|tp)\s+/, '');
			if (pnBare.length >= 3 && hasWord(pnBare, text)) return { province: p.n, district: '' };
			if (pnBare.length < 3 && hasWord(pn, text)) return { province: p.n, district: '' };
		}
		return null;
	}

	// Gợi ý nhận dạng hiện tại (chưa áp — user bấm để áp)
	let suggestion = $state<AddressBreakdown | null>(null);
	let lastSuggestedText = $state('');

	// Gõ xong (debounce 400ms) → auto detect → nếu breakdown trống thì gợi ý
	let detectTimer: ReturnType<typeof setTimeout> | undefined;
	function onAddressInput() {
		clearTimeout(detectTimer);
		detectTimer = setTimeout(() => {
			if (!value || value.length < 4) {
				suggestion = null;
				return;
			}
			if (value === lastSuggestedText) return;
			const hit = detectFromText(value);
			if (hit) {
				// tỉnh/huyện/ward đã khớp sẵn thì áp luôn, không cần gợi ý
				if (
					breakdown.province === hit.province &&
					(hit.district === '' || breakdown.district === hit.district) &&
					(!hit.ward || breakdown.ward === hit.ward)
				) {
					suggestion = null;
					return;
				}
				suggestion = hit;
				lastSuggestedText = value;
			} else {
				suggestion = null;
			}
		}, 400);
	}

	function applySuggestion() {
		if (!suggestion) return;
		breakdown = { ...suggestion };
		suggestion = null;
	}

	// Chọn tỉnh → xoá huyện/ward nếu không còn thuộc tỉnh mới
	function onProvinceChange(v: string | string[]) {
		if (typeof v !== 'string') return;
		if (v !== breakdown.province) breakdown = { province: v, district: '', ward: '' };
	}

	// Chọn huyện → xoá ward nếu không còn thuộc huyện mới
	function onDistrictChange(v: string | string[]) {
		if (typeof v !== 'string') return;
		breakdown = { ...breakdown, district: v, ward: '' };
	}
</script>

<div class="address-input" class:address-input--disabled={disabled}>
	{#if label}
		<span class="address-input__label">{label}</span>
	{/if}
	<div class="address-input__text">
		<Input
			type="text"
			bind:value
			{placeholder}
			{disabled}
			events={[{ events: { input: () => onAddressInput() } }]}
		/>
	</div>
	{#if suggestion}
		<button type="button" class="address-input__suggestion" onclick={applySuggestion}>
			<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
				<path d="M20 6L9 17l-5-5"></path>
			</svg>
			<span>Phát hiện: <strong>{suggestion.ward ? `${suggestion.ward}, ` : ''}{suggestion.district ? `${suggestion.district}, ` : ''}{suggestion.province}</strong> — bấm để áp dụng</span>
		</button>
	{/if}
	<div class="address-input__selects">
		<div class="address-input__field">
			<span class="address-input__sub">Tỉnh/Thành phố</span>
			<Select
				options={provinceOptions}
				bind:value={breakdown.province}
				onValueChange={onProvinceChange}
				searchable
				clearable
				placeholder="Chọn tỉnh/thành phố"
				disabled={disabled}
			/>
		</div>
		<div class="address-input__field">
			<span class="address-input__sub">Quận/Huyện</span>
			<Select
				options={districtOptions}
				bind:value={breakdown.district}
				onValueChange={onDistrictChange}
				searchable
				clearable
				placeholder="Chọn quận/huyện"
				disabled={disabled}
			/>
		</div>
		<div class="address-input__field">
			<span class="address-input__sub">Phường/Xã</span>
			<Select
				options={wardOptions}
				bind:value={breakdown.ward}
				searchable
				clearable
				placeholder="Chọn phường/xã"
				disabled={disabled || !breakdown.district}
			/>
		</div>
	</div>
</div>

<style lang="scss">
	/* không @use sizes.scss — nhặt cả framework classes (.size-*) thành unused CSS;
	   token --font-size đã resolve từ :root của app */

	.address-input {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;

		&--disabled {
			opacity: 0.6;
			pointer-events: none;
		}
	}

	.address-input__label {
		font-size: var(--font-size, 0.875rem);
		font-weight: 500;
	}

	.address-input__text {
		min-width: 0;

		& :global(.input-root) {
			width: 100%;
		}
	}

	.address-input__suggestion {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.625rem;
		font-size: 0.8125rem;
		color: var(--primary-600, var(--primary));
		background: color-mix(in oklab, var(--primary) 8%, transparent);
		border: 1px solid color-mix(in oklab, var(--primary) 30%, transparent);
		border-radius: 0.5rem;
		cursor: pointer;
		text-align: left;
		transition: background 0.15s ease;

		&:hover {
			background: color-mix(in oklab, var(--primary) 14%, transparent);
		}
	}

	.address-input__selects {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;

		@media (max-width: 640px) {
			grid-template-columns: 1fr;
		}
	}

	.address-input__field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;

		& :global(.select-trigger) {
			width: 100%;
		}
	}

	.address-input__sub {
		font-size: 0.75rem;
		color: var(--foreground-500, var(--foreground));
	}
</style>
