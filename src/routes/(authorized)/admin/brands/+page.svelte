<script lang="ts">
	// src/routes/(authorized)/admin/brands/+page.svelte
	import { onMount } from 'svelte';
	import { page } from '$app/state';
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
	interface BrandListItem {
		_id: string;
		name: string;
		slug: string;
		logoUrl?: string;
		description?: string;
		status: string;
		createdAt: string;
		updatedAt: string;
		deletedAt?: string | null;
	}

	// State
	let brands = $state<BrandListItem[]>([]);
	let loading = $state(false);
	let total = $state(0);
	let pageNumber = $state(1);
	let pageSize = $state(20);
	let searchQuery = $state('');
	let showDeleted = $state(false);
	let showCreateModal = $state(false);
	let showEditModal = $state(false);
	let editingBrand = $state<BrandListItem | null>(null);
	let formErrors = $state<Record<string, string>>({});
	let formSubmitting = $state(false);

	// Form state
	let formData = $state({
		name: '',
		slug: '',
		logoUrl: '',
		description: '',
		status: 'active'
	});

	// Fetch brands
	async function fetchBrands() {
		loading = true;
		try {
			const params = new URLSearchParams({
				page: String(pageNumber),
				pageSize: String(pageSize),
				includeDeleted: String(showDeleted)
			});
			if (searchQuery) params.set('search', searchQuery);

			const res = await fetch(`/api/admin/brands/list?${params}`);
			const data = await res.json();

			if (data.success) {
				brands = data.items as BrandListItem[];
				total = data.total;
				pageNumber = data.page;
			} else {
				toast.error(data.messages?.en ?? 'Failed to fetch brands');
			}
		} catch (e) {
			console.error('[brands] fetch error:', e);
			toast.error('Network error');
		} finally {
			loading = false;
		}
	}

	// Handle search
	let searchDebounce: ReturnType<typeof setTimeout>;
	function handleSearch(value: string) {
		searchQuery = value;
		clearTimeout(searchDebounce);
		searchDebounce = setTimeout(() => {
			pageNumber = 1;
			fetchBrands();
		}, 300);
	}

	function handleShowDeletedChange(value: boolean) {
		showDeleted = value;
		pageNumber = 1;
		fetchBrands();
	}

	// Pagination
	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages) {
			pageNumber = page;
			fetchBrands();
		}
	}

	let totalPages = $derived(Math.ceil(total / pageSize) || 1);

	// Open create modal
	function openCreateModal() {
		resetForm();
		showCreateModal = true;
	}

	// Open edit modal
	function openEditModal(brand: BrandListItem) {
		resetForm();
		editingBrand = brand;
		formData = {
			name: brand.name,
			slug: brand.slug,
			logoUrl: brand.logoUrl ?? '',
			description: brand.description ?? '',
			status: brand.status
		};
		showEditModal = true;
	}

	// Reset form
	function resetForm() {
		formData = {
			name: '',
			slug: '',
			logoUrl: '',
			description: '',
			status: 'active'
		};
		formErrors = {};
		editingBrand = null;
		formSubmitting = false;
	}

	// Generate slug from name
	function generateSlug(name: string): string {
		return name
			.toLowerCase()
			.trim()
			.replace(/[^\w\s-]/g, '')
			.replace(/[\s_-]+/g, '-')
			.replace(/^-+|-+$/g, '');
	}

	// Validate form
	function validateForm(): boolean {
		formErrors = {};
		if (!formData.name.trim()) {
			formErrors.name = 'Brand name is required';
		}
		if (formData.name.trim().length < 2) {
			formErrors.name = 'Brand name must be at least 2 characters';
		}
		if (!formData.slug.trim()) {
			formErrors.slug = 'Slug is required';
		}
		if (formData.slug.trim().length < 2) {
			formErrors.slug = 'Slug must be at least 2 characters';
		}
		if (!/^[a-z0-9-]+$/.test(formData.slug)) {
			formErrors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens';
		}
		return Object.keys(formErrors).length === 0;
	}

	// Submit form
	async function submitForm() {
		if (!validateForm()) return;

		formSubmitting = true;
		try {
			const url = editingBrand
				? `/api/admin/brands/update/${editingBrand._id}`
				: '/api/admin/brands/create';

			const res = await fetch(url, {
				method: editingBrand ? 'PATCH' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData)
			});

			const data = await res.json();

			if (data.success) {
				toast.success(data.messages?.en ?? (editingBrand ? 'Brand updated' : 'Brand created'));
				closeModals();
				fetchBrands();
			} else {
				toast.error(data.messages?.en ?? 'Operation failed');
				if (data.fieldErrors) {
					formErrors = data.fieldErrors;
				}
			}
		} catch (e) {
			console.error('[brands] submit error:', e);
			toast.error('Network error');
		} finally {
			formSubmitting = false;
		}
	}

	// Delete brand
	async function deleteBrand(brand: BrandListItem) {
		if (!confirm(`Delete "${brand.name}"? This action cannot be undone.`)) return;

		try {
			const res = await fetch(`/api/admin/brands/delete/${brand._id}`, {
				method: 'DELETE'
			});
			const data = await res.json();

			if (data.success) {
				toast.success(data.messages?.en ?? 'Brand deleted');
				fetchBrands();
			} else {
				toast.error(data.messages?.en ?? 'Failed to delete brand');
			}
		} catch (e) {
			console.error('[brands] delete error:', e);
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
		fetchBrands();
	});

	// Reactive fetch on page/search changes
	$effect(() => {
		page.url;
		fetchBrands();
	});
</script>

<div class="admin-brands-page p-6 space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-foreground">Brands</h1>
			<p class="text-foreground-400 mt-1">Manage product brands</p>
		</div>
		<Button variant="solid" color="primary" onclick={openCreateModal} icon={iconify['plus-rounded']}>
			Add Brand
		</Button>
	</div>

	<!-- Filters -->
	<div class="flex flex-col sm:flex-row gap-4 p-4 bg-background border border-border rounded-lg">
		<div class="flex-1 min-w-[250px]">
			<Input
				placeholder="Search brands..."
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
			<Checkbox
				checked={showDeleted}
				onchange={(e) => handleShowDeletedChange((e.target as HTMLInputElement).checked)}
				label="Show deleted"
				size="sm"
			/>
		</div>
	</div>

	<!-- Brands Table -->
	<div class="bg-background border border-border rounded-lg overflow-hidden">
		{#if loading}
			<div class="p-8 text-center text-foreground-400">Loading brands...</div>
		{:else if brands.length === 0}
			<div class="p-8 text-center text-foreground-400">No brands found</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead class="bg-foreground-50 dark:bg-foreground-900/20">
						<tr>
							<th class="px-4 py-3 text-left text-xs font-medium text-foreground-400 uppercase tracking-wider">Brand</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-foreground-400 uppercase tracking-wider">Slug</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-foreground-400 uppercase tracking-wider">Logo</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-foreground-400 uppercase tracking-wider">Status</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-foreground-400 uppercase tracking-wider">Updated</th>
							<th class="px-4 py-3 text-right text-xs font-medium text-foreground-400 uppercase tracking-wider">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each brands as brand}
							<tr class="hover:bg-foreground-50/50 dark:hover:bg-foreground-900/10 transition-colors">
								<td class="px-4 py-4">
									<div class="flex items-center gap-3">
										{#if brand.logoUrl}
											<img src={brand.logoUrl} alt={brand.name} class="w-10 h-10 rounded-lg object-contain bg-foreground-100 dark:bg-foreground-800" />
										{:else}
											<div class="w-10 h-10 rounded-lg bg-foreground-100 dark:bg-foreground-800 flex items-center justify-center">
												<Icon icon={iconify['tag-rounded']} size="md" class="text-foreground-400" />
											</div>
										{/if}
										<div>
											<p class="font-medium text-foreground">{brand.name}</p>
											{#if brand.description}
												<p class="text-sm text-foreground-400 truncate max-w-xs">{brand.description}</p>
											{/if}
										</div>
									</div>
								</td>
								<td class="px-4 py-4">
									<code class="text-sm font-mono text-foreground">{brand.slug}</code>
								</td>
								<td class="px-4 py-4">
									{#if brand.logoUrl}
										<img src={brand.logoUrl} alt="" class="w-8 h-8 rounded object-contain" />
									{:else}
										<span class="text-sm text-foreground-400">—</span>
									{/if}
								</td>
								<td class="px-4 py-4">
									<span class="inline-flex px-2 py-1 text-xs font-medium rounded-full {getStatusClass(brand.status)}">
										{brand.status}
									</span>
								</td>
								<td class="px-4 py-4 text-sm text-foreground-400">
									{formatDate(brand.updatedAt)}
								</td>
								<td class="px-4 py-4 text-right">
									<div class="flex items-center justify-end gap-2">
										<Button
											variant="ghost"
											size="sm"
											icon={iconify['pencil-rounded']}
											aria-label="Edit brand"
											onclick={() => openEditModal(brand)}
										/>
										<Button
											variant="ghost"
											size="sm"
											color="danger"
											icon={iconify['trash-rounded']}
											aria-label="Delete brand"
											onclick={() => deleteBrand(brand)}
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
						Showing {(pageNumber - 1) * pageSize + 1} to {Math.min(pageNumber * pageSize, total)} of {total} brands
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
	<Modal display={showCreateModal || showEditModal} onclose={closeModals} size="md">
		<ModalContainer>
			<ModalHeader>
				<h2 class="text-lg font-semibold text-foreground">
					{editingBrand ? 'Edit Brand' : 'Create Brand'}
				</h2>
			</ModalHeader>
			<ModalBody class="space-y-4 p-6">
				<div class="grid gap-4 sm:grid-cols-2">
					<Input
						label="Brand Name"
						placeholder="Enter brand name"
						value={formData.name}
						oninput={(e) => {
							formData.name = (e.target as HTMLInputElement).value;
							delete formErrors.name;
							// Auto-generate slug if empty
							if (!formData.slug || formData.slug === generateSlug((e.target as HTMLInputElement).value)) {
								formData.slug = generateSlug((e.target as HTMLInputElement).value);
							}
						}}
						error={formErrors.name}
						required
					/>
					<Input
						label="Slug"
						placeholder="auto-generated from name"
						value={formData.slug}
						oninput={(e) => { formData.slug = (e.target as HTMLInputElement).value; delete formErrors.slug; }}
						error={formErrors.slug}
						required
					/>
				</div>

				<div>
					<label for="brand-logo-url" class="block text-sm font-medium text-foreground mb-2">Logo URL</label>
					<Input
						id="brand-logo-url"
						placeholder="https://example.com/logo.png"
						value={formData.logoUrl}
						oninput={(e) => formData.logoUrl = (e.target as HTMLInputElement).value}
					/>
				</div>

				<div>
					<label for="brand-description" class="block text-sm font-medium text-foreground mb-2">Description</label>
					<textarea
						id="brand-description"
						class="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
						rows={3}
						value={formData.description}
						oninput={(e) => formData.description = (e.target as HTMLTextAreaElement).value}
						placeholder="Enter brand description..."
					></textarea>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<Input
						type="select"
						label="Status"
						value={formData.status}
						onchange={(e) => formData.status = (e.target as HTMLSelectElement).value}
						options={[
							{ value: 'active', label: 'Active' },
							{ value: 'inactive', label: 'Inactive' }
						]}
					/>
				</div>
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
					{editingBrand ? 'Save Changes' : 'Create Brand'}
				</Button>
			</ModalFooter>
		</ModalContainer>
	</Modal>
</div>

<style lang="scss">
	.admin-brands-page {
		min-height: 100vh;
	}

	@media (max-width: 640px) {
		.admin-brands-page {
			padding: 1rem;
		}
	}
</style>