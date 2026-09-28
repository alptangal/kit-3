import { g as ensure_array_like, h as escape_html, p as derived, d as attr_style, t as stringify, b as attr_class } from "../../../../../chunks/root.js";
import "../../../../../chunks/state.svelte.js";
import "@sveltejs/kit/internal";
import "../../../../../chunks/exports.js";
import "../../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import { M as Main, i as iconify, t as toast, b as Main$7 } from "../../../../../chunks/index.js";
import { M as Main$1, a as Main$2 } from "../../../../../chunks/index4.js";
import { M as Modal, a as Main$3, b as Main$4, c as Main$5, d as Main$6 } from "../../../../../chunks/index3.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let categories = [];
    let loading = false;
    let total = 0;
    let pageNumber = 1;
    let pageSize = 20;
    let searchQuery = "";
    let showDeleted = false;
    let showCreateModal = false;
    let showEditModal = false;
    let editingCategory = null;
    let formErrors = {};
    let formSubmitting = false;
    let formData = { name: "", slug: "", parentId: "", status: "active" };
    async function fetchCategories() {
      loading = true;
      try {
        const params = new URLSearchParams({
          page: String(pageNumber),
          pageSize: String(pageSize),
          includeDeleted: String(showDeleted)
        });
        if (searchQuery) params.set("search", searchQuery);
        const res = await fetch(`/api/admin/categories/list?${params}`);
        const data = await res.json();
        if (data.success) {
          categories = data.items;
          total = data.total;
          pageNumber = data.page;
        } else {
          toast.error(data.messages?.en ?? "Failed to fetch categories");
        }
      } catch (e) {
        console.error("[categories] fetch error:", e);
        toast.error("Network error");
      } finally {
        loading = false;
      }
    }
    let searchDebounce;
    function handleSearch(value) {
      searchQuery = value;
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(
        () => {
          pageNumber = 1;
          fetchCategories();
        },
        300
      );
    }
    function handleShowDeletedChange(value) {
      showDeleted = value;
      pageNumber = 1;
      fetchCategories();
    }
    function goToPage(page) {
      if (page >= 1 && page <= totalPages()) {
        pageNumber = page;
        fetchCategories();
      }
    }
    let totalPages = derived(() => Math.ceil(total / pageSize) || 1);
    let availableParents = derived(() => categories.filter((c) => !editingCategory || c._id !== editingCategory._id).map((c) => ({ value: c._id, label: c.name })));
    function openCreateModal() {
      resetForm();
      showCreateModal = true;
    }
    function openEditModal(category) {
      resetForm();
      editingCategory = category;
      formData = {
        name: category.name,
        slug: category.slug,
        parentId: category.parentId ?? "",
        status: category.status
      };
      showEditModal = true;
    }
    function resetForm() {
      formData = { name: "", slug: "", parentId: "", status: "active" };
      formErrors = {};
      editingCategory = null;
      formSubmitting = false;
    }
    function generateSlug(name) {
      return name.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
    }
    function validateForm() {
      formErrors = {};
      if (!formData.name.trim()) {
        formErrors.name = "Category name is required";
      }
      if (formData.name.trim().length < 2) {
        formErrors.name = "Category name must be at least 2 characters";
      }
      if (!formData.slug.trim()) {
        formErrors.slug = "Slug is required";
      }
      if (formData.slug.trim().length < 2) {
        formErrors.slug = "Slug must be at least 2 characters";
      }
      if (!/^[a-z0-9-]+$/.test(formData.slug)) {
        formErrors.slug = "Slug can only contain lowercase letters, numbers, and hyphens";
      }
      return Object.keys(formErrors).length === 0;
    }
    async function submitForm() {
      if (!validateForm()) return;
      formSubmitting = true;
      try {
        const url = editingCategory ? `/api/admin/categories/update/${editingCategory._id}` : "/api/admin/categories/create";
        const res = await fetch(url, {
          method: editingCategory ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        });
        const data = await res.json();
        if (data.success) {
          toast.success(data.messages?.en ?? (editingCategory ? "Category updated" : "Category created"));
          closeModals();
          fetchCategories();
        } else {
          toast.error(data.messages?.en ?? "Operation failed");
          if (data.fieldErrors) {
            formErrors = data.fieldErrors;
          }
        }
      } catch (e) {
        console.error("[categories] submit error:", e);
        toast.error("Network error");
      } finally {
        formSubmitting = false;
      }
    }
    async function deleteCategory(category) {
      if (!confirm(`Delete "${category.name}"? This action cannot be undone.`)) return;
      try {
        const res = await fetch(`/api/admin/categories/delete/${category._id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          toast.success(data.messages?.en ?? "Category deleted");
          fetchCategories();
        } else {
          toast.error(data.messages?.en ?? "Failed to delete category");
        }
      } catch (e) {
        console.error("[categories] delete error:", e);
        toast.error("Network error");
      }
    }
    function closeModals() {
      showCreateModal = false;
      showEditModal = false;
      resetForm();
    }
    function getStatusClass(status) {
      switch (status) {
        case "active":
          return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
        case "inactive":
          return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
        default:
          return "bg-gray-100 text-gray-800";
      }
    }
    function formatDate(dateStr) {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    }
    let categoryTree = derived(() => buildCategoryTree(categories));
    function buildCategoryTree(items) {
      const map = /* @__PURE__ */ new Map();
      const roots = [];
      items.forEach((item) => {
        map.set(item._id, { ...item, children: [] });
      });
      items.forEach((item) => {
        const node = map.get(item._id);
        if (item.parentId && map.has(item.parentId)) {
          map.get(item.parentId).children.push(node);
        } else {
          roots.push(node);
        }
      });
      return roots;
    }
    function renderCategoryTree($$renderer3, items, depth = 0) {
      $$renderer3.push(`<div class="me-z13g9l"><!--[-->`);
      const each_array = ensure_array_like(items);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let category = each_array[$$index];
        $$renderer3.push(`<div class="me-teuw3b"${attr_style(`padding-left: ${stringify(depth * 1.5)}rem`)}><div class="me-2gheyp"><span class="me-ng3qts text-foreground">${escape_html(category.name)}</span> <span class="me-jppk4n text-foreground-400">(${escape_html(category.slug)})</span> <span${attr_class(`me-qgfyj3 ${stringify(getStatusClass(category.status))}`, "svelte-189yd4y")}>${escape_html(category.status)}</span> <span class="me-zxdn9n text-foreground-400">${escape_html(formatDate(category.updatedAt))}</span> <div class="me-mzpknm">`);
        Main($$renderer3, {
          variant: "ghost",
          size: "xs",
          icon: iconify["pencil-rounded"],
          "aria-label": "Edit category",
          onclick: () => openEditModal(category)
        });
        $$renderer3.push(`<!----> `);
        Main($$renderer3, {
          variant: "ghost",
          size: "xs",
          color: "danger",
          icon: iconify["trash-rounded"],
          "aria-label": "Delete category",
          onclick: () => deleteCategory(category)
        });
        $$renderer3.push(`<!----></div></div> `);
        if (category.children && category.children.length > 0) {
          $$renderer3.push("<!--[0-->");
          renderCategoryTree($$renderer3, category.children, depth + 1);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--></div>`);
      }
      $$renderer3.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<div class="me-y2iwwj admin-categories-page svelte-189yd4y"><div class="me-ff01aw"><div><h1 class="me-l554v6 text-foreground">Categories</h1> <p class="me-2wa1a6 text-foreground-400">Manage product categories</p></div> `);
    Main($$renderer2, {
      variant: "solid",
      color: "primary",
      onclick: openCreateModal,
      icon: iconify["plus-rounded"],
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->Add Category`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----></div> <div class="me-if0a9d bg-background border-border"><div class="me-dzju7a">`);
    {
      let leading = function($$renderer3, data) {
        Main$7($$renderer3, {
          icon: iconify["search-rounded"],
          size: data?.size ?? "sm",
          class: data?.defaultStyles
        });
      };
      Main$1($$renderer2, {
        placeholder: "Search categories...",
        value: searchQuery,
        oninput: (e) => handleSearch(e.target.value),
        size: "sm",
        leading,
        $$slots: { leading: true }
      });
    }
    $$renderer2.push(`<!----></div> <div class="me-ni237z">`);
    Main$2($$renderer2, {
      checked: showDeleted,
      onchange: (e) => handleShowDeletedChange(e.target.checked),
      label: "Show deleted",
      size: "sm"
    });
    $$renderer2.push(`<!----></div></div> <div class="me-mobfw1 bg-background border-border">`);
    if (loading) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="me-g0csg1 text-foreground-400">Loading categories...</div>`);
    } else if (categories.length === 0) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<div class="me-g0csg1 text-foreground-400">No categories found</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="me-byj6au"><!--[-->`);
      const each_array_1 = ensure_array_like(categoryTree());
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let category = each_array_1[$$index_1];
        renderCategoryTree($$renderer2, [category], 0);
      }
      $$renderer2.push(`<!--]--></div> `);
      if (totalPages() > 1) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="me-1wear0 border-border"><p class="me-sps6w1 text-foreground-400">Showing ${escape_html((pageNumber - 1) * pageSize + 1)} to ${escape_html(Math.min(pageNumber * pageSize, total))} of ${escape_html(total)} categories</p> <div class="me-al204t">`);
        Main($$renderer2, {
          variant: "outline",
          size: "sm",
          icon: iconify["chevron-left-rounded"],
          disabled: pageNumber === 1,
          onclick: () => goToPage(pageNumber - 1),
          children: ($$renderer3) => {
            $$renderer3.push(`<!---->Previous`);
          },
          $$slots: { default: true }
        });
        $$renderer2.push(`<!----> `);
        Main($$renderer2, {
          variant: "outline",
          size: "sm",
          icon: iconify["chevron-right-rounded"],
          trailingIcon: true,
          disabled: pageNumber === totalPages(),
          onclick: () => goToPage(pageNumber + 1),
          children: ($$renderer3) => {
            $$renderer3.push(`<!---->Next`);
          },
          $$slots: { default: true }
        });
        $$renderer2.push(`<!----></div></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div> `);
    Modal($$renderer2, {
      display: showCreateModal || showEditModal,
      onclose: closeModals,
      size: "md",
      children: ($$renderer3) => {
        Main$3($$renderer3, {
          children: ($$renderer4) => {
            Main$4($$renderer4, {
              children: ($$renderer5) => {
                $$renderer5.push(`<h2 class="me-m62q4x text-foreground">${escape_html(editingCategory ? "Edit Category" : "Create Category")}</h2>`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----> `);
            Main$5($$renderer4, {
              class: "me-xijp4h",
              children: ($$renderer5) => {
                $$renderer5.push(`<div class="me-v4r45p">`);
                Main$1($$renderer5, {
                  label: "Category Name",
                  placeholder: "Enter category name",
                  value: formData.name,
                  oninput: (e) => {
                    formData.name = e.target.value;
                    delete formErrors.name;
                    if (!formData.slug || formData.slug === generateSlug(e.target.value)) {
                      formData.slug = generateSlug(e.target.value);
                    }
                  },
                  error: formErrors.name,
                  required: true
                });
                $$renderer5.push(`<!----> `);
                Main$1($$renderer5, {
                  label: "Slug",
                  placeholder: "auto-generated from name",
                  value: formData.slug,
                  oninput: (e) => {
                    formData.slug = e.target.value;
                    delete formErrors.slug;
                  },
                  error: formErrors.slug,
                  required: true
                });
                $$renderer5.push(`<!----></div> <div><label for="category-parent-id" class="me-n9m7j9 text-foreground">Parent Category</label> `);
                Main$1($$renderer5, {
                  id: "category-parent-id",
                  type: "select",
                  placeholder: "None (top level)",
                  value: formData.parentId,
                  onchange: (e) => formData.parentId = e.target.value,
                  options: availableParents()
                });
                $$renderer5.push(`<!----></div> <div class="me-v4r45p">`);
                Main$1($$renderer5, {
                  type: "select",
                  label: "Status",
                  value: formData.status,
                  onchange: (e) => formData.status = e.target.value,
                  options: [
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" }
                  ]
                });
                $$renderer5.push(`<!----></div>`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----> `);
            Main$6($$renderer4, {
              class: "me-h4yonn",
              children: ($$renderer5) => {
                Main($$renderer5, {
                  variant: "outline",
                  onclick: closeModals,
                  disabled: formSubmitting,
                  children: ($$renderer6) => {
                    $$renderer6.push(`<!---->Cancel`);
                  },
                  $$slots: { default: true }
                });
                $$renderer5.push(`<!----> `);
                Main($$renderer5, {
                  variant: "solid",
                  color: "primary",
                  loading: formSubmitting,
                  onclick: submitForm,
                  children: ($$renderer6) => {
                    $$renderer6.push(`<!---->${escape_html(editingCategory ? "Save Changes" : "Create Category")}`);
                  },
                  $$slots: { default: true }
                });
                $$renderer5.push(`<!---->`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!---->`);
          },
          $$slots: { default: true }
        });
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----></div>`);
  });
}
export {
  _page as default
};
