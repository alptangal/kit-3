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
    let variants = [];
    let products = [];
    let loading = false;
    let total = 0;
    let pageNumber = 1;
    let pageSize = 20;
    let searchQuery = "";
    let selectedProduct = "";
    let showDeleted = false;
    let showCreateModal = false;
    let showEditModal = false;
    let editingVariant = null;
    let formErrors = {};
    let formSubmitting = false;
    let formData = {
      productId: "",
      sku: "",
      barcode: "",
      attributes: {},
      displayName: "",
      price: 0,
      costPrice: 0,
      weight: 0,
      trackLot: false,
      trackExpiry: false,
      lowStockThreshold: 0,
      imageUrl: "",
      status: "active"
    };
    async function fetchVariants() {
      loading = true;
      try {
        const params = new URLSearchParams({
          page: String(pageNumber),
          pageSize: String(pageSize),
          includeDeleted: String(showDeleted)
        });
        if (searchQuery) params.set("search", searchQuery);
        if (selectedProduct) params.set("productId", selectedProduct);
        const res = await fetch(`/api/admin/variants/list?${params}`);
        const data = await res.json();
        if (data.success) {
          variants = data.items;
          total = data.total;
          pageNumber = data.page;
        } else {
          toast.error(data.messages?.en ?? "Failed to fetch variants");
        }
      } catch (e) {
        console.error("[variants] fetch error:", e);
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
          fetchVariants();
        },
        300
      );
    }
    function handleProductChange(value) {
      selectedProduct = value;
      pageNumber = 1;
      fetchVariants();
    }
    function handleShowDeletedChange(value) {
      showDeleted = value;
      pageNumber = 1;
      fetchVariants();
    }
    function goToPage(page) {
      if (page >= 1 && page <= totalPages()) {
        pageNumber = page;
        fetchVariants();
      }
    }
    let totalPages = derived(() => Math.ceil(total / pageSize) || 1);
    function openCreateModal() {
      resetForm();
      showCreateModal = true;
    }
    function openEditModal(variant) {
      resetForm();
      editingVariant = variant;
      formData = {
        productId: variant.productId,
        sku: variant.sku,
        barcode: variant.barcode ?? "",
        attributes: variant.attributes ?? {},
        displayName: variant.displayName,
        price: variant.price,
        costPrice: variant.costPrice ?? 0,
        weight: variant.weight ?? 0,
        trackLot: variant.trackLot ?? false,
        trackExpiry: variant.trackExpiry ?? false,
        lowStockThreshold: variant.lowStockThreshold ?? 0,
        imageUrl: variant.imageUrl ?? "",
        status: variant.status
      };
      showEditModal = true;
    }
    function resetForm() {
      formData = {
        productId: "",
        sku: "",
        barcode: "",
        attributes: {},
        displayName: "",
        price: 0,
        costPrice: 0,
        weight: 0,
        trackLot: false,
        trackExpiry: false,
        lowStockThreshold: 0,
        imageUrl: "",
        status: "active"
      };
      formErrors = {};
      editingVariant = null;
      formSubmitting = false;
    }
    function validateForm() {
      formErrors = {};
      if (!formData.productId) {
        formErrors.productId = "Product is required";
      }
      if (!formData.sku.trim()) {
        formErrors.sku = "SKU is required";
      }
      if (!formData.displayName.trim()) {
        formErrors.displayName = "Display name is required";
      }
      if (formData.price < 0) {
        formErrors.price = "Price must be >= 0";
      }
      return Object.keys(formErrors).length === 0;
    }
    async function submitForm() {
      if (!validateForm()) return;
      formSubmitting = true;
      try {
        const url = editingVariant ? `/api/admin/variants/update/${editingVariant._id}` : "/api/admin/variants/create";
        const res = await fetch(url, {
          method: editingVariant ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        });
        const data = await res.json();
        if (data.success) {
          toast.success(data.messages?.en ?? (editingVariant ? "Variant updated" : "Variant created"));
          closeModals();
          fetchVariants();
        } else {
          toast.error(data.messages?.en ?? "Operation failed");
          if (data.fieldErrors) {
            formErrors = data.fieldErrors;
          }
        }
      } catch (e) {
        console.error("[variants] submit error:", e);
        toast.error("Network error");
      } finally {
        formSubmitting = false;
      }
    }
    async function deleteVariant(variant) {
      if (!confirm(`Delete "${variant.displayName}" (SKU: ${variant.sku})? This action cannot be undone.`)) return;
      try {
        const res = await fetch(`/api/admin/variants/delete/${variant._id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          toast.success(data.messages?.en ?? "Variant deleted");
          fetchVariants();
        } else {
          toast.error(data.messages?.en ?? "Failed to delete variant");
        }
      } catch (e) {
        console.error("[variants] delete error:", e);
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
    function formatPrice(price) {
      return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);
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
    $$renderer2.push(`<div class="me-povlu5 admin-variants-page svelte-1hjgdug"><div class="me-q9eyca"><div><h1 class="me-wbu3u8 text-foreground">Variants</h1> <p class="me-hy3t30 text-foreground-400">Manage product variants</p></div> `);
    Main($$renderer2, {
      variant: "solid",
      color: "primary",
      onclick: (
        // Reactive fetch on page/search changes
        openCreateModal
      ),
      icon: iconify["plus-rounded"],
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->Add Variant`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----></div> <div class="me-n51xxr bg-background border-border"><div class="me-629b50">`);
    {
      let leading = function($$renderer3, data) {
        Main$3($$renderer3, {
          icon: iconify["search-rounded"],
          size: data?.size ?? "sm",
          class: data?.defaultStyles
        });
      };
      Main$1($$renderer2, {
        placeholder: "Search variants (SKU, name, barcode)...",
        value: searchQuery,
        oninput: (e) => handleSearch(e.target.value),
        size: "sm",
        leading,
        $$slots: { leading: true }
      });
    }
    $$renderer2.push(`<!----></div> <div class="me-8zc8dl">`);
    Main$1($$renderer2, {
      type: "select",
      placeholder: "All Products",
      value: selectedProduct,
      onchange: (e) => handleProductChange(e.target.value),
      size: "sm",
      options: products.map((p) => ({ value: p._id, label: p.name }))
    });
    $$renderer2.push(`<!----> `);
    Main$2($$renderer2, {
      checked: showDeleted,
      onchange: (e) => handleShowDeletedChange(e.target.checked),
      label: "Show deleted",
      size: "sm"
    });
    $$renderer2.push(`<!----></div></div> <div class="me-hx0b4f bg-background border-border">`);
    if (loading) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="me-ur93jz text-foreground-400">Loading variants...</div>`);
    } else if (variants.length === 0) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<div class="me-ur93jz text-foreground-400">No variants found</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="me-u4a9wo"><table class="me-w2kedu"><thead class="bg-foreground-50 dark:bg-foreground-900/20"><tr><th class="me-8ggfed text-foreground-400">Variant</th><th class="me-8ggfed text-foreground-400">Product</th><th class="me-8ggfed text-foreground-400">SKU</th><th class="me-8ggfed text-foreground-400">Attributes</th><th class="me-8ggfed text-foreground-400">Price</th><th class="me-8ggfed text-foreground-400">Cost</th><th class="me-8ggfed text-foreground-400">Status</th><th class="me-8ggfed text-foreground-400">Updated</th><th class="me-n3pfgu text-foreground-400">Actions</th></tr></thead><tbody class="me-w5kglc divide-border"><!--[-->`);
      const each_array = ensure_array_like(variants);
      for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
        let variant = each_array[$$index_1];
        $$renderer2.push(`<tr class="me-n0e61r hover:bg-foreground-50/50 dark:hover:bg-foreground-900/10"><td class="me-mq9wb0"><div class="me-2xshdy">`);
        if (variant.imageUrl) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<img${attr("src", variant.imageUrl)}${attr("alt", variant.displayName)} class="me-r170lm"/>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<div class="me-a3w75g bg-foreground-100 dark:bg-foreground-800">`);
          Main$3($$renderer2, {
            icon: iconify["cube-rounded"],
            size: "md",
            class: "text-foreground-400"
          });
          $$renderer2.push(`<!----></div>`);
        }
        $$renderer2.push(`<!--]--> <div><p class="me-4u4y36 text-foreground">${escape_html(variant.displayName)}</p> `);
        if (variant.barcode) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<p class="me-sqso9t text-foreground-400">${escape_html(variant.barcode)}</p>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div></div></td><td class="me-mq9wb0">`);
        if (products.find((p) => p._id === variant.productId)) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="me-a3pxjz text-foreground">${escape_html(prod.name)}</span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<span class="me-a3pxjz text-foreground-400">Unknown</span>`);
        }
        $$renderer2.push(`<!--]--></td><td class="me-mq9wb0"><code class="me-vf0t6w text-foreground">${escape_html(variant.sku)}</code></td><td class="me-mq9wb0"><div class="me-7ifzss"><!--[-->`);
        const each_array_1 = ensure_array_like(Object.entries(variant.attributes));
        for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
          let [key, value] = each_array_1[$$index];
          $$renderer2.push(`<span class="me-lxoweh bg-foreground-100 dark:bg-foreground-800 text-foreground-600 dark:text-foreground-400">${escape_html(key)}: ${escape_html(value)}</span>`);
        }
        $$renderer2.push(`<!--]--></div></td><td class="me-54yaht text-foreground">${escape_html(formatPrice(variant.price))}</td><td class="me-6n30oy text-foreground-400">${escape_html(formatPrice(variant.costPrice ?? 0))}</td><td class="me-mq9wb0"><span${attr_class(`me-dthl6b ${stringify(getStatusClass(variant.status))}`, "svelte-1hjgdug")}>${escape_html(variant.status)}</span></td><td class="me-6n30oy text-foreground-400">${escape_html(formatDate(variant.updatedAt))}</td><td class="me-jrnurg"><div class="me-ewtz25">`);
        Main($$renderer2, {
          variant: "ghost",
          size: "sm",
          icon: iconify["pencil-rounded"],
          "aria-label": "Edit variant",
          onclick: () => openEditModal(variant)
        });
        $$renderer2.push(`<!----> `);
        Main($$renderer2, {
          variant: "ghost",
          size: "sm",
          color: "danger",
          icon: iconify["trash-rounded"],
          "aria-label": "Delete variant",
          onclick: () => deleteVariant(variant)
        });
        $$renderer2.push(`<!----></div></td></tr>`);
      }
      $$renderer2.push(`<!--]--></tbody></table></div> `);
      if (totalPages() > 1) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="me-w3tsoe border-border"><p class="me-a3pxjz text-foreground-400">Showing ${escape_html((pageNumber - 1) * pageSize + 1)} to ${escape_html(Math.min(pageNumber * pageSize, total))} of ${escape_html(total)} variants</p> <div class="me-wm57bf">`);
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
                $$renderer5.push(`<h2 class="me-slwbu7 text-foreground">${escape_html(editingVariant ? "Edit Variant" : "Create Variant")}</h2>`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----> `);
            Main$6($$renderer4, {
              class: "me-oa800f",
              children: ($$renderer5) => {
                $$renderer5.push(`<div class="me-y0gdt7">`);
                Main$1($$renderer5, {
                  type: "select",
                  label: "Product",
                  placeholder: "Select product",
                  value: formData.productId,
                  onchange: (e) => formData.productId = e.target.value,
                  options: products.map((p) => ({ value: p._id, label: p.name })),
                  required: true,
                  error: formErrors.productId
                });
                $$renderer5.push(`<!----> `);
                Main$1($$renderer5, {
                  label: "SKU",
                  placeholder: "Enter SKU",
                  value: formData.sku,
                  oninput: (e) => {
                    formData.sku = e.target.value;
                    delete formErrors.sku;
                  },
                  error: formErrors.sku,
                  required: true
                });
                $$renderer5.push(`<!----> `);
                Main$1($$renderer5, {
                  label: "Barcode",
                  placeholder: "Enter barcode (optional)",
                  value: formData.barcode,
                  oninput: (e) => formData.barcode = e.target.value
                });
                $$renderer5.push(`<!----> `);
                Main$1($$renderer5, {
                  type: "number",
                  label: "Price",
                  placeholder: "0",
                  value: formData.price,
                  oninput: (e) => {
                    formData.price = parseFloat(e.target.value) || 0;
                    delete formErrors.price;
                  },
                  error: formErrors.price,
                  required: true,
                  min: 0,
                  step: 0.01
                });
                $$renderer5.push(`<!----> `);
                Main$1($$renderer5, {
                  type: "number",
                  label: "Cost Price",
                  placeholder: "0",
                  value: formData.costPrice,
                  oninput: (e) => formData.costPrice = parseFloat(e.target.value) || 0,
                  min: 0,
                  step: 0.01
                });
                $$renderer5.push(`<!----> `);
                Main$1($$renderer5, {
                  type: "number",
                  label: "Weight (g)",
                  placeholder: "0",
                  value: formData.weight,
                  oninput: (e) => formData.weight = parseFloat(e.target.value) || 0,
                  min: 0
                });
                $$renderer5.push(`<!----></div> <div><label for="variant-display-name" class="me-idqqhv text-foreground">Display Name</label> `);
                Main$1($$renderer5, {
                  id: "variant-display-name",
                  placeholder: "Enter display name",
                  value: formData.displayName,
                  oninput: (e) => {
                    formData.displayName = e.target.value;
                    delete formErrors.displayName;
                  },
                  error: formErrors.displayName,
                  required: true
                });
                $$renderer5.push(`<!----></div> <fieldset class="me-ned9or border-border"><legend class="me-ccmmsn text-foreground">Attributes</legend> <div class="me-nn6hpe"><!--[-->`);
                const each_array_2 = ensure_array_like(Object.entries(formData.attributes));
                for (let i = 0, $$length = each_array_2.length; i < $$length; i++) {
                  let [key, value] = each_array_2[i];
                  $$renderer5.push(`<div class="me-wm57bf">`);
                  Main$1($$renderer5, {
                    placeholder: "Attribute (e.g., Size)",
                    value: key,
                    oninput: (e) => {
                      const newKey = e.target.value;
                      if (newKey !== key) {
                        const newAttrs = { ...formData.attributes };
                        delete newAttrs[key];
                        if (newKey) newAttrs[newKey] = value;
                        formData.attributes = newAttrs;
                      }
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  Main$1($$renderer5, {
                    placeholder: "Value (e.g., M)",
                    value,
                    oninput: (e) => {
                      formData.attributes = { ...formData.attributes, [key]: e.target.value };
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
                      const newAttrs = { ...formData.attributes };
                      delete newAttrs[key];
                      formData.attributes = newAttrs;
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
                    const nextIndex = Object.keys(formData.attributes).length + 1;
                    formData.attributes = { ...formData.attributes, [`attr${nextIndex}`]: "" };
                  },
                  children: ($$renderer6) => {
                    $$renderer6.push(`<!---->Add Attribute`);
                  },
                  $$slots: { default: true }
                });
                $$renderer5.push(`<!----></div></fieldset> <fieldset class="me-ned9or border-border"><legend class="me-ccmmsn text-foreground">Advanced</legend> <div class="me-y0gdt7"><div class="me-8rwfwx">`);
                Main$2($$renderer5, {
                  checked: formData.trackLot,
                  onchange: (e) => formData.trackLot = e.target.checked,
                  label: "Track Lots"
                });
                $$renderer5.push(`<!----></div> <div class="me-8rwfwx">`);
                Main$2($$renderer5, {
                  checked: formData.trackExpiry,
                  onchange: (e) => formData.trackExpiry = e.target.checked,
                  label: "Track Expiry"
                });
                $$renderer5.push(`<!----></div> `);
                Main$1($$renderer5, {
                  type: "number",
                  label: "Low Stock Threshold",
                  placeholder: "0",
                  value: formData.lowStockThreshold,
                  oninput: (e) => formData.lowStockThreshold = parseInt(e.target.value) || 0,
                  min: 0
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
                $$renderer5.push(`<!----></div> <div><label for="variant-image-url" class="me-idqqhv text-foreground">Image URL</label> `);
                Main$1($$renderer5, {
                  id: "variant-image-url",
                  placeholder: "https://example.com/image.jpg",
                  value: formData.imageUrl,
                  oninput: (e) => formData.imageUrl = e.target.value
                });
                $$renderer5.push(`<!----></div></fieldset>`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----> `);
            Main$7($$renderer4, {
              class: "me-bxo9l9",
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
                    $$renderer6.push(`<!---->${escape_html(editingVariant ? "Save Changes" : "Create Variant")}`);
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
