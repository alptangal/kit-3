<script lang="ts">
	// src/routes/(authorized)/admin/variants/+page.svelte
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { Button } from '$components/element/button';
	import { Input } from '$components/form/input';
	import { Checkbox } from '$components/form/checkbox';
	import { Modal } from '$components/modal';
	import { ModalContainer } from '$components/modal/Container';
	import { ModalHeader } from '$components/modal/Header';
	import { ModalBody } from '$components/modal/Body';
	import { ModalFooter } from '$components/modal/Footer';
	import { Icon } from '$components/element/icon';
	import { iconify } from '$assets/icons/iconify';
	import { toast } from '$components/element/toast';

	// Types
	interface VariantListItem {
		_id: string;
		productId: string;
		sku: string;
		barcode?: string;
		attributes: Record<string, string>;
		displayName: string;
		price: number;
		costPrice?: number;
		weight?: number;
		trackLot?: boolean;
		trackExpiry?: boolean;
		lowStockThreshold?: number;
		imageUrl?: string;
		status: string;
		createdAt: string;
		updatedAt: string;
		deletedAt?: string | null;
	}

	interface ProductItem {
		_id: string;
		name: string;
	}

	// State
	let variants = $state<VariantListItem[]>([]);
	let products = $state<ProductItem[]>([]);
	let loading = $state(false);
	let total = $state(0);
	let pageNumber = $state(1);
	let pageSize = $state(20);
	let searchQuery = $state('');
	let selectedProduct = $state('');
	let showDeleted = $state(false);
	let showCreateModal = $state(false);
	let showEditModal = $state(false);
	let editingVariant = $state<VariantListItem | null>(null);
	let formErrors = $state<Record<string, string>>({});
	let formSubmitting = $state(false);

	// Form state
	let formData = $state({
		productId: '',
		sku: '',
		barcode: '',
		attributes: {} as Record<string, string>,
		displayName: '',
		price: 0,
		costPrice: 0,
		weight: 0,
		trackLot: false,
		trackExpiry: false,
		lowStockThreshold: 0,
		imageUrl: '',
		status: 'active'
	});

	// Fetch variants
	async function fetchVariants() {
		loading = true;
		try {
			const params = new URLSearchParams({
				page: String(pageNumber),
				pageSize: String(pageSize),
				includeDeleted: String(showDeleted)
			});
			if (searchQuery) params.set('search', searchQuery);
			if (selectedProduct) params.set('productId', selectedProduct);

			const res = await fetch(`/api/admin/variants/list?${params}`);
			const data = await res.json();

			if (data.success) {
				variants = data.items as VariantListItem[];
				total = data.total;
				pageNumber = data.page;
			} else {
				toast.error(data.messages?.en ?? 'Failed to fetch variants');
			}
		} catch (e) {
			console.error('[variants] fetch error:', e);
			toast.error('Network error');
		} finally {
			loading = false;
		}
	}

	// Fetch products for dropdown
	async function fetchProducts() {
		try {
			const res = await fetch('/api/admin/products/list?pageSize=1000&includeDeleted=true');
			const data = await res.json();
			if (data.success) {
				products = data.items.map((p: ProductItem) => ({
					_id: p._id,
					name: p.name
				}));
			}
		} catch (e) {
			console.error('[products] fetch error:', e);
		}
	}

	// Handle search
	let searchDebounce: ReturnType<typeof setTimeout>;
	function handleSearch(value: string) {
		searchQuery = value;
		clearTimeout(searchDebounce);
		searchDebounce = setTimeout(() => {
			pageNumber = 1;
			fetchVariants();
		}, 300);
	}

	// Handle filter changes
	function handleProductChange(value: string) {
		selectedProduct = value;
		pageNumber = 1;
		fetchVariants();
	}

	function handleShowDeletedChange(value: boolean) {
		showDeleted = value;
		pageNumber = 1;
		fetchVariants();
	}

	// Pagination
	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages) {
			pageNumber = page;
			fetchVariants();
		}
	}

	let totalPages = $derived(Math.ceil(total / pageSize) || 1);

	// Open create modal
	function openCreateModal() {
		resetForm();
		showCreateModal = true;
	}

	// Open edit modal
	function openEditModal(variant: VariantListItem) {
		resetForm();
		editingVariant = variant;
		formData = {
			productId: variant.productId,
			sku: variant.sku,
			barcode: variant.barcode ?? '',
			attributes: variant.attributes ?? {},
			displayName: variant.displayName,
			price: variant.price,
			costPrice: variant.costPrice ?? 0,
			weight: variant.weight ?? 0,
			trackLot: variant.trackLot ?? false,
			trackExpiry: variant.trackExpiry ?? false,
			lowStockThreshold: variant.lowStockThreshold ?? 0,
			imageUrl: variant.imageUrl ?? '',
			status: variant.status
		};
		showEditModal = true;
	}

	// Reset form
	function resetForm() {
		formData = {
			productId: '',
			sku: '',
			barcode: '',
			attributes: {},
			displayName: '',
			price: 0,
			costPrice: 0,
			weight: 0,
			trackLot: false,
			trackExpiry: false,
			lowStockThreshold: 0,
			imageUrl: '',
			status: 'active'
		};
		formErrors = {};
		editingVariant = null;
		formSubmitting = false;
	}

	// Validate form
	function validateForm(): boolean {
		formErrors = {};
		if (!formData.productId) {
			formErrors.productId = 'Product is required';
		}
		if (!formData.sku.trim()) {
			formErrors.sku = 'SKU is required';
		}
		if (!formData.displayName.trim()) {
			formErrors.displayName = 'Display name is required';
		}
		if (formData.price < 0) {
			formErrors.price = 'Price must be >= 0';
		}
		return Object.keys(formErrors).length === 0;
	}

	// Submit form
	async function submitForm() {
		if (!validateForm()) return;

		formSubmitting = true;
		try {
			const url = editingVariant
				? `/api/admin/variants/update/${editingVariant._id}`
				: '/api/admin/variants/create';

			const res = await fetch(url, {
				method: editingVariant ? 'PATCH' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData)
			});

			const data = await res.json();

			if (data.success) {
				toast.success(data.messages?.en ?? (editingVariant ? 'Variant updated' : 'Variant created'));
				closeModals();
				fetchVariants();
			} else {
				toast.error(data.messages?.en ?? 'Operation failed');
				if (data.fieldErrors) {
					formErrors = data.fieldErrors;
				}
			}
		} catch (e) {
			console.error('[variants] submit error:', e);
			toast.error('Network error');
		} finally {
			formSubmitting = false;
		}
	}

	// Delete variant
	async function deleteVariant(variant: VariantListItem) {
		if (!confirm(`Delete "${variant.displayName}" (SKU: ${variant.sku})? This action cannot be undone.`)) return;

		try {
			const res = await fetch(`/api/admin/variants/delete/${variant._id}`, {
				method: 'DELETE'
			});
			const data = await res.json();

			if (data.success) {
				toast.success(data.messages?.en ?? 'Variant deleted');
				fetchVariants();
			} else {
				toast.error(data.messages?.en ?? 'Failed to delete variant');
			}
		} catch (e) {
			console.error('[variants] delete error:', e);
			toast.error('Network error');
		}
	}

	// Close modals
	function closeModals() {
		showCreateModal = false;
		showEditModal = false;
		resetForm();
	}

	// Status badge class
	function getStatusClass(status: string) {
		switch (status) {
			case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
			case 'inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
			case 'discontinued': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
			case 'draft': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
			default: return 'bg-gray-100 text-gray-800';
		}
	}

	// Format price
	function formatPrice(price: number) {
		return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
	}

	// Format date
	function formatDate(dateStr: string) {
		return new Date(dateStr).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	// Initial load
	onMount(() => {
		fetchVariants();
		fetchProducts();
	});

	// Reactive fetch on page/search changes
	$effect(() => {
		page.url;
		fetchVariants();
	});
</script>

<div class="admin-variants-page p-6 space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-foreground">Variants</h1>
			<p class="text-foreground-400 mt-1">Manage product variants</p>
		</div>
		<Button variant="solid" color="primary" onclick={openCreateModal} icon={iconify['plus-rounded']}>
			Add Variant
		</Button>
	</div>

	<!-- Filters -->
	<div class="flex flex-col sm:flex-row gap-4 p-4 bg-background border border-border rounded-lg">
		<div class="flex-1 min-w-[250px]">
			<Input
				placeholder="Search variants (SKU, name, barcode)..."
				value={searchQuery}
				oninput={(e) => handleSearch((e.target as HTMLInputElement).value)}
				size="sm"
			>
				{#snippet leading(data)}
					<Icon icon={iconify['search-rounded']} size={data?.size ?? 'sm'} class={data?.defaultStyles} />
				{/snippet}
			</Input>
		</div>
		<div class="flex gap-2 flex-wrap">
			<Input
				type="select"
				placeholder="All Products"
				value={selectedProduct}
				onchange={(e) => handleProductChange((e.target as HTMLSelectElement).value)}
				size="sm"
				options={products.map(p => ({ value: p._id, label: p.name }))}
			/>
			<Checkbox
				checked={showDeleted}
				onchange={(e) => handleShowDeletedChange((e.target as HTMLInputElement).checked)}
				label="Show deleted"
				size="sm"
			/>
		</div>
	</div>

	<!-- Variants Table -->
	<div class="bg-background border border-border rounded-lg overflow-hidden">
		{#if loading}
			<div class="p-8 text-center text-foreground-400">Loading variants...</div>
		{:else if variants.length === 0}
			<div class="p-8 text-center text-foreground-400">No variants found</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead class="bg-foreground-50 dark:bg-foreground-900/20">
						<tr>
							<th class="px-4 py-3 text-left text-xs font-medium text-foreground-400 uppercase tracking-wider">Variant</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-foreground-400 uppercase tracking-wider">Product</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-foreground-400 uppercase tracking-wider">SKU</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-foreground-400 uppercase tracking-wider">Attributes</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-foreground-400 uppercase tracking-wider">Price</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-foreground-400 uppercase tracking-wider">Cost</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-foreground-400 uppercase tracking-wider">Status</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-foreground-400 uppercase tracking-wider">Updated</th>
							<th class="px-4 py-3 text-right text-xs font-medium text-foreground-400 uppercase tracking-wider">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each variants as variant}
							<tr class="hover:bg-foreground-50/50 dark:hover:bg-foreground-900/10 transition-colors">
								<td class="px-4 py-4">
									<div class="flex items-center gap-3">
										{#if variant.imageUrl}
											<img src={variant.imageUrl} alt={variant.displayName} class="w-10 h-10 rounded-lg object-cover" />
										{:else}
											<div class="w-10 h-10 rounded-lg bg-foreground-100 dark:bg-foreground-800 flex items-center justify-center">
												<Icon icon={iconify['cube-rounded']} size="md" class="text-foreground-400" />
											</div>
										{/if}
										<div>
											<p class="font-medium text-foreground">{variant.displayName}</p>
											{#if variant.barcode}
												<p class="text-xs text-foreground-400 font-mono">{variant.barcode}</p>
											{/if}
										</div>
									</div>
								</td>
								<td class="px-4 py-4">
									{#if products.find(p => p._id === variant.productId) as prod}
										<span class="text-sm text-foreground">{prod.name}</span>
									{:else}
										<span class="text-sm text-foreground-400">Unknown</span>
									{/if}
								</td>
								<td class="px-4 py-4">
									<code class="text-sm font-mono text-foreground">{variant.sku}</code>
								</td>
								<td class="px-4 py-4">
									<div class="flex flex-wrap gap-1">
										{#each Object.entries(variant.attributes) as [key, value]}
											<span class="px-2 py-0.5 text-xs bg-foreground-100 dark:bg-foreground-800 rounded text-foreground-600 dark:text-foreground-400">
												{key}: {value}
											</span>
										{/each}
									</div>
								</td>
								<td class="px-4 py-4 text-sm font-medium text-foreground">
									{formatPrice(variant.price)}
								</td>
								<td class="px-4 py-4 text-sm text-foreground-400">
									{formatPrice(variant.costPrice ?? 0)}
								</td>
								<td class="px-4 py-4">
									<span class="inline-flex px-2 py-1 text-xs font-medium rounded-full {getStatusClass(variant.status)}">
										{variant.status}
									</span>
								</td>
								<td class="px-4 py-4 text-sm text-foreground-400">
									{formatDate(variant.updatedAt)}
								</td>
								<td class="px-4 py-4 text-right">
									<div class="flex items-center justify-end gap-2">
										<Button
											variant="ghost"
											size="sm"
											icon={iconify['pencil-rounded']}
											aria-label="Edit variant"
											onclick={() => openEditModal(variant)}
										/>
										<Button
											variant="ghost"
											size="sm"
											color="danger"
											icon={iconify['trash-rounded']}
											aria-label="Delete variant"
											onclick={() => deleteVariant(variant)}
										/>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Pagination -->
			{#if totalPages > 1}
				<div class="px-4 py-3 border-t border-border flex items-center justify-between">
					<p class="text-sm text-foreground-400">
						Showing {(pageNumber - 1) * pageSize + 1} to {Math.min(pageNumber * pageSize, total)} of {total} variants
					</p>
					<div class="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							icon={iconify['chevron-left-rounded']}
							disabled={pageNumber === 1}
							onclick={() => goToPage(pageNumber - 1)}
						>
							Previous
						</Button>
						<Button
							variant="outline"
							size="sm"
							icon={iconify['chevron-right-rounded']}
							trailingIcon
							disabled={pageNumber === totalPages}
							onclick={() => goToPage(pageNumber + 1)}
						>
							Next
						</Button>
					</div>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Create/Edit Modal -->
	<Modal display={showCreateModal || showEditModal} onClose={closeModals} size="lg">
		<ModalContainer>
			<ModalHeader>
				<h2 class="text-lg font-semibold text-foreground">
					{editingVariant ? 'Edit Variant' : 'Create Variant'}
				</h2>
			</ModalHeader>
			<ModalBody class="space-y-4 p-6">
				<div class="grid gap-4 sm:grid-cols-2">
					<Input
						type="select"
						label="Product"
						placeholder="Select product"
						value={formData.productId}
						onchange={(e) => formData.productId = (e.target as HTMLSelectElement).value}
						options={products.map(p => ({ value: p._id, label: p.name }))}
						required
						error={formErrors.productId}
					/>
					<Input
						label="SKU"
						placeholder="Enter SKU"
						value={formData.sku}
						oninput={(e) => { formData.sku = (e.target as HTMLInputElement).value; delete formErrors.sku; }}
						error={formErrors.sku}
						required
					/>
					<Input
						label="Barcode"
						placeholder="Enter barcode (optional)"
						value={formData.barcode}
						oninput={(e) => formData.barcode = (e.target as HTMLInputElement).value}
					/>
					<Input
						type="number"
						label="Price"
						placeholder="0"
						value={formData.price}
						oninput={(e) => { formData.price = parseFloat((e.target as HTMLInputElement).value) || 0; delete formErrors.price; }}
						error={formErrors.price}
						required
						min={0}
						step={0.01}
					/>
					<Input
						type="number"
						label="Cost Price"
						placeholder="0"
						value={formData.costPrice}
						oninput={(e) => formData.costPrice = parseFloat((e.target as HTMLInputElement).value) || 0}
						min={0}
						step={0.01}
					/>
					<Input
						type="number"
						label="Weight (g)"
						placeholder="0"
						value={formData.weight}
						oninput={(e) => formData.weight = parseFloat((e.target as HTMLInputElement).value) || 0}
						min={0}
					/>
				</div>

				<div>
					<label for="variant-display-name" class="block text-sm font-medium text-foreground mb-2">Display Name</label>
					<Input
						id="variant-display-name"
						placeholder="Enter display name"
						value={formData.displayName}
						oninput={(e) => { formData.displayName = (e.target as HTMLInputElement).value; delete formErrors.displayName; }}
						error={formErrors.displayName}
						required
					/>
				</div>

				<!-- Attributes Section -->
				<fieldset class="border border-border rounded-lg p-4">
					<legend class="text-sm font-medium text-foreground mb-3">Attributes</legend>
					<div class="space-y-2">
						{#each Object.entries(formData.attributes) as [key, value], i}
							<div class="flex gap-2">
								<Input
									placeholder="Attribute (e.g., Size)"
									value={key}
									oninput={(e) => {
										const newKey = (e.target as HTMLInputElement).value;
										if (newKey !== key) {
											const newAttrs = { ...formData.attributes };
											delete newAttrs[key];
											if (newKey) newAttrs[newKey] = value;
											formData.attributes = newAttrs;
										}
									}}
								/>
								<Input
									placeholder="Value (e.g., M)"
									value={value}
									oninput={(e) => {
										formData.attributes = { ...formData.attributes, [key]: (e.target as HTMLInputElement).value };
									}}
								/>
								<Button
									variant="ghost"
									size="sm"
									color="danger"
									icon={iconify['trash-rounded']}
									aria-label="Remove attribute"
									onclick={() => {
										const newAttrs = { ...formData.attributes };
										delete newAttrs[key];
										formData.attributes = newAttrs;
									}}
								/>
							</div>
						{/each}
						<Button
							variant="outline"
							size="sm"
							icon={iconify['plus-rounded']}
							onclick={() => {
								const nextIndex = Object.keys(formData.attributes).length + 1;
								formData.attributes = { ...formData.attributes, [`attr${nextIndex}`]: '' };
							}}
						>
							Add Attribute
						</Button>
					</div>
				</fieldset>

				<!-- Advanced Options -->
				<fieldset class="border border-border rounded-lg p-4">
					<legend class="text-sm font-medium text-foreground mb-3">Advanced</legend>
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="flex items-center gap-2">
							<Checkbox
								checked={formData.trackLot}
								onchange={(e) => formData.trackLot = (e.target as HTMLInputElement).checked}
								label="Track Lots"
							/>
						</div>
						<div class="flex items-center gap-2">
							<Checkbox
								checked={formData.trackExpiry}
								onchange={(e) => formData.trackExpiry = (e.target as HTMLInputElement).checked}
								label="Track Expiry"
							/>
						</div>
						<Input
							type="number"
							label="Low Stock Threshold"
							placeholder="0"
							value={formData.lowStockThreshold}
							oninput={(e) => formData.lowStockThreshold = parseInt((e.target as HTMLInputElement).value) || 0}
							min={0}
						/>
						<Input
							type="select"
							label="Status"
							value={formData.status}
							onchange={(e) => formData.status = (e.target as HTMLSelectElement).value}
							options={[
								{ value: 'active', label: 'Active' },
								{ value: 'inactive', label: 'Inactive' },
								{ value: 'draft', label: 'Draft' },
								{ value: 'discontinued', label: 'Discontinued' }
							]}
						/>
					</div>
					<div>
						<label for="variant-image-url" class="block text-sm font-medium text-foreground mb-2">Image URL</label>
						<Input
							id="variant-image-url"
							placeholder="https://example.com/image.jpg"
							value={formData.imageUrl}
							oninput={(e) => formData.imageUrl = (e.target as HTMLInputElement).value}
						/>
					</div>
				</fieldset>
			</ModalBody>
			<ModalFooter class="justify-end gap-3">
				<Button variant="outline" onclick={closeModals} disabled={formSubmitting}>
					Cancel
				</Button>
				<Button
					variant="solid"
					color="primary"
					loading={formSubmitting}
					onclick={submitForm}
				>
					{editingVariant ? 'Save Changes' : 'Create Variant'}
				</Button>
			</ModalFooter>
		</ModalContainer>
	</Modal>
</div>

<style lang="scss">
	.admin-variants-page {
		min-height: 100vh;
	}

	@media (max-width: 640px) {
		.admin-variants-page {
			padding: 1rem;
		}
	}
</style>