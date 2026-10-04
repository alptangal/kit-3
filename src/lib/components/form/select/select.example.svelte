<script lang="ts">
	import { Select } from './index';
	import type { SelectOption, SelectOptionGroup } from './_interface';

	// Simple options
	const simpleOptions: SelectOption[] = [
		{ value: 'vietnam', label: 'Việt Nam' },
		{ value: 'usa', label: 'Hoa Kỳ' },
		{ value: 'japan', label: 'Nhật Bản' },
		{ value: 'korea', label: 'Hàn Quốc' },
		{ value: 'singapore', label: 'Singapore' },
		{ value: 'disabled', label: 'Disabled option', disabled: true }
	];

	// Option groups
	const optionGroups: SelectOptionGroup[] = [
		{
			label: 'Đông Nam Á',
			options: [
				{ value: 'vietnam', label: 'Việt Nam' },
				{ value: 'thailand', label: 'Thái Lan' },
				{ value: 'indonesia', label: 'Indonesia' },
				{ value: 'malaysia', label: 'Malaysia' }
			]
		},
		{
			label: 'Bắc Á',
			options: [
				{ value: 'china', label: 'Trung Quốc' },
				{ value: 'japan', label: 'Nhật Bản' },
				{ value: 'korea', label: 'Hàn Quốc' }
			]
		},
		{
			label: 'Mỹ',
			options: [
				{ value: 'usa', label: 'Hoa Kỳ' },
				{ value: 'canada', label: 'Canada' },
				{ value: 'mexico', label: 'Mexico' }
			]
		}
	];

	// Reactive values
	let singleValue = $state<string>('');
	let multiValue = $state<string[]>([]);
	let singleValueWithGroups = $state<string>('');
	let requiredValue = $state<string>('');
</script>

<div class="space-y-8 p-6 max-w-2xl">
	<!-- Basic Single Select -->
	<section class="space-y-2">
		<h3 class="text-lg font-medium">Basic Single Select</h3>
		<Select
			bind:value={singleValue}
			options={simpleOptions}
			placeholder="Chọn quốc gia..."
			clearable={true}
			searchable={false}
		/>
		<p class="text-sm text-muted">Value: {singleValue || 'none'}</p>
	</section>

	<!-- Searchable Single Select -->
	<section class="space-y-2">
		<h3 class="text-lg font-medium">Searchable Single Select</h3>
		<Select
			bind:value={singleValue}
			options={simpleOptions}
			placeholder="Tìm kiếm quốc gia..."
			clearable={true}
			searchable={true}
			searchPlaceholder="Nhập để tìm kiếm..."
		/>
		<p class="text-sm text-muted">Value: {singleValue || 'none'}</p>
	</section>

	<!-- Select with Option Groups -->
	<section class="space-y-2">
		<h3 class="text-lg font-medium">Select with Option Groups</h3>
		<Select
			bind:value={singleValueWithGroups}
			optionGroups={optionGroups}
			placeholder="Chọn khu vực..."
			clearable={true}
			searchable={true}
		/>
		<p class="text-sm text-muted">Value: {singleValueWithGroups || 'none'}</p>
	</section>

	<!-- Multiple Select -->
	<section class="space-y-2">
		<h3 class="text-lg font-medium">Multiple Select</h3>
		<Select
			bind:value={multiValue}
			options={simpleOptions}
			mode="multiple"
			placeholder="Chọn nhiều quốc gia..."
			clearable={true}
			searchable={true}
		/>
		<p class="text-sm text-muted">Value: {JSON.stringify(multiValue)}</p>
	</section>

	<!-- Required Select with Validation -->
	<section class="space-y-2">
		<h3 class="text-lg font-medium">Required Select (Validation)</h3>
		<Select
			bind:value={requiredValue}
			options={simpleOptions}
			placeholder="Bắt buộc chọn..."
			required={true}
			clearable={true}
			validation={{
				required: {
					isValid: (val) => Boolean(val),
					message: {
						valid: 'Hợp lệ',
						invalid: 'Vui lòng chọn một quốc gia'
					}
				}
			}}
		/>
		<p class="text-sm text-muted">Value: {requiredValue || 'none'}</p>
	</section>

	<!-- Disabled Select -->
	<section class="space-y-2">
		<h3 class="text-lg font-medium">Disabled Select</h3>
		<Select
			value="vietnam"
			options={simpleOptions}
			disabled={true}
			placeholder="Disabled"
		/>
	</section>

	<!-- Different Sizes -->
	<section class="space-y-2">
		<h3 class="text-lg font-medium">Different Sizes</h3>
		<div class="flex gap-4 flex-wrap">
			<div class="w-48">
				<p class="text-xs text-muted mb-1">xs</p>
				<Select
					options={simpleOptions}
					size="xs"
					placeholder="Extra small"
				/>
			</div>
			<div class="w-48">
				<p class="text-xs text-muted mb-1">sm</p>
				<Select
					options={simpleOptions}
					size="sm"
					placeholder="Small"
				/>
			</div>
			<div class="w-48">
				<p class="text-xs text-muted mb-1">md</p>
				<Select
					options={simpleOptions}
					size="md"
					placeholder="Medium"
				/>
			</div>
			<div class="w-48">
				<p class="text-xs text-muted mb-1">lg</p>
				<Select
					options={simpleOptions}
					size="lg"
					placeholder="Large"
				/>
			</div>
		</div>
	</section>

	<!-- Different Variants -->
	<section class="space-y-2">
		<h3 class="text-lg font-medium">Different Variants</h3>
		<div class="flex gap-4 flex-wrap">
			<div class="w-48">
				<p class="text-xs text-muted mb-1">secondary</p>
				<Select
					options={simpleOptions}
					variant="secondary"
					placeholder="Secondary"
				/>
			</div>
			<div class="w-48">
				<p class="text-xs text-muted mb-1">primary</p>
				<Select
					options={simpleOptions}
					variant="primary"
					placeholder="Primary"
				/>
			</div>
			<div class="w-48">
				<p class="text-xs text-muted mb-1">ghost</p>
				<Select
					options={simpleOptions}
					variant="ghost"
					placeholder="Ghost"
				/>
			</div>
		</div>
	</section>

	<!-- Loading State -->
	<section class="space-y-2">
		<h3 class="text-lg font-medium">Loading State</h3>
		<Select
			options={simpleOptions}
			placeholder="Đang tải..."
			loading={true}
		/>
	</section>
</div>

<style lang="scss">
	@use '$assets/styles/basic.scss';
</style>