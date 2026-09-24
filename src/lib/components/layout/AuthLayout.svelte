<script lang="ts">
	// src/lib/components/layout/AuthLayout.svelte
	// Reusable, responsive authentication shell for Login, Register, Forgot Password, etc.
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import AuthPanelLeft from './AuthPanelLeft.svelte';

	interface Props {
		/** Additional CSS class for the outermost container */
		class?: string;
		/** Card width constraint: 'md' (420px max) or 'lg' (480px max) */
		cardSize?: 'md' | 'lg';
		/** Small card header title */
		title?: string;
		/** Small card header subtitle */
		subtitle?: string;
		/** Left decorative panel headline */
		headline?: string | Snippet;
		/** Left decorative panel description */
		description?: string | Snippet;
		/** Left decorative panel features list */
		features?: string[] | Snippet;
		/** Error message to show in alert box */
		formError?: string;
		/** Success message to show in alert box */
		successMessage?: string;
		/** Custom brand logo for the left panel */
		leftLogo?: Snippet;
		/** Custom header content override */
		header?: Snippet;
		/** Footer slot (e.g. "Don't have an account? Sign up") */
		footer?: Snippet;
		/** Form body content */
		children: Snippet;
	}

	let {
		class: className = '',
		cardSize = 'md',
		title,
		subtitle,
		headline,
		description,
		features,
		formError,
		successMessage,
		leftLogo,
		header,
		footer,
		children
	}: Props = $props();
</script>

<div class="auth-page {className}">
	<!-- ════ Left Panel: Decorative ════ -->
	<AuthPanelLeft
		logo={leftLogo}
		{headline}
		{description}
		{features}
	/>

	<!-- ════ Right Panel: Form ════ -->
	<div class="auth-panel-right">
		<div class="auth-card {cardSize === 'lg' ? 'auth-card--lg' : ''}" style="view-transition-name: auth-card;">
			<!-- Card Header -->
			{#if header}
				{@render header()}
			{:else if title || subtitle}
				<div class="auth-header" style="view-transition-name: auth-header;">
					<div class="auth-logo-sm">
						<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
							<circle cx="20" cy="20" r="18" fill="url(#auth-sm-grad)" />
							<path
								d="M14 20c0-3.314 2.686-6 6-6s6 2.686 6 6-2.686 6-6 6"
								stroke="#fff"
								stroke-width="2.5"
								stroke-linecap="round"
							/>
							<circle cx="20" cy="20" r="2.5" fill="#fff" />
							<defs>
								<linearGradient id="auth-sm-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
									<stop stop-color="#6366f1" />
									<stop offset="1" stop-color="#8b5cf6" />
								</linearGradient>
							</defs>
						</svg>
					</div>
					{#if title}
						<h1 class="auth-title">{title}</h1>
					{/if}
					{#if subtitle}
						<p class="auth-subtitle">{subtitle}</p>
					{/if}
				</div>
			{/if}

			<!-- Success Alert -->
			{#if successMessage}
				<div class="auth-alert auth-alert--success" role="alert" aria-live="polite">
					<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="alert-icon">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
							clip-rule="evenodd"
						/>
					</svg>
					<span>{successMessage}</span>
				</div>
			{/if}

			<!-- Error Alert -->
			{#if formError}
				<div class="auth-alert auth-alert--error" role="alert" aria-live="assertive" aria-atomic="true">
					<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="alert-icon">
						<path
							fill-rule="evenodd"
							d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
							clip-rule="evenodd"
						/>
					</svg>
					<span>{formError}</span>
				</div>
			{/if}

			<!-- Children: Form content -->
			{@render children()}

			<!-- Footer: Switch link / divider -->
			{#if footer}
				{@render footer()}
			{/if}
		</div>
	</div>
</div>

<style lang="scss">
	/* ═══════════════════════════════════════════════
	   AUTH LAYOUT — UNIFIED PREMIUM SHELL
	   ═══════════════════════════════════════════════ */

	.auth-page {
		display: flex;
		min-height: 100dvh;
		width: 100%;
		font-family: 'Inter', system-ui, sans-serif;
		overflow: hidden;
	}

	/* ══ Right Form Panel ══ */
	.auth-panel-right {
		flex: 1 1 55%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1.5rem;
		background: var(--background, #09090b);
		position: relative;
		overflow-y: auto;
		overflow-x: hidden;
		max-height: 100dvh;

		&::before {
			content: '';
			position: absolute;
			inset: 0;
			background-image:
				radial-gradient(circle at 20% 80%, rgb(99 102 241 / 0.06) 0%, transparent 50%),
				radial-gradient(circle at 80% 20%, rgb(139 92 246 / 0.05) 0%, transparent 50%);
			pointer-events: none;
		}
	}

	/* ══ Card ══ */
	.auth-card {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 420px;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 1rem 0;

		/* Entrance animation using @starting-style (works with View Transitions) */
		@starting-style {
			opacity: 0;
			transform: translateY(20px);
		}
		transition: opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1), transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);

		/* Ensure smooth cross-fade during view transitions */
		view-transition-name: auth-card;

		&--lg {
			max-width: 480px;
		}
	}

	/* ══ Card Header ══ */
	.auth-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		margin-bottom: 0.25rem;
		text-align: center;

		/* View transition for entire header group - prevents flickering */
		view-transition-name: auth-header;
	}

	/* ══ Card Header ══ */
	.auth-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		margin-bottom: 0.25rem;
		text-align: center;
	}

	.auth-logo-sm svg {
		width: 44px;
		height: 44px;
		filter: drop-shadow(0 4px 16px rgb(99 102 241 / 0.4));
		margin-bottom: 0.25rem;
	}

	.auth-title {
		font-size: 1.75rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--foreground, #f4f4f5);
		margin: 0;
	}

	.auth-subtitle {
		font-size: 0.85rem;
		color: var(--foreground-400, #71717a);
		margin: 0;
	}

	/* ══ Alert Banners ══ */
	.auth-alert {
		display: flex;
		align-items: flex-start;
		gap: 0.625rem;
		border-radius: 0.75rem;
		padding: 0.75rem 1rem;
		font-size: 0.875rem;
		line-height: 1.5;

		.alert-icon {
			flex-shrink: 0;
			margin-top: 0.1rem;
			width: 1.1rem;
			height: 1.1rem;
		}

		&--success {
			background: rgb(34 197 94 / 0.1);
			color: #4ade80;
			border: 1px solid rgb(34 197 94 / 0.2);
		}
		&--error {
			background: rgb(239 68 68 / 0.08);
			color: #f87171;
			border: 1px solid rgb(239 68 68 / 0.2);
			animation: shake 0.4s ease-in-out;
		}
	}

	@keyframes shake {
		0%, 100% { transform: translateX(0); }
		20%, 60% { transform: translateX(-5px); }
		40%, 80% { transform: translateX(5px); }
	}

	/* ══ Shared Global Form Elements inside AuthLayout ══ */
	:global(.auth-input-wrapper) {
		position: relative;
		width: 100%;

		:global(.auth-input-icon) {
			position: absolute;
			left: 0.875rem;
			top: 50%;
			transform: translateY(-50%);
			width: 1rem;
			height: 1rem;
			color: var(--foreground-400, #71717a);
			pointer-events: none;
			z-index: 2;
		}
	}

	:global(.auth-input) {
		/* Padding cho icon trái — áp dụng lên highlight-wrapper (flex item), KHÔNG phải flex container */
		:global(.input-highlight-wrapper) {
			padding-left: 2.5rem !important;
		}
		transition: border-color 0.2s, box-shadow 0.2s !important;
	}

	:global(.auth-actions) {
		display: flex;
		gap: 0.625rem;
		margin-top: 0.25rem;

		:global(.auth-btn-submit) {
			flex: 1 !important;
			font-weight: 600 !important;
			letter-spacing: 0.01em;
		}
		:global(.auth-btn-reset) {
			font-weight: 500 !important;
		}
	}

	:global(.auth-divider) {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.75rem;
		color: var(--foreground-400, #52525b);
		margin-top: 0.25rem;

		&::before,
		&::after {
			content: '';
			flex: 1;
			height: 1px;
			background: var(--border, rgb(255 255 255 / 0.08));
		}
	}

	:global(.auth-switch-link) {
		display: flex;
		justify-content: center;
		margin-top: -0.25rem;

		:global(.auth-switch-btn) {
			display: inline-flex !important;
			align-items: center !important;
			gap: 0.35rem !important;
			font-weight: 500 !important;
			font-size: 0.875rem !important;
			transition: gap 0.2s !important;

			&:hover :global(.link-arrow) {
				transform: translateX(3px);
			}
		}

		:global(.link-arrow) {
			width: 1rem;
			height: 1rem;
			transition: transform 0.2s;
		}
	}
</style>
