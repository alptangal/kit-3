<script lang="ts">
	// src/routes/(authorized)/admin/categories/+page.svelte
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
	interface CategoryListItem {
		_id: string;
		name: string;
		slug: string;
		parentId?: string;
		status: string;
		createdAt: string;
		updatedAt: string;
		deletedAt?: string | null;
	}

	// State
	let categories = $state<CategoryListItem[]>([]);
	let loading = $state(false);
	let total = $state(0);
	let pageNumber = $state(1);
	let pageSize = $state(20);
	let searchQuery = $state('');
	let showDeleted = $state(false);
	let showCreateModal = $state(false);
	let showEditModal = $state(false);
	let editingCategory = $state<CategoryListItem | null>(null);
	let formErrors = $state<Record<string, string>>({});
	let formSubmitting = $state(false);

	// Form state
	let formData = $state({
		name: '',
		slug: '',
		parentId: '',
		status: 'active'
	});

	// Fetch categories
	async function fetchCategories() {
		loading = true;
		try {
			const params = new URLSearchParams({
				page: String(pageNumber),
				pageSize: String(pageSize),
				includeDeleted: String(showDeleted)
			});
			if (searchQuery) params.set('search', searchQuery);

			const res = await fetch(`/api/admin/categories/list?${params}`);
			const data = await res.json();

			if (data.success) {
				categories = data.items as CategoryListItem[];
				total = data.total;
				pageNumber = data.page;
			} else {
				toast.error(data.messages?.en ?? 'Failed to fetch categories');
			}
		} catch (e) {
			console.error('[categories] fetch error:', e);
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
			fetchCategories();
		}, 300);
	}

	function handleShowDeletedChange(value: boolean) {
		showDeleted = value;
		pageNumber = 1;
		fetchCategories();
	}

	// Pagination
	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages) {
			pageNumber = page;
			fetchCategories();
		}
	}

	let totalPages = $derived(Math.ceil(total / pageSize) || 1);

	// Available parent categories (excluding self and descendants)
	let availableParents = $derived(
		categories
			.filter(c => !editingCategory || c._id !== editingCategory._id)
			.map(c => ({ value: c._id, label: c.name }))
	);

	// Open create modal
	function openCreateModal() {
		resetForm();
		showCreateModal = true;
	}

	// Open edit modal
	function openEditModal(category: CategoryListItem) {
		resetForm();
		editingCategory = category;
		formData = {
			name: category.name,
			slug: category.slug,
			parentId: category.parentId ?? '',
			status: category.status
		};
		showEditModal = true;
	}

	// Reset form
	function resetForm() {
		formData = {
			name: '',
			slug: '',
			parentId: '',
			status: 'active'
		};
		formErrors = {};
		editingCategory = null;
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
			formErrors.name = 'Category name is required';
		}
		if (formData.name.trim().length < 2) {
			formErrors.name = 'Category name must be at least 2 characters';
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
			const url = editingCategory
				? `/api/admin/categories/update/${editingCategory._id}`
				: '/api/admin/categories/create';

			const res = await fetch(url, {
				method: editingCategory ? 'PATCH' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData)
			});

			const data = await res.json();

			if (data.success) {
				toast.success(data.messages?.en ?? (editingCategory ? 'Category updated' : 'Category created'));
				closeModals();
				fetchCategories();
			} else {
				toast.error(data.messages?.en ?? 'Operation failed');
				if (data.fieldErrors) {
					formErrors = data.fieldErrors;
				}
			}
		} catch (e) {
			console.error('[categories] submit error:', e);
			toast.error('Network error');
		} finally {
			formSubmitting = false;
		}
	}

	// Delete category
	async function deleteCategory(category: CategoryListItem) {
		if (!confirm(`Delete "${category.name}"? This action cannot be undone.`)) return;

		try {
			const res = await fetch(`/api/admin/categories/delete/${category._id}`, {
				method: 'DELETE'
			});
			const data = await res.json();

			if (data.success) {
				toast.success(data.messages?.en ?? 'Category deleted');
				fetchCategories();
			} else {
				toast.error(data.messages?.en ?? 'Failed to delete category');
			}
		} catch (e) {
			console.error('[categories] delete error:', e);
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

	// Build tree for display
	let categoryTree = $derived(buildCategoryTree(categories));

	function buildCategoryTree(items: CategoryListItem[]): (CategoryListItem & { children?: CategoryListItem[] })[] {
		const map = new Map<string, CategoryListItem & { children?: CategoryListItem[] }>();
		const roots: (CategoryListItem & { children?: CategoryListItem[] })[] = [];

		items.forEach(item => {
			map.set(item._id, { ...item, children: [] });
		});

		items.forEach(item => {
			const node = map.get(item._id)!;
			if (item.parentId && map.has(item.parentId)) {
				map.get(item.parentId)!.children!.push(node);
			} else {
				roots.push(node);
			}
		});

		return roots;
	}

	// Initial load
	onMount(() => {
		fetchCategories();
	});

	// Reactive fetch on page/search changes
	$effect(() => {
		page.url;
		fetchCategories();
	});
</script>

{#snippet renderCategoryTree(items: (CategoryListItem & { children?: CategoryListItem[] })[], depth = 0)}
	<div class="space-y-1">
		{#each items as category}
			<div class="flex items-center gap-2" style="padding-left: {depth * 1.5}rem">
				<div class="flex items-center gap-3 w-full">
					<span class="font-medium text-foreground">{category.name}</span>
					<span class="text-xs text-foreground-400 font-mono">({category.slug})</span>
					<span class="inline-flex px-2 py-0.5 text-xs font-medium rounded-full {getStatusClass(category.status)}">
						{category.status}
					</span>
					<span class="text-xs text-foreground-400 ml-auto">{formatDate(category.updatedAt)}</span>
					<div class="flex items-center gap-1">
						<Button
							variant="ghost"
							size="xs"
							icon={iconify['pencil-rounded']}
							aria-label="Edit category"
							onclick={() => openEditModal(category)}
						/>
						<Button
							variant="ghost"
							size="xs"
							color="danger"
							icon={iconify['trash-rounded']}
							aria-label="Delete category"
							onclick={() => deleteCategory(category)}
						/>
					</div>
				</div>
				{#if category.children && category.children.length > 0}
					{@render renderCategoryTree(category.children, depth + 1)}
				{/if}
			</div>
		{/each}
	</div>
{/snippet}

<div class="admin-categories-page p-6 space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-foreground">Categories</h1>
			<p class="text-foreground-400 mt-1">Manage product categories</p>
		</div>
		<Button variant="solid" color="primary" onclick={openCreateModal} icon={iconify['plus-rounded']}>
			Add Category
		</Button>
	</div>

	<!-- Filters -->
	<div class="flex flex-col sm:flex-row gap-4 p-4 bg-background border border-border rounded-lg">
		<div class="flex-1 min-w-[250px]">
			<Input
				placeholder="Search categories..."
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

	<!-- Categories Tree/Table -->
	<div class="bg-background border border-border rounded-lg overflow-hidden">
		{#if loading}
			<div class="p-8 text-center text-foreground-400">Loading categories...</div>
		{:else if categories.length === 0}
			<div class="p-8 text-center text-foreground-400">No categories found</div>
		{:else}
			<div class="p-4">
				{#each categoryTree as category}
					{@render renderCategoryTree([category], 0)}
				{/each}
			</div>

			<!-- Pagination -->
			{#if totalPages > 1}
				<div class="px-4 py-3 border-t border-border flex items-center justify-between">
					<p class="text-sm text-foreground-400">
						Showing {(pageNumber - 1) * pageSize + 1} to {Math.min(pageNumber * pageSize, total)} of {total} categories
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
	<Modal display={showCreateModal || showEditModal} onClose={closeModals} size="md">
		<ModalContainer>
			<ModalHeader>
				<h2 class="text-lg font-semibold text-foreground">
					{editingCategory ? 'Edit Category' : 'Create Category'}
				</h2>
			</ModalHeader>
			<ModalBody class="space-y-4 p-6">
				<div class="grid gap-4 sm:grid-cols-2">
					<Input
						label="Category Name"
						placeholder="Enter category name"
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
					<label for="category-parent-id" class="block text-sm font-medium text-foreground mb-2">Parent Category</label>
					<Input
						id="category-parent-id"
						type="select"
						placeholder="None (top level)"
						value={formData.parentId}
						onchange={(e) => formData.parentId = (e.target as HTMLSelectElement).value}
						options={availableParents}
					/>
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
					{editingCategory ? 'Save Changes' : 'Create Category'}
				</Button>
			</ModalFooter>
		</ModalContainer>
	</Modal>
</div>

<style lang="scss">
	.admin-categories-page {
		min-height: 100vh;
	}

	@media (max-width: 640px) {
		.admin-categories-page {
			padding: 1rem;
		}
	}
</style>