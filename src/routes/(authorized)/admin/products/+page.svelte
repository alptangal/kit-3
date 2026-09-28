<script lang="ts">
	// src/routes/(authorized)/admin/products/+page.svelte
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
	import type { ProductAdminListResult } from '$lib/server/db/products';
	import type { Product, Category, Brand } from '$modules/schema';
	import { toast } from '$components/element/toast';

	// Types
	interface ProductListItem {
		_id: string;
		name: string;
		description?: string;
		categoryId?: string;
		brandId?: string;
		hasVariants: boolean;
		variantAttributes?: Record<string, string[]>;
		imageUrl?: string;
		status: string;
		createdBy?: string;
		createdAt: string;
		updatedAt: string;
		deletedAt?: string | null;
	}

	interface CategoryItem {
		_id: string;
		name: string;
		slug: string;
	}

	interface BrandItem {
		_id: string;
		name: string;
		slug: string;
	}

	// State
	let products = $state<ProductListItem[]>([]);
	let categories = $state<CategoryItem[]>([]);
	let brands = $state<BrandItem[]>([]);
	let loading = $state(false);
	let total = $state(0);
	let pageNumber = $state(1);
	let pageSize = $state(20);
	let searchQuery = $state('');
	let selectedCategory = $state('');
	let selectedBrand = $state('');
	let showDeleted = $state(false);
	let showCreateModal = $state(false);
	let showEditModal = $state(false);
	let editingProduct = $state<ProductListItem | null>(null);
	let formErrors = $state<Record<string, string>>({});
	let formSubmitting = $state(false);

	// Form state
	let formData = $state({
		name: '',
		description: '',
		categoryId: '',
		brandId: '',
		hasVariants: false,
		variantAttributes: {} as Record<string, string[]>,
		imageUrl: '',
		status: 'active'
	});

	// Fetch products
	async function fetchProducts() {
		loading = true;
		try {
			const params = new URLSearchParams({
				page: String(pageNumber),
				pageSize: String(pageSize),
				includeDeleted: String(showDeleted)
			});
			if (searchQuery) params.set('search', searchQuery);
			if (selectedCategory) params.set('categoryId', selectedCategory);
			if (selectedBrand) params.set('brandId', selectedBrand);

			const res = await fetch(`/api/admin/products/list?${params}`);
			const data = await res.json();

			if (data.success) {
				products = data.items as ProductListItem[];
				total = data.total;
				pageNumber = data.page;
			} else {
				toast.error(data.messages?.en ?? 'Failed to fetch products');
			}
		} catch (e) {
			console.error('[products] fetch error:', e);
			toast.error('Network error');
		} finally {
			loading = false;
		}
	}

	// Fetch categories for dropdown
	async function fetchCategories() {
		try {
			const res = await fetch('/api/admin/categories/list?pageSize=1000');
			const data = await res.json();
			if (data.success) {
				categories = data.items.map((c: CategoryItem) => ({
					_id: c._id,
					name: c.name,
					slug: c.slug
				}));
			}
		} catch (e) {
			console.error('[categories] fetch error:', e);
		}
	}

	// Fetch brands for dropdown
	async function fetchBrands() {
		try {
			const res = await fetch('/api/admin/brands/list?pageSize=1000');
			const data = await res.json();
			if (data.success) {
				brands = data.items.map((b: BrandItem) => ({
					_id: b._id,
					name: b.name,
					slug: b.slug
				}));
			}
		} catch (e) {
			console.error('[brands] fetch error:', e);
		}
	}

	// Handle search
	let searchDebounce: ReturnType<typeof setTimeout>;
	function handleSearch(value: string) {
		searchQuery = value;
		clearTimeout(searchDebounce);
		searchDebounce = setTimeout(() => {
			pageNumber = 1;
			fetchProducts();
		}, 300);
	}

	// Handle filter changes
	function handleCategoryChange(value: string) {
		selectedCategory = value;
		pageNumber = 1;
		fetchProducts();
	}

	function handleBrandChange(value: string) {
		selectedBrand = value;
		pageNumber = 1;
		fetchProducts();
	}

	function handleShowDeletedChange(value: boolean) {
		showDeleted = value;
		pageNumber = 1;
		fetchProducts();
	}

	// Pagination
	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages) {
			pageNumber = page;
			fetchProducts();
		}
	}

	let totalPages = $derived(Math.ceil(total / pageSize) || 1);

	// Open create modal
	function openCreateModal() {
		resetForm();
		showCreateModal = true;
	}

	// Open edit modal
	function openEditModal(product: ProductListItem) {
		resetForm();
		editingProduct = product;
		formData = {
			name: product.name,
			description: product.description ?? '',
			categoryId: product.categoryId ?? '',
			brandId: product.brandId ?? '',
			hasVariants: product.hasVariants,
			variantAttributes: product.variantAttributes ?? {},
			imageUrl: product.imageUrl ?? '',
			status: product.status
		};
		showEditModal = true;
	}

	// Reset form
	function resetForm() {
		formData = {
			name: '',
			description: '',
			categoryId: '',
			brandId: '',
			hasVariants: false,
			variantAttributes: {},
			imageUrl: '',
			status: 'active'
		};
		formErrors = {};
		editingProduct = null;
		formSubmitting = false;
	}

	// Validate form
	function validateForm(): boolean {
		formErrors = {};
		if (!formData.name.trim()) {
			formErrors.name = 'Product name is required';
		}
		if (formData.name.trim().length < 2) {
			formErrors.name = 'Product name must be at least 2 characters';
		}
		if (formData.hasVariants && Object.keys(formData.variantAttributes).length === 0) {
			formErrors.variantAttributes = 'At least one variant attribute is required';
		}
		return Object.keys(formErrors).length === 0;
	}

	// Submit form
	async function submitForm() {
		if (!validateForm()) return;

		formSubmitting = true;
		try {
			const url = editingProduct
				? `/api/admin/products/update/${editingProduct._id}`
				: '/api/admin/products/create';

			const res = await fetch(url, {
				method: editingProduct ? 'PATCH' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData)
			});

			const data = await res.json();

			if (data.success) {
				toast.success(data.messages?.en ?? (editingProduct ? 'Product updated' : 'Product created'));
				closeModals();
				fetchProducts();
			} else {
				toast.error(data.messages?.en ?? 'Operation failed');
				if (data.fieldErrors) {
					formErrors = data.fieldErrors;
				}
			}
		} catch (e) {
			console.error('[products] submit error:', e);
			toast.error('Network error');
		} finally {
			formSubmitting = false;
		}
	}

	// Delete product
	async function deleteProduct(product: ProductListItem) {
		if (!confirm(`Delete "${product.name}"? This action cannot be undone.`)) return;

		try {
			const res = await fetch(`/api/admin/products/delete/${product._id}`, {
				method: 'DELETE'
			});
			const data = await res.json();

			if (data.success) {
				toast.success(data.messages?.en ?? 'Product deleted');
				fetchProducts();
			} else {
				toast.error(data.messages?.en ?? 'Failed to delete product');
			}
		} catch (e) {
			console.error('[products] delete error:', e);
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
		fetchProducts();
		fetchCategories();
		fetchBrands();
	});

	// Reactive fetch on page/search changes
	$effect(() => {
		page.url; // track page navigation
		fetchProducts();
	});
</script>

<div class="admin-products-page p-6 space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-foreground">Products</h1>
			<p class="text-foreground-400 mt-1">Manage your product catalog</p>
		</div>
		<Button variant="solid" color="primary" onclick={openCreateModal} icon={iconify['plus-rounded']}>
			Add Product
		</Button>
	</div>

	<!-- Filters -->
	<div class="flex flex-col sm:flex-row gap-4 p-4 bg-background border border-border rounded-lg">
		<div class="flex-1 min-w-[250px]">
			<Input
				placeholder="Search products..."
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
				placeholder="All Categories"
				value={selectedCategory}
				onchange={(e) => handleCategoryChange((e.target as HTMLSelectElement).value)}
				size="sm"
				options={categories.map(c => ({ value: c._id, label: c.name }))}
			/>
			<Input
				type="select"
				placeholder="All Brands"
				value={selectedBrand}
				onchange={(e) => handleBrandChange((e.target as HTMLSelectElement).value)}
				size="sm"
				options={brands.map(b => ({ value: b._id, label: b.name }))}
			/>
			<Checkbox
				checked={showDeleted}
				onchange={(e) => handleShowDeletedChange((e.target as HTMLInputElement).checked)}
				label="Show deleted"
				size="sm"
			/>
		</div>
	</div>

	<!-- Products Table -->
	<div class="bg-background border border-border rounded-lg overflow-hidden">
		{#if loading}
			<div class="p-8 text-center text-foreground-400">Loading products...</div>
		{:else if products.length === 0}
			<div class="p-8 text-center text-foreground-400">No products found</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead class="bg-foreground-50 dark:bg-foreground-900/20">
						<tr>
							<th class="px-4 py-3 text-left text-xs font-medium text-foreground-400 uppercase tracking-wider">Product</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-foreground-400 uppercase tracking-wider">Category</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-foreground-400 uppercase tracking-wider">Brand</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-foreground-400 uppercase tracking-wider">Variants</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-foreground-400 uppercase tracking-wider">Status</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-foreground-400 uppercase tracking-wider">Updated</th>
							<th class="px-4 py-3 text-right text-xs font-medium text-foreground-400 uppercase tracking-wider">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each products as product}
							<tr class="hover:bg-foreground-50/50 dark:hover:bg-foreground-900/10 transition-colors">
								<td class="px-4 py-4">
									<div class="flex items-center gap-3">
										{#if product.imageUrl}
											<img src={product.imageUrl} alt={product.name} class="w-10 h-10 rounded-lg object-cover" />
										{:else}
											<div class="w-10 h-10 rounded-lg bg-foreground-100 dark:bg-foreground-800 flex items-center justify-center">
												<Icon icon={iconify['package-rounded']} size="md" class="text-foreground-400" />
											</div>
										{/if}
										<div>
											<p class="font-medium text-foreground">{product.name}</p>
											{#if product.description}
												<p class="text-sm text-foreground-400 truncate max-w-xs">{product.description}</p>
											{/if}
										</div>
									</div>
								</td>
								<td class="px-4 py-4">
									{#if product.categoryId}
										{#if categories.find(c => c._id === product.categoryId) as cat}
											<span class="text-sm text-foreground">{cat.name}</span>
										{:else}
											<span class="text-sm text-foreground-400">Unknown</span>
										{/if}
									{:else}
										<span class="text-sm text-foreground-400">—</span>
									{/if}
								</td>
								<td class="px-4 py-4">
									{#if product.brandId}
										{#if brands.find(b => b._id === product.brandId) as brand}
											<span class="text-sm text-foreground">{brand.name}</span>
										{:else}
											<span class="text-sm text-foreground-400">Unknown</span>
										{/if}
									{:else}
										<span class="text-sm text-foreground-400">—</span>
									{/if}
								</td>
								<td class="px-4 py-4">
									{#if product.hasVariants}
										<span class="text-sm text-foreground font-medium">
											{Object.keys(product.variantAttributes ?? {}).length} attributes
										</span>
									{:else}
										<span class="text-sm text-foreground-400">Simple product</span>
									{/if}
								</td>
								<td class="px-4 py-4">
									<span class="inline-flex px-2 py-1 text-xs font-medium rounded-full {getStatusClass(product.status)}">
										{product.status}
									</span>
								</td>
								<td class="px-4 py-4 text-sm text-foreground-400">
									{formatDate(product.updatedAt)}
								</td>
								<td class="px-4 py-4 text-right">
									<div class="flex items-center justify-end gap-2">
										<Button
											variant="ghost"
											size="sm"
											icon={iconify['pencil-rounded']}
											aria-label="Edit product"
											onclick={() => openEditModal(product)}
										/>
										<Button
											variant="ghost"
											size="sm"
											color="danger"
											icon={iconify['trash-rounded']}
											aria-label="Delete product"
											onclick={() => deleteProduct(product)}
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
						Showing {(pageNumber - 1) * pageSize + 1} to {Math.min(pageNumber * pageSize, total)} of {total} products
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
	<Modal display={showCreateModal || showEditModal} onclose={closeModals} size="lg">
		<ModalContainer>
			<ModalHeader>
				<h2 class="text-lg font-semibold text-foreground">
					{editingProduct ? 'Edit Product' : 'Create Product'}
				</h2>
			</ModalHeader>
			<ModalBody class="space-y-4 p-6">
				<div class="grid gap-4 sm:grid-cols-2">
					<Input
						label="Product Name"
						placeholder="Enter product name"
						value={formData.name}
						oninput={(e) => { formData.name = (e.target as HTMLInputElement).value; delete formErrors.name; }}
						error={formErrors.name}
						required
					/>
					<Input
						type="select"
						label="Category"
						placeholder="Select category"
						value={formData.categoryId}
						onchange={(e) => formData.categoryId = (e.target as HTMLSelectElement).value}
						options={categories.map(c => ({ value: c._id, label: c.name }))}
					/>
					<Input
						type="select"
						label="Brand"
						placeholder="Select brand"
						value={formData.brandId}
						onchange={(e) => formData.brandId = (e.target as HTMLSelectElement).value}
						options={brands.map(b => ({ value: b._id, label: b.name }))}
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
					<label for="product-description" class="block text-sm font-medium text-foreground mb-2">Description</label>
					<textarea
						id="product-description"
						class="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
						rows={3}
						value={formData.description}
						oninput={(e) => formData.description = (e.target as HTMLTextAreaElement).value}
						placeholder="Enter product description..."
					></textarea>
				</div>

				<div>
					<label for="product-image-url" class="block text-sm font-medium text-foreground mb-2">Image URL</label>
					<Input
						id="product-image-url"
						placeholder="https://example.com/image.jpg"
						value={formData.imageUrl}
						oninput={(e) => formData.imageUrl = (e.target as HTMLInputElement).value}
					/>
				</div>

				<!-- Variant Attributes Section -->
				<fieldset class="border border-border rounded-lg p-4">
					<legend class="text-sm font-medium text-foreground mb-3">Variant Attributes</legend>
					<div class="flex items-center gap-2 mb-3">
						<Checkbox
							checked={formData.hasVariants}
							onchange={(e) => formData.hasVariants = (e.target as HTMLInputElement).checked}
							label="This product has variants"
						/>
					</div>
					{#if formData.hasVariants}
						<div class="space-y-2">
							{#each Object.entries(formData.variantAttributes) as [attrName, values], i}
								<div class="flex gap-2">
									<Input
										placeholder="Attribute name (e.g., Size, Color)"
										value={attrName}
										oninput={(e) => {
											const newName = (e.target as HTMLInputElement).value;
											if (newName !== attrName) {
												const newAttrs = { ...formData.variantAttributes };
												delete newAttrs[attrName];
												if (newName) newAttrs[newName] = values;
												formData.variantAttributes = newAttrs;
											}
										}}
									/>
									<Input
										placeholder="Values (comma separated)"
										value={values.join(', ')}
										oninput={(e) => {
											const newValues = (e.target as HTMLInputElement).value.split(',').map(v => v.trim()).filter(Boolean);
											formData.variantAttributes = { ...formData.variantAttributes, [attrName]: newValues };
										}}
									/>
									<Button
										variant="ghost"
										size="sm"
										color="danger"
										icon={iconify['trash-rounded']}
										aria-label="Remove attribute"
										onclick={() => {
											const newAttrs = { ...formData.variantAttributes };
											delete newAttrs[attrName];
											formData.variantAttributes = newAttrs;
										}}
									/>
								</div>
							{/each}
							<Button
								variant="outline"
								size="sm"
								icon={iconify['plus-rounded']}
								onclick={() => {
									const nextIndex = Object.keys(formData.variantAttributes).length + 1;
									formData.variantAttributes = { ...formData.variantAttributes, [`attribute${nextIndex}`]: [] };
								}}
							>
								Add Attribute
							</Button>
						</div>
						{#if formErrors.variantAttributes}
							<p class="text-sm text-danger mt-1">{formErrors.variantAttributes}</p>
						{/if}
					{/if}
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
					{editingProduct ? 'Save Changes' : 'Create Product'}
				</Button>
			</ModalFooter>
		</ModalContainer>
	</Modal>
</div>

<style lang="scss">
	.admin-products-page {
		min-height: 100vh;
	}

	@media (max-width: 640px) {
		.admin-products-page {
			padding: 1rem;
		}
	}
</style>