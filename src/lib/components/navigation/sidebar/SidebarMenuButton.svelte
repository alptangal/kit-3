<script lang="ts">
	// SidebarMenuButton — nút menu (li/a hoặc button). href → <a> SPA; active →
	// aria-current="page" + class .active. leading/trailing/badge qua slot.
	// P2: icon (iconify) — fallback khi không có slot leading. description —
	// Tooltip khi hover (chỉ desktop + sidebar mở đủ rộng: !isMobile && !collapsed).
	import { styleSynced, matchSegments, type TextSegment } from '$modules';
	import { client } from '$store/basic.svelte';
	import { Icon, Tooltip } from '$components/element';
	import { getSidebarContext } from './_context';
	import type { SidebarMenuButtonProps } from './_interface';

	let {
		href,
		active = false,
		disabled = false,
		label,
		icon,
		description,
		badge,
		leading,
		trailing,
		children,
		...props
	}: SidebarMenuButtonProps = $props();

	const ctx = getSidebarContext();
	const lang = $derived(client.browser?.language ?? 'en');
	const descriptionText = $derived.by(() =>
		description == null
			? ''
			: typeof description === 'string'
				? description
				: description[lang] ?? description.en ?? description.vi ?? ''
	);
	// P3: text label (i18n) — dùng cho highlight search (matchSegments).
	const labelText = $derived.by(() =>
		label == null
			? ''
			: typeof label === 'string'
				? label
				: label[lang] ?? label.en ?? label.vi ?? ''
	);
	// P3: highlight search — segment text theo query (match không đổi = dùng
	// children snippet; có match → render <mark> quanh phần khớp).
	const searchQuery = $derived((ctx?.searchQuery ?? '').trim());
	const labelSegments = $derived.by((): TextSegment[] =>
		labelText && searchQuery ? matchSegments(labelText, searchQuery) : []
	);

	const isLink = $derived(!!href && !disabled);

	// Tooltip chỉ khi: có description + desktop + sidebar RỘNG (không icon rail).
	// Collapsed: peek (CSS :hover) đã hiện label → tooltip thừa. Mobile: offcanvas
	// hiện full menu → không cần tooltip.
	const showTooltip = $derived(
		!!descriptionText && !!ctx && !ctx.isMobile && !ctx.collapsed
	);

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'sidebar-menu-button',
			active ? 'active' : undefined,
			disabled ? 'disabled' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});

	// Rest attributes forward xuống element (pattern Button/Main.svelte restAttrs) —
	// data-test/aria-*/title/id nếu không forward thì không bao giờ xuống DOM
	// (probe không tìm thấy locator; bẫy Tabs.Root forward đã gặp ở B5).
	const restAttrs = $derived.by(() => {
		const out: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(props)) {
			if (value === undefined) continue;
			if (
				key === 'onclick' || // handler action (vd logout — item không href)
				key === 'data-test' ||
				key.startsWith('data-') ||
				key.startsWith('aria-') ||
				key === 'title' ||
				key === 'id'
			) {
				out[key] = value;
			}
		}
		return out;
	});
</script>

<!-- P3: nội dung label — có prop label + đang search → highlight <mark> các
     segment khớp (engine NFD-token, cùng Select/Input); không thì slot children.
     Snippet TRỰC TIẾP con của component (bẫy Svelte 5: không bọc trong {#if}). -->
{#snippet labelContent()}
	{#if labelSegments.length > 0}
		{#each labelSegments as seg}
			{#if seg.isMatch}
				<mark class="sidebar-menu-button__highlight">{seg.text}</mark>
			{:else}
				{seg.text}
			{/if}
		{/each}
	{:else if children}
		{@render children()}
	{:else if labelText}
		{labelText}
	{/if}
{/snippet}

<!-- Nút (a hoặc button) — snippet render để dùng chung cho bọc Tooltip / không bọc.
     Snippet TRỰC TIẾP con của component (bẫy Svelte 5: không bọc trong {#if}). -->
{#snippet menuButton()}
	{#if isLink}
		<a class={styleDerived} {href} {...restAttrs} aria-current={active ? 'page' : undefined}>
			{#if leading}
				<span class="leading" aria-hidden="true">{@render leading()}</span>
			{:else if icon}
				<span class="leading" aria-hidden="true"><Icon icon={icon} /></span>
			{/if}
			<span class="label">{@render labelContent()}</span>
			{#if trailing || badge}
				<span class="trailing">
					{#if trailing}
						{@render trailing()}
					{/if}
					{#if badge}
						{@render badge()}
					{/if}
				</span>
			{/if}
		</a>
	{:else}
		<button
			class={styleDerived}
			type="button"
			{disabled}
			{...restAttrs}
			aria-current={active ? 'page' : undefined}
		>
			{#if leading}
				<span class="leading" aria-hidden="true">{@render leading()}</span>
			{:else if icon}
				<span class="leading" aria-hidden="true"><Icon icon={icon} /></span>
			{/if}
			<span class="label">{@render labelContent()}</span>
			{#if trailing || badge}
				<span class="trailing">
					{#if trailing}
						{@render trailing()}
					{/if}
					{#if badge}
						{@render badge()}
					{/if}
				</span>
			{/if}
		</button>
	{/if}
{/snippet}

{#if showTooltip}
	<!-- Trigger (liên kết/nút) đứng TRƯỚC Content — Content append vào body,
	     anchor = firstElementChild của root Tooltip (precedent Breadcrumb P2). -->
	<Tooltip>
		{@render menuButton()}
		<Tooltip.Content>{descriptionText}</Tooltip.Content>
	</Tooltip>
{:else}
	{@render menuButton()}
{/if}

<style lang="scss">
	// Nút menu — scoped (a hoặc button cùng hash của SidebarMenuButton).
	.sidebar-menu-button {
		display: inline-flex;
		align-items: center;
		gap: 0.625rem;
		min-height: 2.25rem;
		width: 100%;
		padding: 0.375rem 0.75rem;
		border-radius: var(--border-radius-sm, 0.375rem);
		font-size: 0.875rem;
		color: var(--content2-foreground, var(--foreground));
		text-decoration: none;
		cursor: var(--cursor-interactive);
		background: transparent;
		border: 0;
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

		.leading {
			flex-shrink: 0;
			display: inline-flex;
			align-items: center;
			width: 1.125rem;
			height: 1.125rem;
			font-size: 1.125rem; /* iconify: svg inline 1em → control bằng font-size cha */
			color: var(--muted, var(--foreground));
		}

		.label {
			flex: 1;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			text-align: left;
		}

		/* P3: highlight search — mirror .select-option__highlight (primary/600,
		   nền trong suốt để không phá active/hover state của button). */
		.sidebar-menu-button__highlight {
			color: var(--primary, var(--color-indigo-500, hsl(243 75% 59%)));
			font-weight: 600;
			background: transparent;
		}

		.trailing {
			flex-shrink: 0;
			display: inline-flex;
			align-items: center;
			gap: 0.375rem;
		}

		&.active {
			background: var(--content2, hsl(240 4.8% 96%));
			// Active đánh dấu cả LABEL + viền trái (yêu cầu 4a — trước chỉ icon).
			// box-shadow inset: không đổi layout/padding như border-left thật.
			box-shadow: inset 3px 0 0 0 var(--primary, var(--color-indigo-500, hsl(243 75% 59%)));

			.leading,
			.label {
				color: var(--primary, var(--color-indigo-500, hsl(243 75% 59%)));
			}
		}

		&.disabled {
			opacity: var(--disabled-opacity, 0.5);
			cursor: var(--cursor-disabled);
			pointer-events: none;
		}
	}
</style>
