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
    let products = [];
    let categories = [];
    let brands = [];
    let loading = false;
    let total = 0;
    let pageNumber = 1;
    let pageSize = 20;
    let searchQuery = "";
    let selectedCategory = "";
    let selectedBrand = "";
    let showDeleted = false;
    let showCreateModal = false;
    let showEditModal = false;
    let editingProduct = null;
    let formErrors = {};
    let formSubmitting = false;
    let formData = {
      name: "",
      description: "",
      categoryId: "",
      brandId: "",
      hasVariants: false,
      variantAttributes: {},
      imageUrl: "",
      status: "active"
    };
    async function fetchProducts() {
      loading = true;
      try {
        const params = new URLSearchParams({
          page: String(pageNumber),
          pageSize: String(pageSize),
          includeDeleted: String(showDeleted)
        });
        if (searchQuery) params.set("search", searchQuery);
        if (selectedCategory) params.set("categoryId", selectedCategory);
        if (selectedBrand) params.set("brandId", selectedBrand);
        const res = await fetch(`/api/admin/products/list?${params}`);
        const data = await res.json();
        if (data.success) {
          products = data.items;
          total = data.total;
          pageNumber = data.page;
        } else {
          toast.error(data.messages?.en ?? "Failed to fetch products");
        }
      } catch (e) {
        console.error("[products] fetch error:", e);
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
          fetchProducts();
        },
        300
      );
    }
    function handleCategoryChange(value) {
      selectedCategory = value;
      pageNumber = 1;
      fetchProducts();
    }
    function handleBrandChange(value) {
      selectedBrand = value;
      pageNumber = 1;
      fetchProducts();
    }
    function handleShowDeletedChange(value) {
      showDeleted = value;
      pageNumber = 1;
      fetchProducts();
    }
    function goToPage(page) {
      if (page >= 1 && page <= totalPages()) {
        pageNumber = page;
        fetchProducts();
      }
    }
    let totalPages = derived(() => Math.ceil(total / pageSize) || 1);
    function openCreateModal() {
      resetForm();
      showCreateModal = true;
    }
    function openEditModal(product) {
      resetForm();
      editingProduct = product;
      formData = {
        name: product.name,
        description: product.description ?? "",
        categoryId: product.categoryId ?? "",
        brandId: product.brandId ?? "",
        hasVariants: product.hasVariants,
        variantAttributes: product.variantAttributes ?? {},
        imageUrl: product.imageUrl ?? "",
        status: product.status
      };
      showEditModal = true;
    }
    function resetForm() {
      formData = {
        name: "",
        description: "",
        categoryId: "",
        brandId: "",
        hasVariants: false,
        variantAttributes: {},
        imageUrl: "",
        status: "active"
      };
      formErrors = {};
      editingProduct = null;
      formSubmitting = false;
    }
    function validateForm() {
      formErrors = {};
      if (!formData.name.trim()) {
        formErrors.name = "Product name is required";
      }
      if (formData.name.trim().length < 2) {
        formErrors.name = "Product name must be at least 2 characters";
      }
      if (formData.hasVariants && Object.keys(formData.variantAttributes).length === 0) {
        formErrors.variantAttributes = "At least one variant attribute is required";
      }
      return Object.keys(formErrors).length === 0;
    }
    async function submitForm() {
      if (!validateForm()) return;
      formSubmitting = true;
      try {
        const url = editingProduct ? `/api/admin/products/update/${editingProduct._id}` : "/api/admin/products/create";
        const res = await fetch(url, {
          method: editingProduct ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        });
        const data = await res.json();
        if (data.success) {
          toast.success(data.messages?.en ?? (editingProduct ? "Product updated" : "Product created"));
          closeModals();
          fetchProducts();
        } else {
          toast.error(data.messages?.en ?? "Operation failed");
          if (data.fieldErrors) {
            formErrors = data.fieldErrors;
          }
        }
      } catch (e) {
        console.error("[products] submit error:", e);
        toast.error("Network error");
      } finally {
        formSubmitting = false;
      }
    }
    async function deleteProduct(product) {
      if (!confirm(`Delete "${product.name}"? This action cannot be undone.`)) return;
      try {
        const res = await fetch(`/api/admin/products/delete/${product._id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          toast.success(data.messages?.en ?? "Product deleted");
          fetchProducts();
        } else {
          toast.error(data.messages?.en ?? "Failed to delete product");
        }
      } catch (e) {
        console.error("[products] delete error:", e);
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
        case "discontinued":
          return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
        case "draft":
          return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
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
    $$renderer2.push(`<div class="me-cdiyrz admin-products-page svelte-ebl3nq"><div class="me-agjcp0"><div><h1 class="me-336u2q text-foreground">Products</h1> <p class="me-b9pl3q text-foreground-400">Manage your product catalog</p></div> `);
    Main($$renderer2, {
      variant: "solid",
      color: "primary",
      onclick: (
        // Reactive fetch on page/search changes
        // track page navigation
        openCreateModal
      ),
      icon: iconify["plus-rounded"],
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->Add Product`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----></div> <div class="me-xqubx5 bg-background border-border"><div class="me-ecvini">`);
    {
      let leading = function($$renderer3, data) {
        Main$3($$renderer3, {
          icon: iconify["search-rounded"],
          size: data?.size ?? "sm",
          class: data?.defaultStyles
        });
      };
      Main$1($$renderer2, {
        placeholder: "Search products...",
        value: searchQuery,
        oninput: (e) => handleSearch(e.target.value),
        size: "sm",
        leading,
        $$slots: { leading: true }
      });
    }
    $$renderer2.push(`<!----></div> <div class="me-pnmcsj">`);
    Main$1($$renderer2, {
      type: "select",
      placeholder: "All Categories",
      value: selectedCategory,
      onchange: (e) => handleCategoryChange(e.target.value),
      size: "sm",
      options: categories.map((c) => ({ value: c._id, label: c.name }))
    });
    $$renderer2.push(`<!----> `);
    Main$1($$renderer2, {
      type: "select",
      placeholder: "All Brands",
      value: selectedBrand,
      onchange: (e) => handleBrandChange(e.target.value),
      size: "sm",
      options: brands.map((b) => ({ value: b._id, label: b.name }))
    });
    $$renderer2.push(`<!----> `);
    Main$2($$renderer2, {
      checked: showDeleted,
      onchange: (e) => handleShowDeletedChange(e.target.checked),
      label: "Show deleted",
      size: "sm"
    });
    $$renderer2.push(`<!----></div></div> <div class="me-uoik9l bg-background border-border">`);
    if (loading) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="me-cpbmuh text-foreground-400">Loading products...</div>`);
    } else if (products.length === 0) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<div class="me-cpbmuh text-foreground-400">No products found</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="me-9m28ve"><table class="me-2lzq0c"><thead class="bg-foreground-50 dark:bg-foreground-900/20"><tr><th class="me-7j5xon text-foreground-400">Product</th><th class="me-7j5xon text-foreground-400">Category</th><th class="me-7j5xon text-foreground-400">Brand</th><th class="me-7j5xon text-foreground-400">Variants</th><th class="me-7j5xon text-foreground-400">Status</th><th class="me-7j5xon text-foreground-400">Updated</th><th class="me-1m8jog text-foreground-400">Actions</th></tr></thead><tbody class="me-hli2ya divide-border"><!--[-->`);
      const each_array = ensure_array_like(products);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let product = each_array[$$index];
        $$renderer2.push(`<tr class="me-cyk2tl hover:bg-foreground-50/50 dark:hover:bg-foreground-900/10"><td class="me-3w7hl2"><div class="me-99v07c">`);
        if (product.imageUrl) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<img${attr("src", product.imageUrl)}${attr("alt", product.name)} class="me-z951g4"/>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<div class="me-1o60ri bg-foreground-100 dark:bg-foreground-800">`);
          Main$3($$renderer2, {
            icon: iconify["package-rounded"],
            size: "md",
            class: "text-foreground-400"
          });
          $$renderer2.push(`<!----></div>`);
        }
        $$renderer2.push(`<!--]--> <div><p class="me-yy820c text-foreground">${escape_html(product.name)}</p> `);
        if (product.description) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<p class="me-kxj6p3 text-foreground-400">${escape_html(product.description)}</p>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div></div></td><td class="me-3w7hl2">`);
        if (product.categoryId) {
          $$renderer2.push("<!--[0-->");
          if (categories.find((c) => c._id === product.categoryId)) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="me-10rscp text-foreground">${escape_html(cat.name)}</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`<span class="me-10rscp text-foreground-400">Unknown</span>`);
          }
          $$renderer2.push(`<!--]-->`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<span class="me-10rscp text-foreground-400">—</span>`);
        }
        $$renderer2.push(`<!--]--></td><td class="me-3w7hl2">`);
        if (product.brandId) {
          $$renderer2.push("<!--[0-->");
          if (brands.find((b) => b._id === product.brandId)) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="me-10rscp text-foreground">${escape_html(brand.name)}</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`<span class="me-10rscp text-foreground-400">Unknown</span>`);
          }
          $$renderer2.push(`<!--]-->`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<span class="me-10rscp text-foreground-400">—</span>`);
        }
        $$renderer2.push(`<!--]--></td><td class="me-3w7hl2">`);
        if (product.hasVariants) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="me-roea86 text-foreground">${escape_html(Object.keys(product.variantAttributes ?? {}).length)} attributes</span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<span class="me-10rscp text-foreground-400">Simple product</span>`);
        }
        $$renderer2.push(`<!--]--></td><td class="me-3w7hl2"><span${attr_class(`me-t7u8ad ${stringify(getStatusClass(product.status))}`, "svelte-ebl3nq")}>${escape_html(product.status)}</span></td><td class="me-95wnlo text-foreground-400">${escape_html(formatDate(product.updatedAt))}</td><td class="me-d39ms6"><div class="me-l171i7">`);
        Main($$renderer2, {
          variant: "ghost",
          size: "sm",
          icon: iconify["pencil-rounded"],
          "aria-label": "Edit product",
          onclick: () => openEditModal(product)
        });
        $$renderer2.push(`<!----> `);
        Main($$renderer2, {
          variant: "ghost",
          size: "sm",
          color: "danger",
          icon: iconify["trash-rounded"],
          "aria-label": "Delete product",
          onclick: () => deleteProduct(product)
        });
        $$renderer2.push(`<!----></div></td></tr>`);
      }
      $$renderer2.push(`<!--]--></tbody></table></div> `);
      if (totalPages() > 1) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="me-oiehds border-border"><p class="me-10rscp text-foreground-400">Showing ${escape_html((pageNumber - 1) * pageSize + 1)} to ${escape_html(Math.min(pageNumber * pageSize, total))} of ${escape_html(total)} products</p> <div class="me-4oix5p">`);
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
      size: "lg",
      children: ($$renderer3) => {
        Main$4($$renderer3, {
          children: ($$renderer4) => {
            Main$5($$renderer4, {
              children: ($$renderer5) => {
                $$renderer5.push(`<h2 class="me-f008mx text-foreground">${escape_html(editingProduct ? "Edit Product" : "Create Product")}</h2>`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----> `);
            Main$6($$renderer4, {
              class: "me-yw0dzt",
              children: ($$renderer5) => {
                $$renderer5.push(`<div class="me-bvoygt">`);
                Main$1($$renderer5, {
                  label: "Product Name",
                  placeholder: "Enter product name",
                  value: formData.name,
                  oninput: (e) => {
                    formData.name = e.target.value;
                    delete formErrors.name;
                  },
                  error: formErrors.name,
                  required: true
                });
                $$renderer5.push(`<!----> `);
                Main$1($$renderer5, {
                  type: "select",
                  label: "Category",
                  placeholder: "Select category",
                  value: formData.categoryId,
                  onchange: (e) => formData.categoryId = e.target.value,
                  options: categories.map((c) => ({ value: c._id, label: c.name }))
                });
                $$renderer5.push(`<!----> `);
                Main$1($$renderer5, {
                  type: "select",
                  label: "Brand",
                  placeholder: "Select brand",
                  value: formData.brandId,
                  onchange: (e) => formData.brandId = e.target.value,
                  options: brands.map((b) => ({ value: b._id, label: b.name }))
                });
                $$renderer5.push(`<!----> `);
                Main$1($$renderer5, {
                  type: "select",
                  label: "Status",
                  value: formData.status,
                  onchange: (e) => formData.status = e.target.value,
                  options: [
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                    { value: "draft", label: "Draft" },
                    { value: "discontinued", label: "Discontinued" }
                  ]
                });
                $$renderer5.push(`<!----></div> <div><label for="product-description" class="me-9wt345 text-foreground">Description</label> <textarea id="product-description" class="me-2pvaxc border-border bg-background text-foreground placeholder-foreground-400"${attr("rows", 3)} placeholder="Enter product description...">`);
                const $$body = escape_html(formData.description);
                if ($$body) {
                  $$renderer5.push(`${$$body}`);
                }
                $$renderer5.push(`</textarea></div> <div><label for="product-image-url" class="me-9wt345 text-foreground">Image URL</label> `);
                Main$1($$renderer5, {
                  id: "product-image-url",
                  placeholder: "https://example.com/image.jpg",
                  value: formData.imageUrl,
                  oninput: (e) => formData.imageUrl = e.target.value
                });
                $$renderer5.push(`<!----></div> <fieldset class="me-uhv1i5 border-border"><legend class="me-boiegx text-foreground">Variant Attributes</legend> <div class="me-muj96u">`);
                Main$2($$renderer5, {
                  checked: formData.hasVariants,
                  onchange: (e) => formData.hasVariants = e.target.checked,
                  label: "This product has variants"
                });
                $$renderer5.push(`<!----></div> `);
                if (formData.hasVariants) {
                  $$renderer5.push("<!--[0-->");
                  $$renderer5.push(`<div class="me-xx2cws"><!--[-->`);
                  const each_array_1 = ensure_array_like(Object.entries(formData.variantAttributes));
                  for (let i = 0, $$length = each_array_1.length; i < $$length; i++) {
                    let [attrName, values] = each_array_1[i];
                    $$renderer5.push(`<div class="me-4oix5p">`);
                    Main$1($$renderer5, {
                      placeholder: "Attribute name (e.g., Size, Color)",
                      value: attrName,
                      oninput: (e) => {
                        const newName = e.target.value;
                        if (newName !== attrName) {
                          const newAttrs = { ...formData.variantAttributes };
                          delete newAttrs[attrName];
                          if (newName) newAttrs[newName] = values;
                          formData.variantAttributes = newAttrs;
                        }
                      }
                    });
                    $$renderer5.push(`<!----> `);
                    Main$1($$renderer5, {
                      placeholder: "Values (comma separated)",
                      value: values.join(", "),
                      oninput: (e) => {
                        const newValues = e.target.value.split(",").map((v) => v.trim()).filter(Boolean);
                        formData.variantAttributes = { ...formData.variantAttributes, [attrName]: newValues };
                      }
                    });
                    $$renderer5.push(`<!----> `);
                    Main($$renderer5, {
                      variant: "ghost",
                      size: "sm",
                      color: "danger",
                      icon: iconify["trash-rounded"],
                      "aria-label": "Remove attribute",
                      onclick: () => {
                        const newAttrs = { ...formData.variantAttributes };
                        delete newAttrs[attrName];
                        formData.variantAttributes = newAttrs;
                      }
                    });
                    $$renderer5.push(`<!----></div>`);
                  }
                  $$renderer5.push(`<!--]--> `);
                  Main($$renderer5, {
                    variant: "outline",
                    size: "sm",
                    icon: iconify["plus-rounded"],
                    onclick: () => {
                      const nextIndex = Object.keys(formData.variantAttributes).length + 1;
                      formData.variantAttributes = { ...formData.variantAttributes, [`attribute${nextIndex}`]: [] };
                    },
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Add Attribute`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----></div> `);
                  if (formErrors.variantAttributes) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="me-r2bupk text-danger">${escape_html(formErrors.variantAttributes)}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]-->`);
                } else {
                  $$renderer5.push("<!--[-1-->");
                }
                $$renderer5.push(`<!--]--></fieldset>`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----> `);
            Main$7($$renderer4, {
              class: "me-cccyj3",
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
                    $$renderer6.push(`<!---->${escape_html(editingProduct ? "Save Changes" : "Create Product")}`);
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
