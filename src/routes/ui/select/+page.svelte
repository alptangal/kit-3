<!-- src/routes/ui/select/+page.svelte -->
<script lang="ts">
	import Select from '$lib/components/form/select';
	import { Label } from '$lib/components/form';
	import type { SelectOption } from '$lib/components/form/select';

	let singleValue = $state('');
	let multiValue = $state<string[]>([]);
	let showMulti = $state(false);

	// Demo search NHẠY DẤU (probe):
	//  - query "truong" (không dấu) → khớp "Trường" (wildcard dấu).
	//  - query "ha noi" (không dấu) → khớp "Hà Nội".
	//  - query "á" (CÓ dấu) → CHỈ khớp đúng "Thái" (gốc Thái Bình), KHÔNG khớp
	//    "Hà Nội"/"Đà Nẵng" (chúng có à chứ không phải á).
	let vnValue = $state('');
	const vnOptions: SelectOption[] = [
		{ value: 'hn', label: 'Hà Nội', description: 'Thủ đô' },
		{ value: 'dn', label: 'Đà Nẵng', description: 'Thành phố biển' },
		{ value: 'tb', label: 'Thái Bình', description: 'Tỉnh ven biển' },
		{ value: 'ht', label: 'Hải Phòng', description: 'Cảng lớn' },
		{ value: 'ninh-ku', label: 'Ninh Kinh', description: 'Làng cổ' },
		{ value: 'truong-gia', label: 'Trường Gia', description: 'Cơ sở giáo dục' }
	];

	const simpleOptions: SelectOption[] = [
		{ value: 'apple', label: 'Apple' },
		{ value: 'banana', label: 'Banana' },
		{ value: 'cherry', label: 'Cherry' },
		{ value: 'date', label: 'Date' },
		{ value: 'lemon', label: 'Lemon' },
		{ value: 'orange', label: 'Orange' },
		{ value: 'disabled', label: 'Disabled Option', disabled: true }
	];

	const colorOptions: SelectOption[] = [
		{ value: 'red', label: 'Red' },
		{ value: 'green', label: 'Green' },
		{ value: 'blue', label: 'Blue' },
		{ value: 'yellow', label: 'Yellow' },
		{ value: 'purple', label: 'Purple' }
	];

	// Tag input demo (allowCreate)
	let tags = $state<string[]>([]);
	const createLabel = { en: 'Add {value}', vi: 'Thêm {value}' };

	// ── Demo: Select-all (multiple) ──
	let selectAllValue = $state<string[]>([]);

	// ── Demo: Load-more (scroll / button / pagination) ──
	const longOptions: SelectOption[] = Array.from({ length: 40 }, (_, i) => ({
		value: `item-${i + 1}`,
		label: `Item ${i + 1}`
	}));
	let loadMoreMode = $state<'scroll' | 'button' | 'pagination'>('scroll');
	let loadMoreValue = $state('');

	// ── Demo: Sort (alpha / date) ──
	const sortOptions: SelectOption[] = [
		{ value: 'release-2024-06', label: 'Release Q2', date: '2024-06-12' },
		{ value: 'no-date', label: 'Không có ngày' },
		{ value: 'release-2025-03', label: 'Release Q1 2025', date: '2025-03-04' },
		{ value: 'release-2024-11', label: 'Release Q4', date: '2024-11-28' },
		{ value: 'release-2025-09', label: 'Release Q3 2025', date: '2025-09-01' },
		{ value: 'release-2024-01', label: 'Release Q1', date: '2024-01-15' }
	];
	let sortValue = $state('');
	let sortField = $state<'alpha' | 'date' | undefined>('alpha');
	let sortDir = $state<'asc' | 'desc'>('asc');
	let sortLog = $state<string[]>([]);

	// ── Demo: Remote search (loading indicator) + data source ──
	let remoteValue = $state('');
	let remoteQueryLog = $state<string[]>([]);
	// Giả lập nguồn DB: mock data + delay
	const mockRemoteData: SelectOption[] = [
		{ value: 'vn-hn', label: 'Hà Nội' },
		{ value: 'vn-hcm', label: 'TP. Hồ Chí Minh' },
		{ value: 'vn-dn', label: 'Đà Nẵng' },
		{ value: 'vn-nt', label: 'Nha Trang' },
		{ value: 'vn-hai-phong', label: 'Hải Phòng' },
		{ value: 'us-ny', label: 'New York' },
		{ value: 'us-la', label: 'Los Angeles' },
		{ value: 'us-sf', label: 'San Francisco' },
		{ value: 'jp-tyo', label: 'Tokyo' },
		{ value: 'jp-osa', label: 'Osaka' }
	];
	const loadRemoteOptions = (query?: string): Promise<SelectOption[]> =>
		new Promise((resolve) =>
			setTimeout(() => {
				const q = (query ?? '').toLowerCase();
				resolve(q ? mockRemoteData.filter((o) => o.label.toLowerCase().includes(q)) : mockRemoteData);
			}, 600)
		);

	// ── Demo: Update / delete option (edit/delete) ──
	let editableOptions = $state<SelectOption[]>([
		{ value: 'a', label: 'Alpha' },
		{ value: 'b', label: 'Bravo' },
		{ value: 'c', label: 'Charlie' }
	]);
	let editValue = $state('');
	let editLog = $state<string[]>([]);

	// ── Demo: Validation (required + custom, độc lập) ──
	let validatedValue = $state('');

	// ── Demo: Chip overflow (multiple, tự đo width +N) ──
	const chipOptions: SelectOption[] = [
		{ value: 'vuejs', label: 'Vue.js Framework' },
		{ value: 'reactjs', label: 'React Ecosystem' },
		{ value: 'sveltekit', label: 'SvelteKit Advanced' },
		{ value: 'ngultrix', label: 'Angular Universal' },
		{ value: 'solidui', label: 'SolidUI Core' },
		{ value: 'qtafw', label: 'Qwik Astro' },
		{ value: 'preactx', label: 'Preact Signals' },
		{ value: 'litelf', label: 'Lit Elements' }
	];
	let chipsValue = $state<string[]>([]);
	let chipRemoveLog = $state<string[]>([]);

	// ── Demo: Auto-flip (container cao, select ở đáy → flip UP) ──
	let flipBottomValue = $state('');
	let flipTopValue = $state('');

	// ── Demo: Manual position (M1 — user cố định hướng left/right/up/down) ──
	let manualLeftValue = $state('');
	let manualRightValue = $state('');
	let manualUpValue = $state('');

	// ── Demo: Select-all + Sort cùng 1 row (M4/M5/M6) ──
	let selectAllSortValue = $state<string[]>([]);
	let selectAllSortField = $state<'alpha' | 'date' | undefined>('alpha');
	let selectAllSortDir = $state<'asc' | 'desc'>('asc');

	// ── Demo: Fullscreen + Backdrop ──
	let fullscreenValue = $state('');
	let backdropValue = $state('');

	// ── Demo: Rich options (avatar + description) ──
	const avatarOptions: SelectOption[] = [
		{
			value: 'vue',
			label: 'Vue',
			image:
				'data:image/svg+xml;utf8,' +
				encodeURIComponent(
					'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="20" fill="#42b883"/><text x="20" y="26" font-size="20" fill="#fff" text-anchor="middle" font-family="sans-serif">V</text></svg>'
				),
			description: 'Progressive framework cho UI'
		},
		{
			value: 'react',
			label: 'React',
			image:
				'data:image/svg+xml;utf8,' +
				encodeURIComponent(
					'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="20" fill="#61dafb"/><text x="20" y="26" font-size="20" fill="#fff" text-anchor="middle" font-family="sans-serif">R</text></svg>'
				),
			description: 'Library JSX-based cho component'
		},
		{
			value: 'svelte',
			label: 'Svelte',
			image:
				'data:image/svg+xml;utf8,' +
				encodeURIComponent(
					'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="20" fill="#ff3e00"/><text x="20" y="26" font-size="20" fill="#fff" text-anchor="middle" font-family="sans-serif">S</text></svg>'
				),
			description: 'Compiler-based, không virtual DOM'
		}
	];
	let richValue = $state('');

	// ── Demo: Required + Label sync (đồng bộ asterisk/màu/for-id) ──
	let requiredValue = $state('');

	// ── Demo: Disabled (polish) ──
	let disabledSingleValue = $state('apple');
	let disabledMultiValue = $state(['red', 'green']);
</script>

<div style="padding: 2rem; max-width: 600px; font-family: system-ui;">
	<h1>Select Component Demo</h1>

	<!-- Single Select -->
	<section style="margin-bottom: 3rem;">
		<h2>Single Select</h2>
		<label for="demo-single" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
			Choose a fruit:
		</label>

		<Select
			bind:value={singleValue}
			options={simpleOptions}
			placeholder="Pick a fruit..."
			searchable
			clearable
		/>

		<p style="margin-top: 1rem; font-size: 0.875rem; color: #666;">
			Selected: <code>{singleValue || '(none)'}</code>
		</p>
	</section>

	<!-- Search nhạy dấu (probe) -->
	<section style="margin-bottom: 3rem;">
		<h2>Search Highlight + Filter nhạy dấu</h2>
		<p style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">
			Search <strong>nhạy dấu</strong> (đúng hệ ngôn ngữ):
			gõ <code>truong</code> (không dấu) → khớp <code>Trường Gia</code> (wildcard dấu);
			gõ <code>á</code> (CÓ dấu) → <strong>CHỈ</strong> khớp <code>Thái Bình</code> (chữ "Thá<u>i</u>"),
			<strong>không</strong> khớp <code>Hà Nội</code>/<code>Đà Nẵng</code> (chúng có "à", không phải "á").
			Phần khớp được highlight (màu primary + đậm).
		</p>
		<div data-test="vn-select-wrap">
			<Select
				bind:value={vnValue}
				options={vnOptions}
				searchable
				clearable
				placeholder="Tìm thành phố / cơ sở..."
			/>
		</div>
		<p style="margin-top: 1rem; font-size: 0.875rem; color: #666;">
			Selected: <code>{vnValue || '(none)'}</code>
		</p>
	</section>

	<!-- Multi Select -->
	<section style="margin-bottom: 3rem;">
		<h2>Multi Select</h2>
		<label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
			<input type="checkbox" bind:checked={showMulti} />
			Enable Multi-Select
		</label>

		{#if showMulti}
			<label for="demo-multi" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
				Choose colors:
			</label>

			<Select
				bind:value={multiValue}
				options={colorOptions}
				mode="multiple"
				placeholder="Pick colors..."
				searchable
				clearable
			/>

			<p style="margin-top: 1rem; font-size: 0.875rem; color: #666;">
				Selected: <code>{JSON.stringify(multiValue)}</code>
			</p>
		{/if}
	</section>

	<!-- Select-All (multiple) -->
	<section style="margin-bottom: 3rem;">
		<h2>Select-All (multiple)</h2>
		<p style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">
			Row đầu danh sách cho phép chọn/bỏ chọn TẤT CẢ option khả dụng (indicator check / gạch khi chọn một phần).
		</p>
		<Select
			bind:value={selectAllValue}
			options={simpleOptions}
			mode="multiple"
			searchable
			clearable
			showSelectAll
		/>
		<p style="margin-top: 1rem; font-size: 0.875rem; color: #666;">
			Selected: <code>{JSON.stringify(selectAllValue)}</code>
		</p>
	</section>

	<!-- Load-more (scroll / button / pagination) -->
	<section style="margin-bottom: 3rem;">
		<h2>Load-more (scroll / button / pagination)</h2>
		<p style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">
			40 option, giới hạn render theo không gian. Đổi chế độ để xem: scroll-to-load, nút load-more, phân trang.
		</p>
		<label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
			<select bind:value={loadMoreMode} style="padding: 0.25rem; border: 1px solid #ccc; border-radius: 4px;">
				<option value="scroll">scroll</option>
				<option value="button">button</option>
				<option value="pagination">pagination</option>
			</select>
		</label>
		<Select
			bind:value={loadMoreValue}
			options={longOptions}
			maxHeight={220}
			maxOptions={6}
			loadMoreMode={loadMoreMode}
			loadMoreLabel={{ en: 'Load more', vi: 'Tải thêm' }}
			pageSize={4}
			searchable
		/>
		<p style="margin-top: 1rem; font-size: 0.875rem; color: #666;">
			Selected: <code>{loadMoreValue || '(none)'}</code>
		</p>
	</section>

	<!-- Sort (alpha / date) -->
	<section style="margin-bottom: 3rem;">
		<h2>Sort options (alpha / date)</h2>
		<p style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">
			Control "Xếp theo" trong dropdown: chọn trường (tên / ngày) + đảo chiều. Option "Không có ngày"
			thiếu <code>date</code> → luôn ở cuối khi sort theo ngày. <code>sort</code> /
			<code>sortDirection</code> bindable → state ở page cập nhật theo user.
		</p>
		<Select
			bind:value={sortValue}
			options={sortOptions}
			showSort
			bind:sort={sortField}
			bind:sortDirection={sortDir}
			onSortChange={(f, d) => sortLog.unshift(`${f}/${d}`)}
		/>
		<p style="margin-top: 1rem; font-size: 0.875rem; color: #666;">
			Selected: <code>{sortValue || '(none)'}</code> · sort: <code>{sortField ?? '(nguồn)'} / {sortDir}</code>
		</p>
		{#if sortLog.length}
			<p style="margin-top: 0.25rem; font-size: 0.8125rem; color: #666;">
				onSortChange: <code>{sortLog.slice(0, 5).join(' → ')}</code>
			</p>
		{/if}
	</section>

	<!-- Select-all + Sort cùng 1 row (M4/M5/M6) -->
	<section style="margin-bottom: 3rem;">
		<h2>Select-All + Sort (cùng 1 row)</h2>
		<p style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">
			Đồng thời <code>showSelectAll</code> + <code>showSort</code> → 2 cụm nằm
			<b>cùng 1 hàng</b> (space-between giữa "Chọn tất cả" và "Xếp theo"),
			mỗi cụm <b>width fit</b> (không full-width), <b>bóng đổ</b> nhẹ thay vì
			flat. Viewport quá hẹp (thử thu nhỏ) mới ngắt dòng.
		</p>
		<Select
			bind:value={selectAllSortValue}
			mode="multiple"
			options={sortOptions}
			showSelectAll
			showSort
			bind:sort={selectAllSortField}
			bind:sortDirection={selectAllSortDir}
		/>
		<p style="margin-top: 1rem; font-size: 0.875rem; color: #666;">
			Selected: <code>{selectAllSortValue.length ? JSON.stringify(selectAllSortValue) : '(none)'}</code>
			· sort: <code>{selectAllSortField ?? '(nguồn)'} / {selectAllSortDir}</code>
		</p>
	</section>

	<!-- Remote search (loading indicator + data source) -->
	<section style="margin-bottom: 3rem;">
		<h2>Remote Search (loading indicator)</h2>
		<p style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">
			Nguồn option mock (độ trễ 600ms). Spinner hiện trong ô search khi remote search đang chạy.
		</p>
		<Select
			bind:value={remoteValue}
			loadOptions={loadRemoteOptions}
			remoteSearch
			searchDelay={300}
			maxOptions={20}
			onSearch={(q) => remoteQueryLog.push(q)}
			onValueChange={(v) => console.log('[remote] value:', v)}
			searchable
			clearable
			placeholder="Gõ để tìm thành phố..."
		/>
		<p style="margin-top: 1rem; font-size: 0.875rem; color: #666;">
			Selected: <code>{remoteValue || '(none)'}</code>
		</p>
		{#if remoteQueryLog.length}
			<p style="font-size: 0.8rem; color: #888;">
				onSearch (debounced): <code>{remoteQueryLog.join(' → ')}</code>
			</p>
		{/if}
	</section>

	<!-- Update / delete option -->
	<section style="margin-bottom: 3rem;">
		<h2>Update / Delete Option</h2>
		<p style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">
			Hover option hiện nút pencil (sửa) và trash (xóa). Component chỉ emit event — page tự cập nhật source.
		</p>
		<Select
			bind:value={editValue}
			options={editableOptions}
			editableOptions
			deletableOptions
			onOptionUpdate={(v, newLabel) => {
				editableOptions = editableOptions.map((o) => (o.value === v ? { ...o, label: newLabel } : o));
				editLog.push(`update ${v} → "${newLabel}"`);
			}}
			onOptionDelete={(v) => {
				editableOptions = editableOptions.filter((o) => o.value !== v);
				editLog.push(`delete ${v}`);
			}}
		/>
		<p style="margin-top: 1rem; font-size: 0.875rem; color: #666;">
			Selected: <code>{editValue || '(none)'}</code>
		</p>
		{#if editLog.length}
			<p style="font-size: 0.8rem; color: #888;">
				Log: <code>{editLog.join(' · ')}</code>
			</p>
		{/if}
	</section>

	<!-- Validation (độc lập) -->
	<section style="margin-bottom: 3rem;">
		<h2>Validation (required + custom)</h2>
		<p style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">
			Required + validator custom (label phải chứa chữ "a"). Border đổi màu theo trạng thái sau khi chọn/bỏ focus.
		</p>
		<Select
			bind:value={validatedValue}
			options={simpleOptions}
			required
			validation={{
				// Invalid khi chọn option label KHÔNG chứa chữ "a" (vd 'cherry', 'lemon'), valid với các option còn lại
				change: [
					(val) => {
						if (!val) return true; // required đã xử lý giá trị rỗng
						const opt = simpleOptions.find((o) => o.value === val);
						return !!opt && opt.label.toLowerCase().includes('a');
					}
				],
				operator: 'and'
			}}
			placeholder="Chọn option chứa chữ 'a'..."
		/>
		<p style="margin-top: 1rem; font-size: 0.875rem; color: #666;">
			Selected: <code>{validatedValue || '(none)'}</code>
		</p>
	</section>

	<!-- Create Option (search & add new value) -->
	<section style="margin-bottom: 3rem;">
		<h2>Create Option (allowCreate)</h2>
		<label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
			Add tags (type a new value to create it):
		</label>
		<Select
			bind:value={tags}
			mode="multiple"
			options={colorOptions}
			searchable
			clearable
			allowCreate
			createOptionLabel={createLabel}
		/>
		<p style="margin-top: 1rem; font-size: 0.875rem; color: #666;">
			Selected: <code>{JSON.stringify(tags)}</code>
		</p>
	</section>

	<!-- Chip overflow (multiple) -->
	<section style="margin-bottom: 3rem;">
		<h2>Chip Overflow (multiple)</h2>
		<p style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">
			Chọn nhiều option → hiển thị chip (tự đo width để vừa trigger). Phần vượt gom vào
			1 chip <code>+N</code>, ưu tiên option mới nhất. Bấm <code>×</code> trên chip để bỏ chọn riêng.
			Đủ chỗ: hiện chip thật; hết chỗ: chip cũ nhất bị gom vào <code>+N</code>.
		</p>
		<div>
			<Select
				bind:value={chipsValue}
				options={chipOptions}
				mode="multiple"
				searchable
				showChips
				removableChips
				chipTruncateLength={12}
				onChipRemove={(v) => chipRemoveLog.push(v)}
			/>
		</div>
		<p style="margin-top: 1rem; font-size: 0.875rem; color: #666;">
			Selected: <code>{JSON.stringify(chipsValue)}</code>
		</p>
		{#if chipRemoveLog.length}
			<p style="font-size: 0.8rem; color: #888;">
				onChipRemove: <code>{chipRemoveLog.join(' · ')}</code>
			</p>
		{/if}
	</section>

	<!-- Auto-flip position -->
	<section style="margin-bottom: 3rem;">
		<h2>Auto-Flip Position</h2>
		<p style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">
			Panel tự flip UP/DOWN theo không gian viewport. Select ở đáy container (70vh) sẽ mở panel hướng lên.
		</p>
		<div style="height: 70vh; border: 1px dashed #ccc; border-radius: 0.5rem; display: flex; flex-direction: column; justify-content: space-between; padding: 1rem;">
			<div style="max-width: 260px;">
				<label style="display: block; margin-bottom: 0.25rem; font-size: 0.8rem; color: #888;">
					Gần top → panel DOWN
				</label>
				<Select bind:value={flipTopValue} options={colorOptions} position="auto" searchable />
			</div>
			<div style="max-width: 260px; align-self: flex-end;">
				<label style="display: block; margin-bottom: 0.25rem; font-size: 0.8rem; color: #888; text-align: right;">
					Gần đáy → panel UP
				</label>
				<Select bind:value={flipBottomValue} options={colorOptions} position="auto" searchable />
			</div>
		</div>
	</section>

	<!-- Manual position (M1) -->
	<section style="margin-bottom: 3rem;">
		<h2>Manual Position (user chọn hướng)</h2>
		<p style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">
			Prop <code>position</code> cố định hướng: <code>left</code> / <code>right</code> /
			<code>up</code> / <code>down</code> — không auto-flip. Panel mở ngang có width bằng
			width trigger, top căn theo trigger, animation trượt theo trục X.
		</p>
		<div style="display: flex; gap: 2rem; flex-wrap: wrap;">
			<div style="max-width: 240px;">
				<label style="display: block; margin-bottom: 0.25rem; font-size: 0.8rem; color: #888;">
					position="left" (mở bên TRÁI trigger)
				</label>
				<Select bind:value={manualLeftValue} options={colorOptions} position="left" searchable />
			</div>
			<div style="max-width: 240px;">
				<label style="display: block; margin-bottom: 0.25rem; font-size: 0.8rem; color: #888;">
					position="right" (mở bên PHẢI trigger)
				</label>
				<Select bind:value={manualRightValue} options={colorOptions} position="right" searchable />
			</div>
			<div style="max-width: 240px;">
				<label style="display: block; margin-bottom: 0.25rem; font-size: 0.8rem; color: #888;">
					position="up" (cố định TRÊN)
				</label>
				<Select bind:value={manualUpValue} options={colorOptions} position="up" searchable />
			</div>
		</div>
	</section>

	<!-- Fullscreen -->
	<section style="margin-bottom: 3rem;">
		<h2>Fullscreen</h2>
		<p style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">
			Khi mở, panel che toàn bộ viewport (CSS overlay, z=9500). Có header title + nút đóng, khóa scroll body.
		</p>
		<Select
			bind:value={fullscreenValue}
			options={colorOptions}
			fullscreen
			searchable
			clearable
			placeholder="Mở full screen..."
		/>
		<p style="margin-top: 1rem; font-size: 0.875rem; color: #666;">
			Selected: <code>{fullscreenValue || '(none)'}</code>
		</p>
	</section>

	<!-- Backdrop -->
	<section style="margin-bottom: 3rem;">
		<h2>Backdrop (blur nền)</h2>
		<p style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">
			Mờ + blur vùng nền (dim 0.45 + blur 4px, z=40). Click vùng nền để đóng panel.
		</p>
		<Select
			bind:value={backdropValue}
			options={colorOptions}
			backdrop
			searchable
			clearable
			placeholder="Mở có backdrop..."
		/>
		<p style="margin-top: 1rem; font-size: 0.875rem; color: #666;">
			Selected: <code>{backdropValue || '(none)'}</code>
		</p>
	</section>

	<!-- Rich Options (avatar + description) -->
	<section style="margin-bottom: 3rem;">
		<h2>Rich Options (avatar + description)</h2>
		<p style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">
			Option có <code>image</code> (circle avatar) + <code>description</code> (dòng mô tả phụ bên
			dưới label).
		</p>
		<Select bind:value={richValue} options={avatarOptions} searchable clearable />
		<p style="margin-top: 1rem; font-size: 0.875rem; color: #666;">
			Selected: <code>{richValue || '(none)'}</code>
		</p>
	</section>

	<!-- Required + Label sync (đồng bộ asterisk/màu/for-id qua select-context) -->
	<section style="margin-bottom: 3rem;">
		<h2>Required + Label sync</h2>
		<p style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">
			<code>&lt;Label&gt;</code> nằm trong <code>&lt;Select&gt;</code> (slot) đọc select-context: hiện
			<code>*</code> khi required, đổi màu theo validation, <code>for</code>/<code>id</code> link về
			trigger (click label mở dropdown).
		</p>
		<Select bind:value={requiredValue} options={simpleOptions} required name="sel-sync" searchable>
			<Label>Chọn trái cây (bắt buộc)</Label>
		</Select>
		<p style="margin-top: 1rem; font-size: 0.875rem; color: #666;">
			Selected: <code>{requiredValue || '(none)'}</code>
		</p>
	</section>

	<!-- Disabled (polish) -->
	<section style="margin-bottom: 3rem;">
		<h2>Disabled (polish)</h2>
		<p style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">
			Khi disabled: trigger không mở, nút clear ẩn (kể cả có value), chip không hiện nút ×.
		</p>
		<div style="display: flex; flex-direction: column; gap: 0.75rem;">
			<div>
				<label style="display: block; margin-bottom: 0.25rem; font-size: 0.8rem; color: #888;">
					Disabled (single, có value → clear ẩn)
				</label>
				<Select bind:value={disabledSingleValue} options={simpleOptions} clearable disabled />
			</div>
			<div>
				<label style="display: block; margin-bottom: 0.25rem; font-size: 0.8rem; color: #888;">
					Disabled (multiple, chip không có ×)
				</label>
				<Select
					bind:value={disabledMultiValue}
					options={colorOptions}
					mode="multiple"
					showChips
					removableChips
					clearable
					disabled
				/>
			</div>
		</div>
	</section>

	<!-- Keyboard Navigation Guide -->
	<section style="background: #f5f5f5; padding: 1rem; border-radius: 0.5rem; margin-bottom: 2rem;">
		<h3 style="margin-top: 0;">Keyboard Navigation</h3>
		<ul style="font-size: 0.875rem; margin: 0.5rem 0;">
			<li><kbd>Enter</kbd> or <kbd>Space</kbd> to open</li>
			<li><kbd>↓</kbd> / <kbd>↑</kbd> to navigate options</li>
			<li><kbd>Enter</kbd> to select</li>
			<li><kbd>Escape</kbd> to close</li>
			<li>Type to search (when searchable)</li>
		</ul>
	</section>

	<!-- Test Results Placeholder -->
	<section style="border: 1px solid #ddd; padding: 1rem; border-radius: 0.5rem;">
		<h3 style="margin-top: 0;">Test Checklist</h3>
		<label style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
			<input type="checkbox" disabled checked />
			<span>Component renders</span>
		</label>
		<label style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
			<input type="checkbox" disabled />
			<span>Click trigger opens dropdown</span>
		</label>
		<label style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
			<input type="checkbox" disabled />
			<span>Keyboard navigation works</span>
		</label>
		<label style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
			<input type="checkbox" disabled />
			<span>Search filter works</span>
		</label>
		<label style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
			<input type="checkbox" disabled />
			<span>Multi-select works</span>
		</label>
	</section>
</div>

<style>
	:global(body) {
		background: #fafafa;
	}

	h1, h2, h3 {
		margin-top: 1.5rem;
		margin-bottom: 0.5rem;
	}

	section {
		margin-bottom: 2rem;
	}

	code {
		background: #f0f0f0;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-family: 'Courier New', monospace;
		font-size: 0.9em;
	}

	kbd {
		background: #333;
		color: #fff;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.85em;
		font-family: monospace;
	}

	ul {
		list-style-position: inside;
	}
</style>
