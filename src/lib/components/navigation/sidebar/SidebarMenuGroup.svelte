<script lang="ts">
	// SidebarMenuGroup — NÚT CHA + submenu đệ quy (lồng không giới hạn cấp).
	// Nút cha (button) có icon + label + chevron; click/Enter → toggle open.
	// Submenu = <ul> inset (border-left + padding). Con = MenuItem (nút lá)
	// hoặc MenuGroup lồng → đệ quy qua context lồng (group cha gần nhất).
	//
	// P2 — search: nhóm là "group cha gần nhất" (setMenuGroupContext lồng) cho
	// các con trực tiếp. Hai derived:
	//   matchCount   = số con (probe) TEXT khớp query → HIỆN group (rỗng → ẩn)
	//   isOpen       = userOpen (click / defaultOpen) HOẶC (đang search + con khớp)
	// Khi sidebar collapsed (icon rail): group luôn đóng, chevron ẩn — consistent
	// với label menu (mở rộng tạm = CSS :hover "peek" của _styles.scss).
	import { SvelteSet } from 'svelte/reactivity';
	import { browser } from '$app/environment';
	import { matchSegments, queryMatchesText, type TextSegment } from '$modules';
	import { client } from '$store/basic.svelte';
	import { Icon } from '$components/element';
	import {
		getSidebarContext,
		setMenuGroupContext,
		getMenuGroupContext,
		collectProbes,
		setActiveSlot
	} from './_context';
	import type { MenuItemProbe, MenuGroupRegistry } from './_context';
	import type { SidebarMenuGroupProps } from './_interface';

	let {
		id,
		'aria-label': ariaLabel,
		label,
		icon,
		badge,
		defaultOpen = false,
		children,
		...props
	}: SidebarMenuGroupProps = $props();

	const ctx = getSidebarContext();

	// i18n: label = string | TranslateContent (fallback en → vi)
	const lang = $derived(client.browser?.language ?? 'en');
	const labelText = $derived.by(() =>
		typeof label === 'string' ? label : label[lang] ?? label.en ?? label.vi ?? ''
	);

	// open nội bộ (user click / defaultOpen); auto-open khi search có con khớp.
	// Yêu cầu 9: persist trạng thái mở qua localStorage key 'sidebar-group-open'
	// (JSON map id→bool) — chỉ khi có prop id (không id → không persist). Load
	// 1 lần lúc init (SSR browser=false → defaultOpen); ghi trong toggle().
	// try/catch: localStorage có thể throw (private mode/disabled).
	const GROUP_OPEN_KEY = 'sidebar-group-open';
	function loadGroupOpenMap(): Record<string, boolean> {
		if (!browser) return {};
		try {
			const raw = localStorage.getItem(GROUP_OPEN_KEY);
			const parsed = raw ? JSON.parse(raw) : null;
			return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {};
		} catch {
			return {};
		}
	}
	function saveGroupOpenValue(gid: string, open: boolean): void {
		if (!browser) return;
		try {
			const map = loadGroupOpenMap();
			map[gid] = open;
			localStorage.setItem(GROUP_OPEN_KEY, JSON.stringify(map));
		} catch {
			// ghi fail (quota/disabled) — bỏ qua, trạng thái vẫn dùng được trong phiên
		}
	}
	const persistedOpen: boolean | undefined = id ? loadGroupOpenMap()[id] : undefined;
	let userOpen = $state(persistedOpen ?? defaultOpen);

	// Con trực tiếp (probe register từ MenuItem / MenuGroup lồng trong submenu).
	// SvelteSet: iterate trong $derived → reactive khi add/delete (source version).
	const childProbes = $state(new SvelteSet<MenuItemProbe>());
	// P3: ĐỌC group cha TRƯỚC setMenuGroupContext — Svelte 5: setContext ghi vào
	// context object của CHÍNH component → getContext gọi sau sẽ trả registry
	// CỦA CHÍNH MÌNH (không phải cha) → selfProbe tự register vào chính nó,
	// group ông không thấy được cây của group con (search đệ quy "cháy" ở cấp 1).
	const parentGroup = getMenuGroupContext();
	// Active tracking: slot cho con ĐIỀN khi MenuButton active (kể cả group đóng
	// — submenu unmount nên :has() không thấy .active). data-active-group gắn
	// trên <li> → CSS chấm mép trái.
	const activeSlot = $state({ current: false });
	setActiveSlot(activeSlot);
	setMenuGroupContext({
		register: (probe: MenuItemProbe) => {
			childProbes.add(probe);
			return () => {
				childProbes.delete(probe);
			};
		}
	} satisfies MenuGroupRegistry);

	const query = $derived((ctx?.searchQuery ?? '').trim());

	// P3: highlight label (engine NFD-token, cùng Select/Input) — segment text
	// theo query, render <mark> quanh phần khớp. query rỗng → [] (hiện label thường).
	const labelSegments = $derived.by((): TextSegment[] =>
		labelText && query ? matchSegments(labelText, query) : []
	);

	// Số con (ĐỀ QUY) text khớp query — P3: engine nhạy dấu (queryMatchesText),
	// đồng bộ Select/Input (không còn plain lowercase includes).
	// collectProbes: ITERATIVE + 1 Set seen dùng chung → dừng chắc chắn (không
	// stack overflow) kể cả probe con lỡ trỏ vòng về. Probe "sống" trong
	// registry (không cần DOM mount) → group KHÉP vẫn biết con (không
	// chicken-and-egg).
	const matchCount = $derived.by(() => {
		if (!query) return 0;
		let n = 0;
		for (const p of collectProbes(childProbes)) {
			if (queryMatchesText(p.matchText, query)) n++;
		}
		return n;
	});

	// Group HIỆN khi: query rỗng (mặc định) HOẶC (label khớp HOẶC con ĐỀ QUY khớp).
	// KHÔNG unmount cả <li> khi query ≠ '' (probe mất → group "chết" không bao
	// giờ hiện lại khi gõ tiếp) → render + CSS ẩn (display:none, cao 0).
	const groupVisible = $derived(!query || queryMatchesText(labelText, query) || matchCount > 0);

	// MỞ khi: userOpen HOẶC (đang search + con khớp → auto-expand)
	const isOpen = $derived(userOpen || (query.length > 0 && matchCount > 0));

	// collapsed (icon rail) → chevron ẩn + submenu ẩn (peek CSS lo phần mở rộng tạm)
	const collapsed = $derived(!!ctx && ctx.collapsed && !ctx.isMobile);

	// SEARCHING: đang có query → submenu luôn MOUNT (hidden khi chưa open) để
	// collect() thấy probe con; con KHÔNG khớp → CSS .hidden (không unmount →
	// probe cấp trên vẫn đếm). Khi query rỗng → mount theo isOpen (return to
	// trạng thái P2 gốc).
	const searching = $derived(query.length > 0);

	// PROBE của CHÍNH group lên group cha gần nhất (SidebarGroup / MenuGroup
	// ông) — defer matchText (label i18n reactive, không capture initial),
	// children() phát lại SvelteSet con trực tiếp → ông gộp ĐỀ QUY qua
	// collectProbes (iterative, không stack overflow).
	// (parentGroup đọc ở đầu script — TRƯỚC setMenuGroupContext, xem comment trên.)
	const selfProbe: MenuItemProbe = {
		get isVisible() {
			return groupVisible;
		},
		get matchText() {
			return labelText;
		},
		children: () => childProbes
	};
	$effect(() => {
		const dereg = parentGroup?.register(selfProbe);
		return () => dereg?.();
	});

	function toggle() {
		userOpen = !userOpen;
		// Yêu cầu 9: persist theo id group (không id → bỏ qua).
		if (id) saveGroupOpenValue(id, userOpen);
	}
</script>

<!-- P3: KHÔNG {#if groupVisible} — unmount <li> sẽ GIẾT probe của chính group
     (và toàn cây con) → gõ query khác không bao giờ hiện lại (chicken-and-egg).
     Ẩn bằng class .sb-hidden (CSS display:none) khi không khớp. -->
<li
	class="sidebar-menu-group"
	class:open={isOpen}
	class:sb-hidden={!groupVisible}
	class:active-group={activeSlot.current}
	data-sb-group-id={id}
>
		<button
			type="button"
			class="sidebar-menu-group__trigger"
			aria-expanded={isOpen && !collapsed}
			aria-label={ariaLabel ?? labelText}
			aria-controls={id ? `sb-submenu-${id}` : undefined}
			onclick={toggle}
		>
			{#if icon}
				<span class="sidebar-menu-group__icon" aria-hidden="true">
					<Icon icon={icon} />
				</span>
			{/if}
			<span class="sidebar-menu-group__label">
				{#if labelSegments.length > 0}
					{#each labelSegments as seg}
						{#if seg.isMatch}
							<mark class="sidebar-menu-group__highlight">{seg.text}</mark>
						{:else}
							{seg.text}
						{/if}
					{/each}
				{:else}
					{labelText}
				{/if}
			</span>
			{#if badge}
				<span class="sidebar-menu-group__badge">{@render badge()}</span>
			{/if}
			{#if !collapsed}
				<svg
					class="sidebar-menu-group__chevron"
					viewBox="0 0 16 16"
					fill="none"
					aria-hidden="true"
				>
					<path
						d="m6 4 4 4-4 4"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			{/if}
		</button>

		<!-- P3: mount <ul> khi (searching HOẶC open) && !collapsed. SEARCHING phải
		     mount DÙ chưa open để con register probe → matchCount mới tính được
		     (không chicken-and-egg). Chưa open → ẩn bằng .sb-hidden (display:none),
		     KHÔNG unmount. Query rỗng + không open → unmount (trạng thái P2 gốc). -->
		{#if !collapsed && (searching || isOpen)}
			<ul
				id={id ? `sb-submenu-${id}` : undefined}
				class="sidebar-menu-group__submenu"
				class:sb-hidden={searching && !isOpen}
				role="group"
				aria-label={ariaLabel ?? labelText}
			>
				{@render children?.()}
			</ul>
		{/if}
	</li>

<style lang="scss">
	/* Nút cha — mirror .sidebar-menu-button (font/padding/active) + chevron trailing.
	   Yêu cầu 9: nhãn group hiện dạng UPPERCASE muted (thay SidebarGroupLabel
	   uppercase bị bỏ khi đổi từ Sidebar.Group sang MenuGroup accordion). */
	.sidebar-menu-group__trigger {
		display: inline-flex;
		align-items: center;
		gap: 0.625rem;
		min-height: 2.25rem;
		width: 100%;
		padding: 0.375rem 0.75rem;
		border-radius: var(--border-radius-sm, 0.375rem);
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.025em;
		text-transform: uppercase;
		color: var(--muted, var(--foreground));
		text-decoration: none;
		cursor: var(--cursor-interactive);
		background: transparent;
		border: 0;
		text-align: left;
		transition: background-color var(--transition-duration, 150ms) ease;

		@media (hover: hover) and (pointer: fine) {
			&:hover {
				background: var(--content2, hsl(240 4.8% 96%));
			}
		}

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500, var(--focus, hsl(243 75% 59%)));
			outline-offset: 2px;
		}
	}

	.sidebar-menu-group__icon {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		width: 1.125rem;
		height: 1.125rem;
		font-size: 1.125rem; /* iconify: svg inline 1em → căn qua font-size cha */
		color: var(--muted, var(--foreground));
	}

	.sidebar-menu-group__label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* P3: Ẩn (KHÔNG unmount) khi không con khớp search — probe con vẫn sống.
	   class .sb-hidden gắn TRỰC TIẾP trên <li class="sidebar-menu-group"> nên
	   selector phải là .sidebar-menu-group.sb-hidden (top-level, KHÔNG "&"). */
	.sidebar-menu-group.sb-hidden {
		display: none;
	}

	/* li.sidebar-menu-group nằm TRỰC TIẾP trong div.sidebar-content (không ul
	   cha) → display:list-item mặc định sinh ::marker "•" trước label — chỉ ló
	   trên mobile (aside fixed, không bị clip như desktop). Kill marker. */
	.sidebar-menu-group {
		list-style: none;
	}

	/* Batch 11 (yêu cầu 3): BỎ chấm active trên label group (::before 6px ở mép
	   trái) — user không muốn dot trước content khi group active. Giữ
	   active-group class (JS context vẫn điền, vô hại); vệt active trên item lá
	   (SidebarMenuButton) giữ nguyên. */
	.sidebar-menu-group__trigger {
		position: relative;
	}

	/* Active indicator kiểu Nuxt UI: vệt primary trên item lá (.active::before,
	   SidebarMenuButton) dịch sang left:-0.5rem để đè ĐÚNG đường guide của
	   submenu (padding-left 0.875rem − guide left 0.375rem = 0.5rem). Hash scoping
	   bám vào .sidebar-menu-group__submenu (class của component này) — phần
	   :global() chỉ bọc button + ::before (bẫy: :global() cuối selector → Svelte
	   bỏ hash, rule lộ toàn app). */
	.sidebar-menu-group__submenu :global(.sidebar-menu-button.active::before) {
		left: -0.5rem;
	}

	.sidebar-menu-group__submenu.sb-hidden {
		display: none;
	}

	/* P3: highlight search — mirror .select-option__highlight (primary/600, nền
	   trong suốt). render <mark> scoped (hash MenuGroup) nên dùng :global không
	   cần — mark đứng TRỰC TIẾP trong label span (cùng hash). */
	.sidebar-menu-group__highlight {
		color: var(--primary, var(--color-indigo-500, hsl(243 75% 59%)));
		font-weight: 600;
		background: transparent;
	}

	.sidebar-menu-group__badge {
		flex-shrink: 0;
	}

	.sidebar-menu-group__chevron {
		flex-shrink: 0;
		width: 0.875rem;
		height: 0.875rem;
		color: var(--muted, var(--foreground));
		transition: transform var(--transition-duration, 150ms) ease;
	}

	.open > .sidebar-menu-group__trigger .sidebar-menu-group__chevron {
		transform: rotate(90deg);
	}

	/* Submenu inset: border-left + padding (mô hình shadcn sidebar-07) */
	.sidebar-menu-group__submenu {
		list-style: none;
		margin: 0.125rem 0 0.25rem;
		padding: 0 0 0 0.875rem;
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;

		&::before {
			/* vệt guide trái (inset) */
			content: '';
			position: absolute;
			top: 0.125rem;
			bottom: 0.125rem;
			left: 0.375rem;
			width: 1px;
			background: var(--border, hsl(0 0% 88%));
		}
	}

	@media (prefers-color-scheme: dark) {
		.sidebar-menu-group__submenu::before {
			background: var(--border, hsl(0 0% 24%));
		}
	}
</style>
