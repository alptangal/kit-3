<script lang="ts">
	// src/lib/components/navigation/team-switcher/TeamSwitcher.svelte
	// TeamSwitcher (shadcn team-switcher) — chọn team/tổ chức, thường đặt trong
	// Sidebar.Header. Dùng DropdownMenu (element) cho mở/đóng + keyboard.
	// value = id team hiện tại (bindable). Phân nhóm theo `group`, checkmark cho
	// team đang chọn, item "Tạo team" ở cuối (oncreate).
	import { styleSynced } from '$modules';
	import { DropdownMenu } from '$components/element';
	import type { TeamSwitcherProps, TeamSwitcherTeam } from './_interface';

	let {
		teams = [],
		value = $bindable(''),
		onselect,
		oncreate,
		createLabel = 'Tạo team',
		'aria-label': ariaLabel,
		trigger,
		content,
		...props
	}: TeamSwitcherProps = $props();

	const current = $derived(teams.find((t) => t.id === value));

	// Nhóm team theo `group` (giữ thứ tự xuất hiện lần đầu).
	const groups = $derived.by(() => {
		const seen = new Map<string, TeamSwitcherTeam[]>();
		for (const t of teams) {
			const key = t.group ?? '';
			if (!seen.has(key)) seen.set(key, []);
			seen.get(key)!.push(t);
		}
		return [...seen.entries()];
	});

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = ['team-switcher'];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});

	function selectTeam(team: TeamSwitcherTeam) {
		if (team.id === value) return;
		onselect?.(team);
		value = team.id;
	}
</script>

<div class={styleDerived} data-team-switcher {...props}>
	<DropdownMenu aria-label={ariaLabel}>
		<DropdownMenu.Trigger>
			{#if trigger}
				{@render trigger()}
			{:else}
				<span class="ts-avatar" aria-hidden="true">{current?.abbr ?? '?'}</span>
				<span class="ts-name">{current?.name ?? 'Chưa chọn team'}</span>
				<span class="ts-chevron" aria-hidden="true">
					<svg viewBox="0 0 24 24" fill="none">
						<path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
					</svg>
				</span>
			{/if}
		</DropdownMenu.Trigger>

		<DropdownMenu.Content>
			{#if content}
				{@render content()}
			{:else}
				{#each groups as g (g[0])}
					{#if g[0]}
						<DropdownMenu.Label>{g[0]}</DropdownMenu.Label>
					{/if}
					{#each g[1] as team (team.id)}
						<DropdownMenu.Item onselect={() => selectTeam(team)}>
							{#snippet leading()}
								<span class="ts-avatar ts-avatar--sm" aria-hidden="true">{team.abbr}</span>
							{/snippet}
							{team.name}
							<!-- snippet trailing PHẢI là trẻ trực tiếp của Item (Svelte 5 không
								 trích xuất snippet làm prop khi nằm trong {#if}) → khai báo luôn,
								 điều kiện active ở trong snippet. Item luôn render .trailing
								 (trống khi chưa active) giữ chỗ cho check, tránh shift layout. -->
							{#snippet trailing()}
								{#if team.id === value}
									<svg viewBox="0 0 24 24" fill="none">
										<path
											d="M20 6 9 17l-5-5"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
									</svg>
								{/if}
							{/snippet}
						</DropdownMenu.Item>
					{/each}
				{/each}

				<DropdownMenu.Separator />
				<DropdownMenu.Item onselect={() => oncreate?.()}>
					{#snippet leading()}
						<svg viewBox="0 0 24 24" fill="none">
							<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
						</svg>
					{/snippet}
					{createLabel}
				</DropdownMenu.Item>
			{/if}
		</DropdownMenu.Content>
	</DropdownMenu>
</div>

<style lang="scss">
	.team-switcher {
		display: inline-flex;
		max-width: 100%;

		// Trigger (nền .dropdown-menu-trigger) — căn nội dung:
		:global(.dropdown-menu-trigger) {
			width: 100%;
			max-width: 100%;
			font-weight: 600;
		}

		.ts-avatar {
			width: 1.5rem;
			height: 1.5rem;
			border-radius: 0.375rem;
			flex-shrink: 0;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			background: var(--content2, hsl(240 4.8% 96%));
			color: var(--foreground);
			font-size: 0.6875rem;
			font-weight: 700;

			&--sm {
				width: 1rem;
				height: 1rem;
				font-size: 0.5625rem;
			}
		}

		.ts-name {
			flex: 1;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.ts-chevron {
			flex-shrink: 0;
			display: inline-flex;
			color: var(--muted, var(--foreground));
			width: 0.75rem;
			height: 0.75rem;
		}

		@media (prefers-color-scheme: dark) {
			.ts-avatar {
				background: hsl(240 5.9% 20%);
			}
		}
	}
</style>
