import { g as ensure_array_like, k as attr, h as escape_html, b as attr_class, t as stringify, p as derived } from "../../../../../chunks/root.js";
import "../../../../../chunks/state.svelte.js";
import "@sveltejs/kit/internal";
import "../../../../../chunks/exports.js";
import "../../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import { M as Main, i as iconify, b as Main$3, t as toast } from "../../../../../chunks/index.js";
import { M as Main$1, a as Main$2 } from "../../../../../chunks/index4.js";
import { M as Modal, a as Main$4, b as Main$5, c as Main$6, d as Main$7 } from "../../../../../chunks/index3.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let brands = [];
    let loading = false;
    let total = 0;
    let pageNumber = 1;
    let pageSize = 20;
    let searchQuery = "";
    let showDeleted = false;
    let showCreateModal = false;
    let showEditModal = false;
    let editingBrand = null;
    let formErrors = {};
    let formSubmitting = false;
    let formData = {
      name: "",
      slug: "",
      logoUrl: "",
      description: "",
      status: "active"
    };
    async function fetchBrands() {
      loading = true;
      try {
        const params = new URLSearchParams({
          page: String(pageNumber),
          pageSize: String(pageSize),
          includeDeleted: String(showDeleted)
        });
        if (searchQuery) params.set("search", searchQuery);
        const res = await fetch(`/api/admin/brands/list?${params}`);
        const data = await res.json();
        if (data.success) {
          brands = data.items;
          total = data.total;
          pageNumber = data.page;
        } else {
          toast.error(data.messages?.en ?? "Failed to fetch brands");
        }
      } catch (e) {
        console.error("[brands] fetch error:", e);
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
          fetchBrands();
        },
        300
      );
    }
    function handleShowDeletedChange(value) {
      showDeleted = value;
      pageNumber = 1;
      fetchBrands();
    }
    function goToPage(page) {
      if (page >= 1 && page <= totalPages()) {
        pageNumber = page;
        fetchBrands();
      }
    }
    let totalPages = derived(() => Math.ceil(total / pageSize) || 1);
    function openCreateModal() {
      resetForm();
      showCreateModal = true;
    }
    function openEditModal(brand) {
      resetForm();
      editingBrand = brand;
      formData = {
        name: brand.name,
        slug: brand.slug,
        logoUrl: brand.logoUrl ?? "",
        description: brand.description ?? "",
        status: brand.status
      };
      showEditModal = true;
    }
    function resetForm() {
      formData = {
        name: "",
        slug: "",
        logoUrl: "",
        description: "",
        status: "active"
      };
      formErrors = {};
      editingBrand = null;
      formSubmitting = false;
    }
    function generateSlug(name) {
      return name.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
    }
    function validateForm() {
      formErrors = {};
      if (!formData.name.trim()) {
        formErrors.name = "Brand name is required";
      }
      if (formData.name.trim().length < 2) {
        formErrors.name = "Brand name must be at least 2 characters";
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
        const url = editingBrand ? `/api/admin/brands/update/${editingBrand._id}` : "/api/admin/brands/create";
        const res = await fetch(url, {
          method: editingBrand ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        });
        const data = await res.json();
        if (data.success) {
          toast.success(data.messages?.en ?? (editingBrand ? "Brand updated" : "Brand created"));
          closeModals();
          fetchBrands();
        } else {
          toast.error(data.messages?.en ?? "Operation failed");
          if (data.fieldErrors) {
            formErrors = data.fieldErrors;
          }
        }
      } catch (e) {
        console.error("[brands] submit error:", e);
        toast.error("Network error");
      } finally {
        formSubmitting = false;
      }
    }
    async function deleteBrand(brand) {
      if (!confirm(`Delete "${brand.name}"? This action cannot be undone.`)) return;
      try {
        const res = await fetch(`/api/admin/brands/delete/${brand._id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          toast.success(data.messages?.en ?? "Brand deleted");
          fetchBrands();
        } else {
          toast.error(data.messages?.en ?? "Failed to delete brand");
        }
      } catch (e) {
        console.error("[brands] delete error:", e);
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
    $$renderer2.push(`<div class="me-xauk71 admin-brands-page svelte-11z0yrs"><div class="me-ky7fge"><div><h1 class="me-6k2gd8 text-foreground">Brands</h1> <p class="me-h06780 text-foreground-400">Manage product brands</p></div> `);
    Main($$renderer2, {
      variant: "solid",
      color: "primary",
      onclick: (
        // Reactive fetch on page/search changes
        openCreateModal
      ),
      icon: iconify["plus-rounded"],
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->Add Brand`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----></div> <div class="me-fa1hwn bg-background border-border"><div class="me-u44t9k">`);
    {
      let leading = function($$renderer3, data) {
        Main$3($$renderer3, {
          icon: iconify["search-rounded"],
          size: data?.size ?? "sm",
          class: data?.defaultStyles
        });
      };
      Main$1($$renderer2, {
        placeholder: "Search brands...",
        value: searchQuery,
        oninput: (e) => handleSearch(e.target.value),
        size: "sm",
        leading,
        $$slots: { leading: true }
      });
    }
    $$renderer2.push(`<!----></div> <div class="me-rkf475">`);
    Main$2($$renderer2, {
      checked: showDeleted,
      onchange: (e) => handleShowDeletedChange(e.target.checked),
      label: "Show deleted",
      size: "sm"
    });
    $$renderer2.push(`<!----></div></div> <div class="me-uxduef bg-background border-border">`);
    if (loading) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="me-dfog5z text-foreground-400">Loading brands...</div>`);
    } else if (brands.length === 0) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<div class="me-dfog5z text-foreground-400">No brands found</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="me-hzf0h0"><table class="me-u4o3ie"><thead class="bg-foreground-50 dark:bg-foreground-900/20"><tr><th class="me-fo7x1x text-foreground-400">Brand</th><th class="me-fo7x1x text-foreground-400">Slug</th><th class="me-fo7x1x text-foreground-400">Logo</th><th class="me-fo7x1x text-foreground-400">Status</th><th class="me-fo7x1x text-foreground-400">Updated</th><th class="me-hwhhp6 text-foreground-400">Actions</th></tr></thead><tbody class="me-wbt8ks divide-border"><!--[-->`);
      const each_array = ensure_array_like(brands);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let brand = each_array[$$index];
        $$renderer2.push(`<tr class="me-7r1i9j hover:bg-foreground-50/50 dark:hover:bg-foreground-900/10"><td class="me-ioaq8w"><div class="me-r0bwf6">`);
        if (brand.logoUrl) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<img${attr("src", brand.logoUrl)}${attr("alt", brand.name)} class="me-2vf8zh bg-foreground-100 dark:bg-foreground-800"/>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<div class="me-d47xyw bg-foreground-100 dark:bg-foreground-800">`);
          Main$3($$renderer2, {
            icon: iconify["tag-rounded"],
            size: "md",
            class: "text-foreground-400"
          });
          $$renderer2.push(`<!----></div>`);
        }
        $$renderer2.push(`<!--]--> <div><p class="me-ns9e9y text-foreground">${escape_html(brand.name)}</p> `);
        if (brand.description) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<p class="me-i4aovp text-foreground-400">${escape_html(brand.description)}</p>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div></div></td><td class="me-ioaq8w"><code class="me-1dq090 text-foreground">${escape_html(brand.slug)}</code></td><td class="me-ioaq8w">`);
        if (brand.logoUrl) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<img${attr("src", brand.logoUrl)} alt="" class="me-t0q1p5"/>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<span class="me-qgtghj text-foreground-400">—</span>`);
        }
        $$renderer2.push(`<!--]--></td><td class="me-ioaq8w"><span${attr_class(`me-p73rsz ${stringify(getStatusClass(brand.status))}`, "svelte-11z0yrs")}>${escape_html(brand.status)}</span></td><td class="me-yfpyie text-foreground-400">${escape_html(formatDate(brand.updatedAt))}</td><td class="me-31iw7k"><div class="me-5z0yr1">`);
        Main($$renderer2, {
          variant: "ghost",
          size: "sm",
          icon: iconify["pencil-rounded"],
          "aria-label": "Edit brand",
          onclick: () => openEditModal(brand)
        });
        $$renderer2.push(`<!----> `);
        Main($$renderer2, {
          variant: "ghost",
          size: "sm",
          color: "danger",
          icon: iconify["trash-rounded"],
          "aria-label": "Delete brand",
          onclick: () => deleteBrand(brand)
        });
        $$renderer2.push(`<!----></div></td></tr>`);
      }
      $$renderer2.push(`<!--]--></tbody></table></div> `);
      if (totalPages() > 1) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="me-4hg8u2 border-border"><p class="me-qgtghj text-foreground-400">Showing ${escape_html((pageNumber - 1) * pageSize + 1)} to ${escape_html(Math.min(pageNumber * pageSize, total))} of ${escape_html(total)} brands</p> <div class="me-b8ktwr">`);
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
        Main$4($$renderer3, {
          children: ($$renderer4) => {
            Main$5($$renderer4, {
              children: ($$renderer5) => {
                $$renderer5.push(`<h2 class="me-dyo6o7 text-foreground">${escape_html(editingBrand ? "Edit Brand" : "Create Brand")}</h2>`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----> `);
            Main$6($$renderer4, {
              class: "me-ticwyv",
              children: ($$renderer5) => {
                $$renderer5.push(`<div class="me-48km8b">`);
                Main$1($$renderer5, {
                  label: "Brand Name",
                  placeholder: "Enter brand name",
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
                $$renderer5.push(`<!----></div> <div><label for="brand-logo-url" class="me-aj84j7 text-foreground">Logo URL</label> `);
                Main$1($$renderer5, {
                  id: "brand-logo-url",
                  placeholder: "https://example.com/logo.png",
                  value: formData.logoUrl,
                  oninput: (e) => formData.logoUrl = e.target.value
                });
                $$renderer5.push(`<!----></div> <div><label for="brand-description" class="me-aj84j7 text-foreground">Description</label> <textarea id="brand-description" class="me-5qwc8a border-border bg-background text-foreground placeholder-foreground-400"${attr("rows", 3)} placeholder="Enter brand description...">`);
                const $$body = escape_html(formData.description);
                if ($$body) {
                  $$renderer5.push(`${$$body}`);
                }
                $$renderer5.push(`</textarea></div> <div class="me-48km8b">`);
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
            Main$7($$renderer4, {
              class: "me-vzogsd",
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
                    $$renderer6.push(`<!---->${escape_html(editingBrand ? "Save Changes" : "Create Brand")}`);
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
