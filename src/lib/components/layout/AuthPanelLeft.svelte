<script lang="ts">
	// src/lib/components/layout/AuthPanelLeft.svelte
	// Decorative left panel shared by Login & Register pages.
	// Background (orbs, grid) stays fixed during route transitions.
	// Only content (logo, headline, description, features) cross-fades.
	import type { Snippet } from 'svelte';

	interface Props {
		/** Optional class to apply to the outer panel element */
		class?: string;
		/** Slot for brand logo SVG (has high-fidelity default) */
		logo?: Snippet;
		/** Large headline text */
		headline?: string | Snippet;
		/** Subtext below headline */
		description?: string | Snippet;
		/** Feature bullet list items: array of strings or custom Snippet */
		features?: string[] | Snippet;
	}

	let { class: className = '', logo, headline, description, features }: Props = $props();
</script>

<div class="auth-panel-left {className}" aria-hidden="true">
	<!-- ════ BACKGROUND: Fixed during route transitions ════ -->
	<!-- Orbs, gradient, grid - NO view-transition-name = no cross-fade -->
	<div class="auth-panel-bg">
		<!-- Animated gradient orbs -->
		<div class="orb orb-1"></div>
		<div class="orb orb-2"></div>
		<div class="orb orb-3"></div>
		<!-- Dot grid overlay -->
		<div class="grid-overlay"></div>
	</div>

	<!-- ════ CONTENT: Cross-fades during route transitions ════ -->
	<div class="panel-content" style="view-transition-name: auth-panel-content;">
		<div class="brand-logo" style="view-transition-name: auth-panel-logo;">
			{#if logo}
				{@render logo()}
			{:else}
				<svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
					<circle cx="28" cy="28" r="26" fill="url(#panel-logo-grad)" />
					<path
						d="M20 28c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8"
						stroke="#fff"
						stroke-width="3"
						stroke-linecap="round"
					/>
					<circle cx="28" cy="28" r="3.5" fill="#fff" />
					<defs>
						<linearGradient id="panel-logo-grad" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
							<stop stop-color="#818cf8" />
							<stop offset="1" stop-color="#a78bfa" />
						</linearGradient>
					</defs>
				</svg>
			{/if}
		</div>

		{#if headline || description}
			<div class="panel-text" style="view-transition-name: auth-panel-text;">
				{#if typeof headline === 'string'}
					<h2 class="panel-headline">{headline}</h2>
				{:else if headline}
					<h2 class="panel-headline">{@render headline()}</h2>
				{/if}

				{#if typeof description === 'string'}
					<p class="panel-desc">{description}</p>
				{:else if description}
					<p class="panel-desc">{@render description()}</p>
				{/if}
			</div>
		{/if}

		{#if features}
			<ul class="panel-features" style="view-transition-name: auth-panel-features;">
				{#if Array.isArray(features)}
					{#each features as feat}
						<li>
							<span class="feature-icon">✦</span>
							<span>{feat}</span>
						</li>
					{/each}
				{:else}
					{@render features()}
				{/if}
			</ul>
		{/if}
	</div>
</div>

<style lang="scss">
	/* ═══════════════════════════════════════════════════════════
	   AUTH PANEL LEFT — SPLIT BACKGROUND / CONTENT
	   Background (orbs, grid) stays fixed; content cross-fades
	   ═══════════════════════════════════════════════════════════ */

	.auth-panel-left {
		position: relative;
		flex: 0 0 45%;
		display: none;
		overflow: hidden;
		background: linear-gradient(135deg, #0f0c29 0%, #1a1040 40%, #24243e 100%);

		@media (min-width: 900px) {
			display: flex;
			flex-direction: column;
			justify-content: center;
			align-items: center;
		}
	}

	/* ══ Background layer — NO transition ══ */
	.auth-panel-bg {
		position: absolute;
		inset: 0;
		z-index: 0;
		/* No view-transition-name = browser treats as same element across routes */
		will-change: transform; /* Optimize orb animations */
	}

	/* Animated gradient orbs */
	.orb {
		position: absolute;
		border-radius: 50%;
		filter: blur(80px);
		opacity: 0.5;
		animation: float 8s ease-in-out infinite;
	}
	.orb-1 {
		width: 420px;
		height: 420px;
		background: radial-gradient(circle, #6366f1 0%, transparent 70%);
		top: -80px;
		left: -100px;
		animation-delay: 0s;
	}
	.orb-2 {
		width: 350px;
		height: 350px;
		background: radial-gradient(circle, #8b5cf6 0%, transparent 70%);
		bottom: -60px;
		right: -60px;
		animation-delay: -3s;
	}
	.orb-3 {
		width: 250px;
		height: 250px;
		background: radial-gradient(circle, #06b6d4 0%, transparent 70%);
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		opacity: 0.25;
		animation-delay: -6s;
	}

	@keyframes float {
		0%, 100% { transform: translate(0, 0) scale(1); }
		33% { transform: translate(20px, -30px) scale(1.04); }
		66% { transform: translate(-15px, 20px) scale(0.96); }
	}

	/* Dot grid overlay */
	.grid-overlay {
		position: absolute;
		inset: 0;
		background-image: radial-gradient(circle, rgba(255 255 255 / 0.07) 1px, transparent 1px);
		background-size: 28px 28px;
		pointer-events: none;
	}

	/* ══ Content layer — HAS transition ══ */
	.panel-content {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 2rem;
		padding: 3rem;
		max-width: 420px;
	}

	.brand-logo :global(svg) {
		width: 56px;
		height: 56px;
		filter: drop-shadow(0 8px 24px rgba(99, 102, 241, 0.45));
	}

	.panel-text {
		display: flex;
		flex-direction: column;
	}

	.panel-headline {
		font-size: 2.25rem;
		font-weight: 700;
		line-height: 1.15;
		color: #ffffff;
		letter-spacing: -0.02em;
		margin: 0;
	}

	.panel-desc {
		font-size: 0.95rem;
		color: rgba(255, 255, 255, 0.65);
		line-height: 1.6;
		margin: 0.5rem 0 0;
	}

	.panel-features {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.875rem;

		li {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			color: rgba(255, 255, 255, 0.85);
			font-size: 0.9rem;
		}
	}

	.feature-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background: linear-gradient(135deg, #6366f1, #8b5cf6);
		border-radius: 6px;
		font-size: 0.6rem;
		flex-shrink: 0;
		box-shadow: 0 2px 8px rgb(99 102 241 / 0.4);
	}
</style>