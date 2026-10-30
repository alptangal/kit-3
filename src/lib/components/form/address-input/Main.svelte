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
	import { tick } from 'svelte';
	import Input from '../input/Main.svelte';
	import Select from '../select/Main.svelte';
	import { Modal } from '$components/modal';
	import { client } from '$store/basic.svelte';
	import type { AddressInputProps, AddressBreakdown, NewAddressBreakdown } from './_interface';
	import type { SelectConfigs } from '../select/_interface';

	let {
		value = $bindable(''),
		breakdown = $bindable({ province: '', district: '' }),
		newBreakdown = $bindable(undefined as NewAddressBreakdown | undefined),
		label = '',
		placeholder,
		disabled = false,
		// Batch 16 (mục 8): breadcrumb 3 cấp trong header step modal (mobile) —
		// breadcrumbHome có giá trị mới render (trang khác không truyền → không đổi gì)
		breadcrumbHome = null as string | null,
		breadcrumbName = null as string | null,
		breadcrumbCurrent = null as string | null,
		onBreadcrumbHomeTap,
		onBreadcrumbNameTap
	}: AddressInputProps = $props();

	// Hệ ĐVHC đang chọn: 'old' (63 tỉnh) | 'new' (34 tỉnh) — chỉ có ý nghĩa khi newBreakdown được bind
	let geoMode = $state<'old' | 'new'>('old');
	const dualMode = $derived(newBreakdown !== undefined);
	// Mobile: Select địa chỉ mở FULLSCREEN (reuse Modal) — dropdown absolute trong modal body
	// cuộn bị option trôi ra ngoài viewport (touch bị nuốt) + auto-focus search bật keyboard
	// iOS co viewport → lag cảm giác. Batch 12b (m10214).
	const selectFullscreen = $derived(client.browser?.isMobile === true);

	// Batch 16 (mục 8-9): i18n cho step modal — language từ store client (mặc định 'en').
	// Tên `i18n` thay vì `t` để tránh trùng biến vòng lặp `t` (for targets); pattern
	// { key: { vi, en } } như image-upload.
	const lang = $derived(client.browser?.language === 'vi' ? 'vi' : 'en');
	const i18n = {
		selectProvince: { vi: 'Chọn tỉnh/thành phố', en: 'Select province' },
		selectDistrict: { vi: 'Chọn quận/huyện', en: 'Select district' },
		selectWard: { vi: 'Chọn phường/xã', en: 'Select ward' },
		address: { vi: 'Địa chỉ', en: 'Address' },
		// Batch 20: aria-label nút more (popover các nấc breadcrumb bị gom)
		crumbMore: { vi: 'Xem đường dẫn', en: 'Show path' }
	} as const;
	const tr = (key: keyof typeof i18n): string => i18n[key][lang] ?? i18n[key].en;

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
	// Batch 13 (m10824-1b): option dạng STEP TREE — label chỉ tên node,
	// description = đường dẫn cha (Tỉnh > Huyện). Không lặp tên cha trong label
	// → list gọn + search vẫn khớp (Select filter cả description).
	const provinceOptions = $derived(provinces.map((p) => ({ value: p.n, label: p.n })));
	const selectedProvince = $derived(provinces.find((p) => p.n === breakdown.province));
	// Batch 17 (m00004): description (đường dẫn cha) CHỈ cho mobile step picker —
	// search khớp cả cha; PC grid bỏ desc cho list gọn.
	const districtOptions = $derived.by(() => {
		const opts = (selectedProvince?.d ?? []).map((d) => ({ value: d.n, label: d.n }));
		return selectFullscreen ? opts.map((o) => ({ ...o, description: breakdown.province })) : opts;
	});
	/** wards của tỉnh đang chọn (khớp qua key 'tên|code') */
	const provinceWards = $derived(
		breakdown.province ? wardMap[`${breakdown.province}|${selectedProvince?.c ?? ''}`] ?? {} : {}
	);
	const wardOptions = $derived.by(() => {
		const opts = (provinceWards[breakdown.district] ?? []).map((w) => ({ value: w, label: w }));
		return selectFullscreen
			? opts.map((o) => ({ ...o, description: `${breakdown.province} › ${breakdown.district}` }))
			: opts;
	});

	// ── Hệ MỚI (34 tỉnh, 2 cấp) ──
	const newProvinceOptions = $derived((geo2025?.np ?? []).map(([code, name]) => ({ value: name, label: name })));
	const newSelectedProvinceCode = $derived(geo2025?.np.find(([, name]) => name === newBreakdown?.province)?.[0] ?? '');
	const newWardOptions = $derived.by(() => {
		const opts = newSelectedProvinceCode
			? (geo2025?.nw ?? []).filter(([, pCode]) => pCode === newSelectedProvinceCode).map(([, , name]) => ({ value: name, label: name }))
			: [];
		// Batch 17 (m00004): desc chỉ mobile step picker (như district/wardOptions)
		return selectFullscreen ? opts.map((o) => ({ ...o, description: newBreakdown?.province })) : opts;
	});

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
	// Batch 17 (m00004): PC auto-advance — chọn tỉnh xong mở panel huyện.
	// bind:this Select trả exports object (export { configs } — precedent
	// useVisualKeyboard đọc component.configs).
	let provinceSelect: { configs: SelectConfigs } | undefined = $state();
	let districtSelect: { configs: SelectConfigs } | undefined = $state();
	let wardSelect: { configs: SelectConfigs } | undefined = $state();
	let newProvinceSelect: { configs: SelectConfigs } | undefined = $state();
	let newWardSelect: { configs: SelectConfigs } | undefined = $state();
	// BẪY: selectOption chạy onValueChange TRƯỚC configs.close() của panel đang
	// mở (selectOption: set value → setter emit → close) → open() đồng bộ sẽ bị
	// close() tắt ngay — defer rAF để mở sau khi panel cũ đóng.
	function advanceTo(select: { configs: SelectConfigs } | undefined) {
		if (selectFullscreen || disabled || !select) return;
		requestAnimationFrame(() => select.configs.open());
	}

	// BẪY (Batch 17): bind:value={breakdown.x} cập nhật breakdown ĐỒNG BỘ TRƯỚC
	// onValueChange emit (selectOption: configs.value setter gán bindable trước emit)
	// → trong handler KHÔNG SO SÁNH v với breakdown.x (luôn bằng nhau) — phải
	// theo dõi giá trị trước đó qua biến riêng _prev.
	let _prevProvince = breakdown.province;
	let _prevDistrict = breakdown.district;
	let _prevNewProvince = newBreakdown?.province ?? '';

	function onProvinceChange(v: string | string[]) {
		if (typeof v !== 'string') return;
		if (v !== _prevProvince) {
			_prevProvince = v;
			breakdown = { province: v, district: '', ward: '' };
			// Chọn tỉnh hợp lệ (không phải clear) → mở panel bước sau
			if (v) advanceTo(districtSelect);
		}
		if (dualMode) genNewFromOld();
	}

	// Chọn huyện (cũ) → xoá ward nếu không còn thuộc huyện mới → gen hệ mới
	function onDistrictChange(v: string | string[]) {
		if (typeof v !== 'string') return;
		const changed = v !== _prevDistrict;
		_prevDistrict = v;
		breakdown = { ...breakdown, district: v, ward: '' };
		if (v && changed) advanceTo(wardSelect);
		if (dualMode) genNewFromOld();
	}

	function onOldWardChange() {
		if (dualMode) genNewFromOld();
	}

	// ── Hệ mới: chọn tỉnh/xã → gen hệ cũ ──
	function onNewProvinceChange(v: string | string[]) {
		if (typeof v !== 'string' || !newBreakdown) return;
		if (v !== _prevNewProvince) {
			_prevNewProvince = v;
			newBreakdown = { province: v, ward: '' };
			// Batch 17 (m00004): PC auto-advance tỉnh mới → panel xã
			if (v) advanceTo(newWardSelect);
		}
		if (dualMode) genOldFromNew();
	}

	function onNewWardChange() {
		if (dualMode) genOldFromNew();
	}

	// ── Batch14 (m11713-2): mobile STEP PICKER ──
	// Mobile thay 3 Select bằng picker theo bước: tap field tỉnh → fullscreen
	// modal list tỉnh (search) → tap tỉnh → slide trái→phải panel HUYỆN → tap
	// huyện → slide panel PHƯỜNG. Breadcrumb trên header quay lại cấp trước.
	// Hệ mới (34 tỉnh 2 cấp): tỉnh → xã. Desktop giữ grid Select (fullscreen).
	let stepOpen = $state(false);
	// cấp đang hiển thị: 0=tỉnh, 1=huyện (old) / xã (new), 2=phường (old)
	let stepLevel = $state(0);
	// hướng slide: 1 = đi sâu (nội dung mới vào từ phải), -1 = quay lại (từ trái)
	let stepDir = $state(1);
	let stepSearch = $state('');

	const stepProvinceOptions = $derived.by(() => {
		const q = norm(stepSearch);
		const src = geoMode === 'new' && dualMode ? newProvinceOptions : provinceOptions;
		// BẪY: provinceOptions (hệ cũ) là {value,label} KHÔNG description —
		// district/ward options có description (đường dẫn cha). Filter nên ăn cả
		// description (search "ha giang" phải khớp cả option cha) → index qua
		// record trung gian an toàn type.
		if (!q) return src;
		return src.filter((o) => {
			const desc = (o as { description?: string }).description;
			return norm(o.label).includes(q) || (desc ? norm(desc).includes(q) : false);
		});
	});
	const stepDistrictOptions = $derived.by(() => {
		if (geoMode === 'new' && dualMode) return [];
		const q = norm(stepSearch);
		const src = districtOptions;
		return q ? src.filter((o) => norm(o.label).includes(q)) : src;
	});
	const stepWardOptions = $derived.by(() => {
		const q = norm(stepSearch);
		const src = geoMode === 'new' && dualMode ? newWardOptions : wardOptions;
		return q ? src.filter((o) => norm(o.label).includes(q)) : src;
	});

	function openStepPicker(level: number) {
		stepLevel = level;
		stepDir = 1;
		stepSearch = '';
		stepOpen = true;
	}
	// Chọn item ở cấp level → tiến cấp sau (nếu còn) hoặc đóng (cấp cuối)
	function stepSelectLevel(level: number, v: string) {
		stepDir = 1;
		if (geoMode === 'new' && dualMode) {
			if (level === 0) {
				onNewProvinceChange(v);
				// tỉnh mới được chọn → slide sang cấp xã
				if (newBreakdown?.province === v) {
					stepLevel = 1;
					stepSearch = '';
				}
			} else {
				// cấp xã: set trực tiếp (Select bind giữ nguyên giá trị)
				if (newBreakdown && v !== newBreakdown.ward) newBreakdown = { ...newBreakdown, ward: v };
				onNewWardChange();
				stepOpen = false;
			}
			return;
		}
		if (level === 0) {
			onProvinceChange(v);
			if (breakdown.province === v) {
				stepLevel = 1;
				stepSearch = '';
			}
		} else if (level === 1) {
			onDistrictChange(v);
			if (breakdown.district === v) {
				stepLevel = 2;
				stepSearch = '';
			}
		} else {
			// ward: chỉ set value — onOldWardChange chỉ gen hệ mới (không đổi breakdown cũ)
			if (v !== breakdown.ward) breakdown = { ...breakdown, ward: v };
			onOldWardChange();
			stepOpen = false;
		}
	}
	// Breadcrumb quay lại cấp level (slide ngược từ phải sang trái)
	function stepBack(level: number) {
		if (level >= stepLevel) return;
		stepDir = -1;
		stepLevel = level;
		stepSearch = '';
	}

	// Batch 15 (m12278-11): chuỗi giá trị ĐÃ CHỌN (tỉnh › huyện › xã) hiển thị
	// trên search field — chỉ gồm các cấp có giá trị; stepBack tới cấp đã chọn
	// chỉ hợp lệ khi level < stepLevel (không tiến lên từ summary).
	const stepSelectedChain = $derived.by(() => {
		const chain: { level: number; label: string }[] = [];
		const isNew = geoMode === 'new' && dualMode;
		if (isNew) {
			if (newBreakdown?.province) chain.push({ level: 0, label: newBreakdown.province });
		} else {
			if (breakdown.province) chain.push({ level: 0, label: breakdown.province });
			if (breakdown.district) chain.push({ level: 1, label: breakdown.district });
			if (breakdown.ward) chain.push({ level: 2, label: breakdown.ward });
		}
		return chain;
	});
	// Xoá lựa chọn cấp hiện tại + các cấp sâu hơn (nút ✕ trên breadcrumb/cleared field)
	function stepClearCurrent() {
		stepDir = -1;
		stepSearch = '';
		if (geoMode === 'new' && dualMode) {
			if (stepLevel === 0) {
				if (newBreakdown && (newBreakdown.province || newBreakdown.ward)) newBreakdown = { province: '', ward: '' };
				if (dualMode) genOldFromNew();
			}
			return;
		}
		if (stepLevel === 0) {
			if (breakdown.province || breakdown.district || breakdown.ward) breakdown = { province: '', district: '', ward: '' };
			if (dualMode) genNewFromOld();
		} else if (stepLevel === 1) {
			if (breakdown.district || breakdown.ward) breakdown = { ...breakdown, district: '', ward: '' };
			if (dualMode) genNewFromOld();
		} else {
			if (breakdown.ward) breakdown = { ...breakdown, ward: '' };
			if (dualMode) genNewFromOld();
		}
	}

	// ── Batch 21: breadcrumb header thứ tự CÂY root→lá (trái→phải) — [trang cha:
	// home → name → current-label] › [nấc ĐÃ CHỌN: tỉnh → huyện → phường]; cấp
	// đang chọn CHƯA có giá trị → không có nấc. Hết width → gom từ ĐẦU hàng
	// (Suppliers trước tiên) vào popover qua nút more (tap item → quay lại nấc
	// đó), giữ nấc GẦN (cuối hàng). Pattern batch 18
	// suppliers (measureCrumbOverflow): ResizeObserver + tick; outside-click
	// MOUSEDOWN (nút form stopPropagation() trên click). BẪY chống RO ping-pong:
	// more button nằm trong SLOT CỐ ĐỊNH 2rem luôn render (visibility khi ẩn)
	// → mount/unmount popover-state không đổi nav clientWidth → measure hội tụ.
	let stepCrumbNavEl = $state<HTMLElement | null>(null);
	let crumbMoreOpen = $state(false);
	// Số nấc BỊ GOM (từ ĐẦU mảng hiển thị — Suppliers trước tiên) — 0 = không more
	let crumbOverflow = $state(0);

	// Chuỗi hiển thị thứ tự cây root→lá: [page-home → page-name → page-current]
	// › [stepCrumbs ĐÃ CÓ GIÁ TRỊ (tăng dần: tỉnh → huyện → phường)]. Cấp đang
	// chọn chưa có giá trị → stepCrumbs không chứa nó → không render nấc nào
	// (yêu cầu batch 21: bỏ nấc 'Select province/district/ward'). level: số ≥ 0
	// = cấp step (tap stepBack); -1 page-current (span); -2 name; -3 home (tap
	// handler trang cha). kind điều khiển cách render/tap.
	type HeaderCrumb = { level: number; label: string; kind: 'step' | 'page-current' | 'page-name' | 'page-home' };
	const headerCrumbs = $derived.by(() => {
		const crumbs: HeaderCrumb[] = [];
		// 1) breadcrumb trang cha (root, ĐẦU mảng): home → name → 'Địa chỉ'
		if (breadcrumbHome) {
			crumbs.push({ level: -3, label: breadcrumbHome, kind: 'page-home' });
			if (breadcrumbName) crumbs.push({ level: -2, label: breadcrumbName, kind: 'page-name' });
			crumbs.push({ level: -1, label: breadcrumbCurrent ?? tr('address'), kind: 'page-current' });
		}
		// 2) Batch 22: KHÔNG render các nấc step (tỉnh/huyện/phường) trên header
		//    nav — title dừng ở nấc 'Địa chỉ' (yêu cầu user m00193-1). Nấc step
		//    vẫn hiển thị ở path row (nav.address-step__path DƯỚI search field);
		//    stepBack vẫn dùng ở đó + popover more chỉ gom các nấc page-*.
		return crumbs;
	});
	// Phần hiển thị trên nav + phần bị gom vào popover (từ ĐẦU mảng)
	const crumbVisible = $derived(headerCrumbs.slice(crumbOverflow));
	const crumbHidden = $derived(headerCrumbs.slice(0, crumbOverflow));
	// nấc CUỐI (gần nhất) thành nấc duy nhất còn lại → cho phép co/ellipsis chính nó
	const crumbSolo = $derived(headerCrumbs.length > 1 && crumbOverflow >= headerCrumbs.length - 1);

	// Đo overflow TRÊN ITEM CUỐI (bẫy batch 18: item con min-width:0 + ellipsis
	// "nuốt hết" squeeze → nav.scrollWidth === clientWidth vĩnh viễn, phải đo
	// scrollWidth trên chính item bị cắt). Batch 21: nấc cuối là nấc GẦN (span
	// --current shrink:0 không bao giờ cắt) → điều kiện tràn = BẤT KỲ item con
	// nào bị cắt; nấc xa hơn bị cắt = "phần còn lại width không đủ chứa" theo
	// yêu cầu user → gom vào popover.
	async function measureStepCrumbOverflow() {
		const nav = stepCrumbNavEl;
		if (!nav || !stepOpen) {
			if (crumbOverflow !== 0) crumbOverflow = 0;
			return;
		}
		// Bất kỳ item con nào scrollWidth > clientWidth+1 = đang bị cắt
		const anyTruncated = () => {
			for (const el of nav.children) {
				const item = el as HTMLElement;
				if (item.scrollWidth > item.clientWidth + 1) return true;
			}
			return false;
		};
		let guard = 0;
		// Gom dần các nấc ĐẦU hàng (xa nhất: home trước) tới khi không còn item
		// bị cắt hoặc chỉ còn 1 nấc cuối.
		while (anyTruncated() && crumbOverflow < headerCrumbs.length - 1 && guard < 8) {
			crumbOverflow += 1;
			guard += 1;
			await tick();
		}
		// Dư chỗ (rotate/đóng keyboard) → thử trả lại nấc đã gom; vẫn cắt
		// lại → hoàn tác và dừng.
		while (crumbOverflow > 0 && guard < 16) {
			crumbOverflow -= 1;
			guard += 1;
			await tick();
			if (anyTruncated()) {
				crumbOverflow += 1;
				break;
			}
		}
	}

	$effect(() => {
		// deps: mở/đóng step + đổi cấp + chuỗi label — KHÔNG đọc crumbMoreOpen
		// (chống RO loop khi popover mở/đóng)
		void stepOpen;
		void stepLevel;
		void headerCrumbs;
		if (!stepOpen) {
			if (crumbOverflow !== 0) crumbOverflow = 0;
			crumbMoreOpen = false;
			return;
		}
		let raf = requestAnimationFrame(() => void measureStepCrumbOverflow());
		const ro = new ResizeObserver(() => requestAnimationFrame(() => void measureStepCrumbOverflow()));
		if (stepCrumbNavEl) ro.observe(stepCrumbNavEl);
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	});

	// Outside-click đóng popover — MOUSEDOWN (nút form stopPropagation() trên
	// click nên click không bubble tới document; memory batch 18)
	$effect(() => {
		if (!crumbMoreOpen) return;
		const onDocMousedown = (e: MouseEvent) => {
			const nav = stepCrumbNavEl;
			const header = nav?.parentElement;
			// tap chính nút more / popover (nằm ngoài nav) không đóng
			if (header && header.contains(e.target as Node)) return;
			crumbMoreOpen = false;
		};
		document.addEventListener('mousedown', onDocMousedown);
		return () => document.removeEventListener('mousedown', onDocMousedown);
	});

	// Batch 19: ESC + backdrop + nút ✕ do Modal component xử lý (isDimissable
	// + onClose) — bỏ onStepKeydown cũ (div fixed tự handle Escape).

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
	{#if selectFullscreen}
		<!-- ── Mobile (batch14): picker theo BƯỚC — field hiển thị dạng trigger-style
		     button, tap mở fullscreen modal step (tỉnh → huyện → phường). Hệ mới 2 cấp. ── -->
		<div class="address-input__selects" class:address-input__selects--new={geoMode === 'new' && dualMode}>
			<div class="address-input__field">
				<span class="address-input__sub">Tỉnh/Thành phố</span>
				<button
					type="button"
					class="address-input__step-trigger"
					class:address-input__step-trigger--placeholder={!(geoMode === 'new' && dualMode ? newBreakdown?.province : breakdown.province)}
					class:address-input__step-trigger--disabled={disabled}
					onclick={() => !disabled && openStepPicker(0)}
				>
					<span>{(geoMode === 'new' && dualMode ? newBreakdown?.province : breakdown.province) || 'Chọn tỉnh/thành phố'}</span>
					<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
				</button>
			</div>
			{#if geoMode === 'new' && dualMode}
				<div class="address-input__field">
					<span class="address-input__sub">Phường/Xã</span>
					<button
						type="button"
						class="address-input__step-trigger"
						class:address-input__step-trigger--placeholder={!newBreakdown?.ward}
						class:address-input__step-trigger--disabled={disabled || !newBreakdown?.province}
						onclick={() => !disabled && newBreakdown?.province && openStepPicker(1)}
					>
						<span>{newBreakdown?.ward || 'Chọn phường/xã'}</span>
						<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
					</button>
				</div>
			{:else}
				<div class="address-input__field">
					<span class="address-input__sub">Quận/Huyện</span>
					<button
						type="button"
						class="address-input__step-trigger"
						class:address-input__step-trigger--placeholder={!breakdown.district}
						class:address-input__step-trigger--disabled={disabled || !breakdown.province}
						onclick={() => !disabled && breakdown.province && openStepPicker(1)}
					>
						<span>{breakdown.district || 'Chọn quận/huyện'}</span>
						<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
					</button>
				</div>
				<div class="address-input__field">
					<span class="address-input__sub">Phường/Xã</span>
					<button
						type="button"
						class="address-input__step-trigger"
						class:address-input__step-trigger--placeholder={!breakdown.ward}
						class:address-input__step-trigger--disabled={disabled || !breakdown.district}
						onclick={() => !disabled && breakdown.district && openStepPicker(2)}
					>
						<span>{breakdown.ward || 'Chọn phường/xã'}</span>
						<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
					</button>
				</div>
			{/if}
		</div>
	{:else if geoMode === 'old' || !dualMode}
			<div class="address-input__selects">
				<div class="address-input__field">
					<span class="address-input__sub">Tỉnh/Thành phố</span>
					<Select
						options={provinceOptions}
						bind:value={breakdown.province}
						onValueChange={onProvinceChange}
						bind:this={provinceSelect}
						searchable
						clearable
						fullscreen={selectFullscreen}
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
						bind:this={districtSelect}
						searchable
						clearable
						fullscreen={selectFullscreen}
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
						bind:this={wardSelect}
						searchable
						clearable
						fullscreen={selectFullscreen}
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
						bind:this={newProvinceSelect}
						searchable
						clearable
						fullscreen={selectFullscreen}
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
						bind:this={newWardSelect}
						searchable
						clearable
						fullscreen={selectFullscreen}
						placeholder="Chọn phường/xã"
						disabled={disabled || !newBreakdown!.province}
					/>
				</div>
			</div>
	{/if}
</div>

<!-- ── Fullscreen STEP modal (batch14, mobile) — Batch 19: PORTAL qua Modal component
     (size-full, như Select fullscreen batch12) — trước đây div fixed inline trong
     modal-body-root: iOS 15.1 vẽ position:fixed trong scroll container SAI vị trí
     (backdrop không phủ, panel chìm xuống đáy, hit-test lệch) → user nhìn thấy
     modal create bên dưới + không thấy breadcrumb. Modal portal ra ngoài root
     Container → fixed theo viewport thật. ── -->
{#if selectFullscreen && stepOpen}
	<Modal
		size="full"
		variant="opaque"
		transitionType="none"
		// Batch 20: class riêng → props.class CỘT lên .modal-root (modal/Main.svelte
		// configs.style styleSynced) → CSS :global(.modal-root.address-step-modal)
		// bỏ padding viewport 1rem → full size (chỉ step modal, không đụng modal khác).
		class="address-step-modal"
		// KHÔNG autoFocus: fullscreen chỉ chạy mobile — focus trap nhắm search input
		// → iOS 15 bật keyboard ngay khi mở (bẫy batch 12). User tự tap ô search.
		autoFocus={false}
		onClose={() => (stepOpen = false)}
		bind:display={stepOpen}
	>
		<Modal.Container>
			<Modal.Container.Header
				class="address-step__header-root"
				actionButtons={{ close: { display: false } }}
			>
				<div class="address-step__header">
					<!-- Batch 22: BỎ nút back chevron ở title modal (yêu cầu user
					     m00193-1) — quay lại cấp đã chọn qua path row (nav
					     .address-step__path dưới search field). -->
					<!-- Batch 21: SLOT MORE CỐ ĐỊNH 2rem đứng TRƯỚC nav (trái) — gom từ
					     ĐẦU mảng (Suppliers trước tiên), giữ nấc GẦN (cuối hàng). Luôn
					     render (visibility khi ẩn) chống RO ping-pong: mount/unmount
					     more-button khi crumbOverflow đổi sẽ làm nav đổi width → measure
					     không hội tụ. Popover nằm trong header đã portal — z-index thắng
					     trong stacking context của header (CSS .address-step__more). -->
					<div class="address-step__more-wrap">
						<button
							type="button"
							class="address-step__more"
							aria-label={tr('crumbMore')}
							aria-expanded={crumbMoreOpen}
							tabindex={crumbOverflow > 0 ? 0 : -1}
							aria-hidden={crumbOverflow > 0 ? undefined : 'true'}
							style={crumbOverflow > 0 ? undefined : 'visibility:hidden;pointer-events:none;'}
							onclick={() => (crumbMoreOpen = !crumbMoreOpen)}
						>
							<svg width="1.25em" height="1.25em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="19" cy="12" r="1.75"/></svg>
						</button>
						{#if crumbMoreOpen}
							<div class="address-step__crumb-popover" role="menu">
								{#each crumbHidden as hid (hid.level)}
									<button
										type="button"
										class="address-step__crumb-popover-item"
										role="menuitem"
										onclick={() => {
											crumbMoreOpen = false;
											// 'step' → về cấp đã qua (guard stepBack từ chối tự
											// quay chính nấc current); page-* → handler trang
											// cha tương ứng.
											if (hid.kind === 'step') stepBack(hid.level);
											else if (hid.kind === 'page-home') onBreadcrumbHomeTap?.();
											else if (hid.kind === 'page-name') (onBreadcrumbNameTap ?? onBreadcrumbHomeTap)?.();
										}}
									>{hid.label}</button>
								{/each}
							</div>
						{/if}
					</div>
				<nav class="address-step__crumbs" aria-label="Cấp địa giới" bind:this={stepCrumbNavEl}>
					{#each crumbVisible as crumb, ci (crumb.level)}
						<!-- Batch 21: thứ tự CÂY root→lá — trang cha ĐẦU (home → name →
						     'Địa chỉ'), nấc step đã chọn theo sau (tỉnh → huyện → phường);
						     nấc xa nhất bị gom popover more (trên). -->
						{#if ci > 0}<span class="address-step__crumb-sep" aria-hidden="true">›</span>{/if}
						{#if crumb.kind === 'page-current'}
							<span class="address-step__crumb address-step__crumb--current" class:address-step__crumb--solo={crumbSolo && crumb.kind === 'page-current'}>{crumb.label}</span>
						{:else if crumb.kind === 'step'}
							<button type="button" class="address-step__crumb" onclick={() => stepBack(crumb.level)}>
								{crumb.label}
							</button>
						{:else if crumb.kind === 'page-name'}
							<button type="button" class="address-step__crumb" onclick={() => (onBreadcrumbNameTap ?? onBreadcrumbHomeTap)?.()}>
								{crumb.label}
							</button>
						{:else}
							<button type="button" class="address-step__crumb" onclick={() => onBreadcrumbHomeTap?.()}>
								{crumb.label}
							</button>
						{/if}
					{/each}
				</nav>
					<!-- Batch 20: user yêu cầu BỎ nút ✕ nhìn thấy trên breadcrumb (không
					     cần thiết). KHÔNG xoá hẳn: suppliers attemptCloseStepModal (dòng
					     ~1109) querySelector('.address-step__close') + dispatchEvent
					     MouseEvent để đóng step khi tap breadcrumb cha — giữ element ẨN
					     (display:none, dispatchEvent vẫn fire handler). -->
					<button type="button" class="address-step__close" aria-label="Đóng" onclick={() => (stepOpen = false)}>
						<span class="address-step__close-icon" aria-hidden="true">✕</span>
					</button>
				</div>
			</Modal.Container.Header>
			<Modal.Container.Body class="address-step__body">
				<div class="address-step__search">
					<input
						type="text"
						bind:value={stepSearch}
						placeholder="Tìm kiếm..."
						enterkeyhint="search"
					/>
					{#if stepSearch}
						<button type="button" class="address-step__search-clear" aria-label="Xoá tìm kiếm" onclick={() => (stepSearch = '')}>✕</button>
					{/if}
				</div>
				<!-- Batch 20: breadcrumb row 2 DƯỚI search field (theo trục y, row
				     khác search field) — thể hiện VỊ TRÍ hiện tại: step tỉnh → 'Select
				     province'; step huyện → [tỉnh đã chọn] › 'Select district'; step
				     phường → [tỉnh] › [huyện] › 'Select ward'. Nấc ĐÃ CHỌN = button
				     tap quay lại (stepBack); nấc HIỆN TẠI = span không tap. Khác nav
				     "Đã chọn" phía trên (chips chỉ cấp có giá trị — giữ nguyên). -->
				<nav class="address-step__path" aria-label="Vị trí hiện tại">
					{#if stepLevel === 0}
						<span class="address-step__path-current">{tr('selectProvince')}</span>
					{:else if stepLevel === 1}
						{#if stepSelectedChain.some((sel) => sel.level === 0)}
							<button type="button" class="address-step__path-item" onclick={() => stepBack(0)}>
								{stepSelectedChain.find((sel) => sel.level === 0)?.label}
							</button>
						{:else}
							<span class="address-step__path-item address-step__path-item--static">{tr('selectProvince')}</span>
						{/if}
						<span class="address-step__path-sep" aria-hidden="true">›</span>
						<span class="address-step__path-current">{geoMode === 'new' && dualMode ? tr('selectWard') : tr('selectDistrict')}</span>
					{:else}
						{#if stepSelectedChain.some((sel) => sel.level === 0)}
							<button type="button" class="address-step__path-item" onclick={() => stepBack(0)}>
								{stepSelectedChain.find((sel) => sel.level === 0)?.label}
							</button>
						{:else}
							<span class="address-step__path-item address-step__path-item--static">{tr('selectProvince')}</span>
						{/if}
						<span class="address-step__path-sep" aria-hidden="true">›</span>
						{#if stepSelectedChain.some((sel) => sel.level === 1)}
							<button type="button" class="address-step__path-item" onclick={() => stepBack(1)}>
								{stepSelectedChain.find((sel) => sel.level === 1)?.label}
							</button>
						{:else}
							<span class="address-step__path-item address-step__path-item--static">{tr('selectDistrict')}</span>
						{/if}
						<span class="address-step__path-sep" aria-hidden="true">›</span>
						<span class="address-step__path-current">{tr('selectWard')}</span>
					{/if}
				</nav>
			<!-- Track slide: 2 lớp nội dung (cũ + mới) xếp chồng theo hướng stepDir -->
			<div class="address-step__list" role="listbox" aria-label="Danh sách địa giới">
				{#if stepLevel === 0}
					{#each stepProvinceOptions as opt (opt.value)}
						<button type="button" role="option" aria-selected={opt.value === (geoMode === 'new' && dualMode ? newBreakdown?.province : breakdown.province)} class="address-step__option" onclick={() => stepSelectLevel(0, opt.value)}>
							<span>{opt.label}</span>
							{#if opt.value === (geoMode === 'new' && dualMode ? newBreakdown?.province : breakdown.province)}
								<svg class="address-step__check" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
							{/if}
						</button>
					{/each}
					{#if !stepProvinceOptions.length}
						<div class="address-step__empty">Không tìm thấy kết quả</div>
					{/if}
				{:else if stepLevel === 1 && geoMode === 'new' && dualMode}
					{#each stepWardOptions as opt (opt.value)}
						<button type="button" role="option" aria-selected={opt.value === newBreakdown?.ward} class="address-step__option" onclick={() => stepSelectLevel(1, opt.value)}>
							<span>{opt.label}</span>
							{#if opt.value === newBreakdown?.ward}
								<svg class="address-step__check" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
							{/if}
						</button>
					{/each}
					{#if !stepWardOptions.length}
						<div class="address-step__empty">{newBreakdown?.province ? 'Không tìm thấy kết quả' : 'Chọn tỉnh/thành phố trước'}</div>
					{/if}
				{:else if stepLevel === 1}
					{#each stepDistrictOptions as opt (opt.value)}
						<button type="button" role="option" aria-selected={opt.value === breakdown.district} class="address-step__option" onclick={() => stepSelectLevel(1, opt.value)}>
							<span>{opt.label}</span>
							{#if opt.value === breakdown.district}
								<svg class="address-step__check" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
							{/if}
						</button>
					{/each}
					{#if !stepDistrictOptions.length}
						<div class="address-step__empty">{breakdown.province ? 'Không tìm thấy kết quả' : 'Chọn tỉnh/thành phố trước'}</div>
					{/if}
				{:else}
					{#each stepWardOptions as opt (opt.value)}
						<button type="button" role="option" aria-selected={opt.value === breakdown.ward} class="address-step__option" onclick={() => stepSelectLevel(2, opt.value)}>
							<span>{opt.label}</span>
							{#if opt.value === breakdown.ward}
								<svg class="address-step__check" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
							{/if}
						</button>
					{/each}
					{#if !stepWardOptions.length}
						<div class="address-step__empty">{breakdown.district ? 'Không tìm thấy kết quả' : 'Chọn quận/huyện trước'}</div>
					{/if}
				{/if}
			</div>
			</Modal.Container.Body>
		</Modal.Container>
	</Modal>
{/if}

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

	/* ── Batch14 (m11713-2): mobile step picker ── */
	/* Trigger-style button thay Select trên mobile — nhìn giống select-trigger
	   để giữ ngôn ngữ UI, nhưng là button thuần (mở step modal). */
	.address-input__step-trigger {
		display: inline-flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		width: 100%;
		min-height: 2.25rem;
		padding: 0.375rem 0.625rem;
		border: 1px solid var(--border, var(--default-300, #d1d5db));
		border-radius: 0.5rem;
		background: var(--background, #fff);
		color: var(--foreground, inherit);
		font-size: 0.875rem;
		text-align: left;
		cursor: pointer;
		transition: border-color 0.15s ease;

		&--placeholder {
			color: var(--foreground-400, hsl(0 0% 62%));
		}

		&--disabled {
			opacity: 0.6;
			pointer-events: none;
		}

		svg {
			flex: none;
			opacity: 0.6;
		}
	}

	/* Batch 19: step modal PORTAL qua Modal component — các class con KHÔNG còn
	   lồng trong cha .address-step (root div đã bỏ) → flatten CSS. Scoped
	   selector `.address-step .address-step__header` sẽ chết (không match) —
	   mỗi class tự đứng độc lập. Header nằm trong .modal-header-root (framework
	   negative-margin full-width), Body mang class address-step__body. */

	/* Header row (back + crumbs + ✕) — con của Modal.Container.Header:
	   flex full-width, framework Header đang justify-between → con tự quản.
	   Batch 20: position:relative để popover (.address-step__crumb-popover)
	   anchor đúng — header đã có z-index:1 riêng (framework) → stacking context
	   riêng, popover z-index trong context này thắng mọi nội dung body. */
	.address-step__header {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex: 1;
		min-width: 0;
		min-height: 2.5rem;
		position: relative;
	}

	/* Batch 22: .address-step__back đã BỎ khỏi UI (title modal không còn nút
	   back chevron — quay lại cấp qua path row). Chỉ còn .address-step__close. */
	.address-step__close {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: none;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--foreground, inherit);
		cursor: pointer;
		transition: background 0.15s ease;

		&:hover {
			background: var(--accent, hsl(0 0% 96%));
		}
	}

	/* Batch 20: ✕ trên breadcrumb đã BỎ khỏi UI — element .address-step__close
	   chỉ còn là span ẨN (display:none) giữ mechanism attemptCloseStepModal của
	   suppliers (querySelector + dispatchEvent vẫn fire handler trên display:none). */
	.address-step__close {
		display: none;
	}

	/* ✕ bọc span (batch 16) — kích thước theo nút, giữ stroke-like glyph.
	   Batch 20: icon ✕ không còn render (span ẩn không có con) — giữ rule phòng
	   khi revert. */
	.address-step__close-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25em;
		height: 1.25em;
		font-size: 1em;
		line-height: 1;
	}

	/* Batch 20: slot more — CỐ ĐỊNH 2rem luôn chiếm chỗ (kể cả khi ẩn) chống RO
	   ping-pong: measure tăng/giảm crumbOverflow không đổi nav clientWidth. */
	.address-step__more-wrap {
		flex: none;
		position: relative;
		width: 2rem;
		height: 2rem;
	}

	.address-step__more {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: none;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--foreground, inherit);
		cursor: pointer;
		transition: background 0.15s ease;

		&:hover {
			background: var(--accent, hsl(0 0% 96%));
		}
	}

	/* Popover các nấc bị gom — absolute trong .address-step__more-wrap; header
	   cha có stacking context riêng (z-index:1 framework) nên z-index:50 của
	   popover chỉ cần thắng trong context này (đè list/body bên dưới). */
	.address-step__crumb-popover {
		position: absolute;
		top: calc(100% + 0.35rem);
		left: 0;
		z-index: 50;
		min-width: 10rem;
		max-width: 16rem;
		padding: 0.35rem;
		background: var(--background, #fff);
		border: 1px solid var(--default-300, hsl(0 0% 89%));
		border-radius: 0.65rem;
		box-shadow: var(--box-shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1));
	}

	.address-step__crumb-popover-item {
		display: block;
		width: 100%;
		padding: 0.45rem 0.6rem;
		font-size: 0.8125rem;
		color: var(--foreground-600, var(--foreground, inherit));
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		background: none;
		border: none;
		border-radius: 0.45rem;
		cursor: pointer;

		&:hover {
			background: var(--default-100, hsl(0 0% 96%));
		}
	}

	.address-step__crumbs {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex: 1;
		min-width: 0;
		overflow-x: auto;
		white-space: nowrap;
		scrollbar-width: none;

		&::-webkit-scrollbar {
			display: none;
		}
	}

	.address-step__crumb {
		/* Batch 16 (mục 8): min-width:0 + ellipsis để từng phần co được trong flex
		   khi breadcrumb chật header. Batch 21: thứ tự cây root→lá — nấc CUỐI
		   (gần nhất: step đã chọn / page-current 'Địa chỉ') đầy đủ, nấc ĐẦU
		   (trang cha) ellipse khi chật và gom popover more. */
		min-width: 0;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--foreground-500, var(--foreground));
		background: none;
		border: none;
		padding: 0.125rem 0.25rem;
		border-radius: 0.375rem;
		cursor: pointer;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 9rem;

		&--current {
			color: var(--foreground, inherit);
			font-weight: 600;
			cursor: default;
			max-width: none;
			flex-shrink: 0;
		}

		/* current là nấc CUỐI cùng còn lại (mọi nấc khác đã gom popover) → cho
		   phép co/ellipsis chính nó để không tràn nav. (Batch 21: áp cho
		   page-current 'Địa chỉ' — nấc step hiện tại không còn nấc riêng.) */
		&--solo {
			flex-shrink: 1;
			min-width: 3rem;
		}
	}

	.address-step__crumb-sep {
		color: var(--foreground-400, hsl(0 0% 62%));
	}

	.address-step__search {
		position: relative;
		padding: 0.5rem 0.625rem;
		border-bottom: 1px solid var(--border, var(--default-200, #e5e7eb));

		input {
			width: 100%;
			min-height: 2.25rem;
			padding: 0.375rem 0.625rem;
			border: 1px solid var(--border, var(--default-300, #d1d5db));
			border-radius: 0.5rem;
			background: var(--background, #fff);
			color: var(--foreground, inherit);
			font-size: 0.875rem;
			outline: none;

			&:focus {
				border-color: var(--primary);
			}
		}
	}

	.address-step__search-clear {
		position: absolute;
		right: 1rem;
		top: 50%;
		transform: translateY(-50%);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		padding: 0;
		border: none;
		border-radius: 9999px;
		background: var(--default-200, hsl(0 0% 92%));
		color: var(--foreground-500, inherit);
		font-size: 0.625rem;
		cursor: pointer;
	}

	/* Body của Modal (address-step__body): cột flex chiếm hết chiều cao —
	   selected + search cố định trên, list scroll nội bộ (pattern
	   .select-fullscreen-body batch 12). BẪY batch12: class nằm trên element
	   render bởi Modal.Container.Body (component khác) → scoped selector bị
	   prune ("Unused CSS selector") → :global() bắt buộc. */
	:global(.address-step__body) {
		display: flex;
		flex-direction: column;
	}

	.address-step__list {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: 0.25rem 0.375rem 1rem;
	}

	.address-step__option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		width: 100%;
		padding: 0.625rem 0.625rem;
		border: none;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--foreground, inherit);
		font-size: 0.875rem;
		text-align: left;
		cursor: pointer;
		transition: background 0.12s ease;

		&:active {
			background: var(--accent, hsl(0 0% 96%));
		}

		&[aria-selected='true'] {
			color: var(--primary, hsl(212 92% 45%));
			font-weight: 600;
		}
	}

	.address-step__check {
		flex: none;
	}

	.address-step__empty {
		padding: 1.5rem 0.625rem;
		text-align: center;
		font-size: 0.8125rem;
		color: var(--foreground-400, hsl(0 0% 62%));
	}

	/* Batch 20: breadcrumb row 2 DƯỚI search field — vị trí hiện tại
	   [tỉnh] › [huyện] › Select ward; nấc đã chọn = button stepBack, nấc hiện
	   tại = span. Ellipsis đầy đủ (min-width:0 + overflow + text-overflow). */
	.address-step__path {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.375rem 0.625rem;
		border-bottom: 1px solid var(--border, var(--default-200, hsl(0 0% 92%)));
	}

	.address-step__path-item,
	.address-step__path-current {
		min-width: 0;
		max-width: 100%;
		font-size: 0.8125rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.address-step__path-item {
		font-weight: 500;
		color: var(--foreground-500, var(--foreground, inherit));
		background: none;
		border: none;
		padding: 0.125rem 0.25rem;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: background 0.15s ease;

		&:hover {
			background: var(--accent, hsl(0 0% 96%));
		}

		/* nấc chưa chọn (placeholder) — không tap, màu nhạt hơn */
		&--static {
			color: var(--foreground-400, hsl(0 0% 62%));
			cursor: default;
		}
	}

	.address-step__path-current {
		flex-shrink: 0;
		font-weight: 600;
		color: var(--foreground, inherit);
		padding: 0.125rem 0.25rem;
	}

	.address-step__path-sep {
		flex: none;
		color: var(--foreground-400, hsl(0 0% 62%));
	}

	/* ── Batch 20: FULL SIZE step modal — bỏ padding/margin với viewport ──
	   .modal-root framework có padding:1rem (modal/Main.svelte) + container
	   max-width calc(100vw-2rem)/max-height (container/Main.svelte) → step modal
	   hiện chật. Class riêng .address-step-modal (props.class CỘT lên .modal-root
	   qua configs.style styleSynced) → chỉ step modal full size, không đụng modal
	   khác. padding:0 trên container làm header negative-margin (theo --padding)
	   tự flush sát mép. size-full đã width/height 100% radius 0. */
	:global(.modal-root.modal-root.address-step-modal) {
		padding: 0;
		align-items: stretch;
	}

	:global(.modal-root.modal-root.address-step-modal .modal-container-root) {
		padding: 0;
		--padding: 0;
		max-width: none;
		max-height: none;
		width: 100%;
		height: 100%;
	}
</style>
