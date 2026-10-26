<script lang="ts">
	// src\lib\components\form\address-input\Main.svelte
	// AddressInput — nhập địa chỉ VN với auto complete nhận dạng chuỗi:
	// 1) ô text nhập địa chỉ chi tiết (số nhà, tên đường...)
	// 2) gõ chuỗi địa chỉ đầy đủ → gợi ý nhận dạng Tỉnh/Thành + Quận/Huyện
	//    (+ Phường/Xã) từ data tĩnh VN → chọn qua select/option
	// 3) Select cascading theo HỆ ĐVHC:
	//    - Cũ (63 tỉnh, 3 cấp: tỉnh→huyện→xã) từ vn-geo.json + vn-geo-wards.json
	//    - Mới (34 tỉnh, 2 cấp: tỉnh→xã) từ vn-geo-2025.json (NQ sáp nhập 2025)
	// 4) Khi parent bind newBreakdown: toggle hệ cũ/mới + GEN 2 CHIỀU qua mapping
	//    (nhập bên nào tự điền bên kia; xã bị tách/gộp 1-nhiều → chỉ gen cấp tỉnh,
	//    để user chọn xã thủ công)
	// Tái sử dụng: Input (text), Select (tỉnh/huyện/ward) — import trực tiếp (tránh circular barrel)
	import Input from '../input/Main.svelte';
	import Select from '../select/Main.svelte';
	import type { AddressInputProps, AddressBreakdown, NewAddressBreakdown } from './_interface';

	let {
		value = $bindable(''),
		breakdown = $bindable({ province: '', district: '' }),
		newBreakdown = $bindable(undefined as NewAddressBreakdown | undefined),
		label = '',
		placeholder,
		disabled = false
	}: AddressInputProps = $props();

	// Hệ ĐVHC đang chọn: 'old' (63 tỉnh) | 'new' (34 tỉnh) — chỉ có ý nghĩa khi newBreakdown được bind
	let geoMode = $state<'old' | 'new'>('old');
	const dualMode = $derived(newBreakdown !== undefined);

	interface GeoProvince { n: string; c: number; d: { n: string; c: number }[] }
	/** wards: key 'Tên tỉnh|code' → { 'Tên huyện': ['Phường A', 'Xã B'...] } */
	type WardMap = Record<string, Record<string, string[]>>;
	// vn-geo-2025.json shape (transform từ DiaChiMoi):
	// np [[code,name]] tỉnh mới; nw [[code,pCode,name]] xã mới;
	// op [[oldCode,oldName,newCode]] tỉnh cũ; od {pCode:[[code,name]]} huyện cũ;
	// ow {oldWCode:[dCode,name,newCodeOrArray]} mapping xã cũ→mới
	interface Geo2025 {
		np: [string, string][];
		nw: [string, string, string][];
		op: [string, string, string][];
		od: Record<string, [string, string][]>;
		ow: Record<string, [string, string, string | string[]]>;
	}
	let provinces = $state<GeoProvince[]>([]);
	let wardMap = $state<WardMap>({});
	let geo2025 = $state<Geo2025 | null>(null);
	let geoLoaded = $state(false);

	// Load data địa chỉ 1 lần (lazy — fetch static file; geo 27KB + wards 208KB + 2025 ~488KB)
	// BẪY: geo2025 fetch phải track dualMode RIÊNG — nếu gộp chung effect có guard
	// geoLoaded thì dualMode false lúc mount (entry chưa bind newBreakdown) → sau này
	// dualMode bật lại cũng không fetch → gen old→new chết âm thầm.
	$effect(() => {
		if (geoLoaded) return;
		geoLoaded = true;
		Promise.all([
			fetch('/data/vn-geo.json').then((r) => r.json() as Promise<GeoProvince[]>).then((g) => { provinces = g; }),
			fetch('/data/vn-geo-wards.json').then((r) => r.json() as Promise<WardMap>).then((w) => { wardMap = w; })
		]).catch(() => {
			// data tĩnh — lỗi chỉ mất gợi ý, không chặn nhập tay
		});
	});
	$effect(() => {
		if (!dualMode || geo2025) return;
		fetch('/data/vn-geo-2025.json')
			.then((r) => r.json() as Promise<Geo2025>)
			.then((g) => { geo2025 = g; })
			.catch(() => {
				// data tĩnh — lỗi chỉ mất gen 2 chiều, không chặn nhập tay
			});
	});

	const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();

	// ── Hệ CŨ (63 tỉnh, 3 cấp) ──
	const provinceOptions = $derived(provinces.map((p) => ({ value: p.n, label: p.n })));
	const selectedProvince = $derived(provinces.find((p) => p.n === breakdown.province));
	const districtOptions = $derived((selectedProvince?.d ?? []).map((d) => ({ value: d.n, label: d.n })));
	/** wards của tỉnh đang chọn (khớp qua key 'tên|code') */
	const provinceWards = $derived(
		breakdown.province ? wardMap[`${breakdown.province}|${selectedProvince?.c ?? ''}`] ?? {} : {}
	);
	const wardOptions = $derived((provinceWards[breakdown.district] ?? []).map((w) => ({ value: w, label: w })));

	// ── Hệ MỚI (34 tỉnh, 2 cấp) ──
	const newProvinceOptions = $derived((geo2025?.np ?? []).map(([code, name]) => ({ value: name, label: name })));
	const newSelectedProvinceCode = $derived(geo2025?.np.find(([, name]) => name === newBreakdown?.province)?.[0] ?? '');
	const newWardOptions = $derived(
		newSelectedProvinceCode
			? (geo2025?.nw ?? []).filter(([, pCode]) => pCode === newSelectedProvinceCode).map(([, , name]) => ({ value: name, label: name }))
			: []
	);

	// ── GEN 2 CHIỀU giữa hệ cũ ↔ mới ──
	// BẪY: 2 file data khác format tên — vn-geo.json 'Tỉnh Hà Giang' vs
	// vn-geo-2025.json op 'Hà Giang'; và khác kiểu dấu ('Hoà Bình' vs 'Hòa Bình').
	// Key map qua norm() (NFD strip marks + đ→d + lowercase + collapse spaces) TRƯỚC,
	// rồi strip prefix 'tinh '/'thanh pho ' trên chuỗi ĐÃ normalize.
	const normProvinceKey = (name: string) => norm(name).replace(/^(tinh|thanh pho)\s+/, '');

	// ── INDEX NGƯỢC (batch 12) ──
	// BẪY LỚN: mapNewWardToOld/mapOldWardToNew cũ quét vét Object.entries(ow) 10.035
	// vòng × nw.find 3.321 phần tử (~16-33M phép lặp) QUA deep-proxy $state, ĐỒNG BỘ
	// mỗi lần chọn xã → treo vài giây trên mobile. Data là TĨNH → tính index 1 LẦN
	// khi geo2025 load xong, các hàm map chỉ tra O(1). geo2025 giữ $state (rẻ —
	// proxy chi phí khi READ thuộc tính, index đã rời reactivity).
	let geoIndex: {
		// newWardCode → tên xã mới (từ nw)
		nwName: Map<string, string>;
		// newWardCode → mã tỉnh mới (từ nw)
		nwProvince: Map<string, string>;
		// 'mã xã mới' → các xã cũ đích đến nó [{dCode, ward}] (reverse ow)
		newWardToOlds: Map<string, { dCode: string; ward: string }[]>;
		// 'mã huyện cũ' → tên xã cũ + target (lookup xã cũ theo huyện, O(1) thay find)
		owByDistrict: Map<string, { name: string; target: string | string[] }[]>;
		// 'mã tỉnh mới|norm tên xã mới' → mã xã mới (BẮT BUỘC kèm tỉnh: tên xã
		// trùng giữa các tỉnh — vd 'Phường 1' — key đơn trả sai mã)
		nwNameKey: Map<string, string>;
	} | null = null;
	$effect(() => {
		if (!geo2025 || geoIndex) return;
		const g = geo2025;
		const nwName = new Map<string, string>();
		const nwProvince = new Map<string, string>();
		const nwNameKey = new Map<string, string>();
		for (const [code, pCode, name] of g.nw) {
			nwName.set(code, name);
			nwProvince.set(code, pCode);
			nwNameKey.set(`${pCode}|${norm(name)}`, code);
		}
		const newWardToOlds = new Map<string, { dCode: string; ward: string }[]>();
		const owByDistrict = new Map<string, { name: string; target: string | string[] }[]>();
		for (const [code, [dCode, name, target]] of Object.entries(g.ow)) {
			const targets = Array.isArray(target) ? target : [target];
			for (const t of targets) {
				const arr = newWardToOlds.get(t);
				if (arr) arr.push({ dCode, ward: name });
				else newWardToOlds.set(t, [{ dCode, ward: name }]);
			}
			const byD = owByDistrict.get(dCode);
			const entry = { name, target };
			if (byD) byD.push(entry);
			else owByDistrict.set(dCode, [entry]);
		}
		geoIndex = { nwName, nwProvince, newWardToOlds, owByDistrict, nwNameKey };
	});

	const oldToNewProvince = $derived.by(() => {
		if (!geo2025) return null;
		const map = new Map<string, string>();
		for (const [oldCode, oldName, newCode] of geo2025.op) {
			const newName = geo2025.np.find(([c]) => c === newCode)?.[1];
			if (newName) map.set(normProvinceKey(oldName), newName);
		}
		return map;
	});
	const newToOldProvinces = $derived.by(() => {
		if (!geo2025) return null;
		const map = new Map<string, string[]>();
		for (const [oldCode, oldName, newCode] of geo2025.op) {
			const newName = geo2025.np.find(([c]) => c === newCode)?.[1];
			if (!newName) continue;
			const key = normProvinceKey(newName);
			(map.get(key) ?? map.set(key, []).get(key)!).push(oldName);
		}
		return map;
	});

	/**
	 * Gen hệ còn lại khi breakdown cũ đổi (xã/huyện/tỉnh): old → new.
	 * Xã bị tách 1-nhiều → chỉ gen tỉnh (xã để user chọn).
	 */
	function genNewFromOld(): void {
		if (!geo2025 || !newBreakdown) return;
		const next: NewAddressBreakdown = { province: newBreakdown?.province ?? '', ward: newBreakdown?.ward ?? '' };
		const newProvince = oldToNewProvince?.get(normProvinceKey(breakdown.province ?? ''));
		if (newProvince) next.province = newProvince;
		// xã cũ → xã mới (mapping qua ow — cần mã xã cũ; tìm qua wardMap)
		if (breakdown.ward && next.province) {
			const mapped = mapOldWardToNew(breakdown.province, breakdown.district, breakdown.ward, next.province);
			next.ward = mapped;
		} else if (!breakdown.ward) {
			next.ward = '';
		}
		if (next.province !== newBreakdown?.province || next.ward !== newBreakdown?.ward) {
			newBreakdown = next;
		}
	}

	/**
	 * Tìm mã xã cũ theo (tên tỉnh cũ, tên huyện cũ, tên xã cũ) rồi tra ow → tên xã mới
	 * (thuộc tỉnh mới đích). Nhiều kết quả hoặc không tìm thấy → '' (user chọn tay).
	 */
	function mapOldWardToNew(oldProvince: string, oldDistrict: string, oldWard: string, newProvince: string): string {
		if (!geo2025 || !geoIndex) return '';
		const oldProvinceCode = geo2025.op.find(([, name]) => normProvinceKey(name) === normProvinceKey(oldProvince))?.[0];
		if (!oldProvinceCode) return '';
		const districtRow = (geo2025.od[oldProvinceCode] ?? []).find(([, name]) => name === oldDistrict);
		const oldDistrictCode = districtRow?.[0];
		if (!oldDistrictCode) return '';
		// Tra index owByDistrict (O(số xã của huyện) thay quét 10.035 xã toàn quốc)
		const wardRow = (geoIndex.owByDistrict.get(oldDistrictCode) ?? []).find((e) => e.name === oldWard);
		if (!wardRow) return '';
		const target = wardRow.target;
		if (Array.isArray(target)) return ''; // xã bị tách 1-nhiều — không tự chọn
		return geoIndex.nwName.get(target) ?? '';
	}

	/**
	 * Gen hệ cũ khi breakdown mới đổi: new → old (qua op reverse + ow reverse).
	 * Tên tỉnh mới có thể map về nhiều tỉnh cũ (sáp nhập) → nếu >1 thì không tự chọn tỉnh cũ.
	 */
	function genOldFromNew(): void {
		if (!geo2025) return;
		const oldCandidates = newToOldProvinces?.get(normProvinceKey(newBreakdown?.province ?? '')) ?? [];
		const next: AddressBreakdown = { ...breakdown };
		if (oldCandidates.length === 1) {
			// Tên trong op không có prefix — Select hệ cũ options là 'Tỉnh X' →
			// tìm đúng option name trong provinces theo key norm
			const oldName = oldCandidates[0];
			const matched = provinces.find((p) => normProvinceKey(p.n) === normProvinceKey(oldName));
			next.province = matched?.n ?? oldName;
		} else if (oldCandidates.length === 0) {
			next.province = '';
		}
		// xã mới → xã cũ (reverse ow): tìm các xã cũ map vào xã mới này
		if (newBreakdown?.ward && next.province) {
			const oldWard = mapNewWardToOld(next.province, newBreakdown.province ?? '', newBreakdown.ward);
			next.ward = oldWard.ward;
			next.district = oldWard.district;
		} else if (!newBreakdown?.ward) {
			next.ward = '';
		}
		if (next.province !== breakdown.province || next.district !== breakdown.district || next.ward !== breakdown.ward) {
			breakdown = next;
		}
	}

	function mapNewWardToOld(oldProvince: string, newProvince: string, newWard: string): { district: string; ward: string } {
		if (!geo2025 || !geoIndex) return { district: '', ward: '' };
		const oldProvinceCode = geo2025.op.find(([, name]) => normProvinceKey(name) === normProvinceKey(oldProvince))?.[0];
		const newProvinceCode = geo2025.np.find(([, name]) => normProvinceKey(name) === normProvinceKey(newProvince))?.[0];
		if (!oldProvinceCode || !newProvinceCode) return { district: '', ward: '' };
		// Social mới được chọn có thể là đích của nhiều xã cũ (gộp) — reverse ow qua index:
		// tra theo MÃ xã mới (match tên → mã O(1)), index đã gộp theo target (1 hoặc mảng).
		const newWardCode = geoIndex.nwNameKey.get(`${newProvinceCode}|${norm(newWard)}`);
		if (!newWardCode) return { district: '', ward: '' };
		const hits = geoIndex.newWardToOlds.get(newWardCode) ?? [];
		// Giữ các hit thuộc TỈNH CŨ đang chọn (qua od) + xã mới đích đúng tỉnh mới
		const districtMap = geo2025.od[oldProvinceCode] ?? [];
		const valid = hits.filter((h) => {
			if (!districtMap.some(([c]) => c === h.dCode)) return false;
			// hit này là xã cũ có target trúng newWardCode — kiểm nw của newWardCode thuộc tỉnh mới
			return geoIndex!.nwProvince.get(newWardCode) === newProvinceCode;
		});
		if (valid.length !== 1) return { district: '', ward: '' };
		const districtName = districtMap.find(([c]) => c === valid[0].dCode)?.[1] ?? '';
		return { district: districtName, ward: valid[0].ward };
	}

	// Auto nhận dạng: quét chuỗi value tìm tên tỉnh/huyện khớp (word-boundary)
	function detectFromText(raw: string): AddressBreakdown | null {
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
		if (dualMode) genNewFromOld();
	}

	// Chọn tỉnh (cũ) → xoá huyện/ward nếu không còn thuộc tỉnh mới → gen hệ mới
	function onProvinceChange(v: string | string[]) {
		if (typeof v !== 'string') return;
		if (v !== breakdown.province) breakdown = { province: v, district: '', ward: '' };
		if (dualMode) genNewFromOld();
	}

	// Chọn huyện (cũ) → xoá ward nếu không còn thuộc huyện mới → gen hệ mới
	function onDistrictChange(v: string | string[]) {
		if (typeof v !== 'string') return;
		breakdown = { ...breakdown, district: v, ward: '' };
		if (dualMode) genNewFromOld();
	}

	function onOldWardChange() {
		if (dualMode) genNewFromOld();
	}

	// ── Hệ mới: chọn tỉnh/xã → gen hệ cũ ──
	function onNewProvinceChange(v: string | string[]) {
		if (typeof v !== 'string' || !newBreakdown) return;
		if (v !== newBreakdown.province) newBreakdown = { province: v, ward: '' };
		if (dualMode) genOldFromNew();
	}

	function onNewWardChange() {
		if (dualMode) genOldFromNew();
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
	{#if dualMode}
		<div class="address-input__mode" role="tablist" aria-label="Hệ địa giới hành chính">
			<button
				type="button"
				class="address-input__mode-btn"
				class:address-input__mode-btn--active={geoMode === 'old'}
				aria-pressed={geoMode === 'old'}
				onclick={() => (geoMode = 'old')}
				disabled={disabled}
			>Cũ (63 tỉnh)</button>
			<button
				type="button"
				class="address-input__mode-btn"
				class:address-input__mode-btn--active={geoMode === 'new'}
				aria-pressed={geoMode === 'new'}
				onclick={() => (geoMode = 'new')}
				disabled={disabled}
			>Mới (34 tỉnh)</button>
		</div>
	{/if}
	{#if geoMode === 'old' || !dualMode}
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
					onValueChange={onOldWardChange}
					searchable
					clearable
					placeholder="Chọn phường/xã"
					disabled={disabled || !breakdown.district}
				/>
			</div>
		</div>
	{:else}
		<div class="address-input__selects address-input__selects--new">
			<div class="address-input__field">
				<span class="address-input__sub">Tỉnh/Thành phố</span>
				<Select
					options={newProvinceOptions}
					bind:value={newBreakdown!.province}
					onValueChange={onNewProvinceChange}
					searchable
					clearable
					placeholder="Chọn tỉnh/thành phố"
					disabled={disabled}
				/>
			</div>
			<div class="address-input__field">
				<span class="address-input__sub">Phường/Xã</span>
				<Select
					options={newWardOptions}
					bind:value={newBreakdown!.ward}
					onValueChange={onNewWardChange}
					searchable
					clearable
					placeholder="Chọn phường/xã"
					disabled={disabled || !newBreakdown!.province}
				/>
			</div>
		</div>
	{/if}
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

	.address-input__mode {
		display: inline-flex;
		gap: 0.25rem;
		align-self: flex-start;
		padding: 0.25rem;
		background: var(--surface-100, var(--default-100, transparent));
		border-radius: 0.5rem;
	}

	.address-input__mode-btn {
		padding: 0.25rem 0.625rem;
		font-size: 0.75rem;
		border: none;
		border-radius: 0.375rem;
		background: transparent;
		color: var(--foreground-500, var(--foreground));
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease;

		&--active {
			background: var(--background);
			color: var(--foreground);
			box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
		}
	}

	.address-input__selects {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;

		&--new {
			grid-template-columns: repeat(2, 1fr);
		}

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
