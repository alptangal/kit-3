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
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		padding: 2.5rem 1.5rem;
		background: var(--background, #09090b);
		position: relative;
		overflow-y: auto;
		overflow-x: hidden;
		height: 100dvh;
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

		/* Mobile optimization */
		@media (max-width: 768px) {
			padding: 1.5rem 1rem;
		}

		@media (max-width: 480px) {
			padding: 1rem 0.875rem;
		}

		/* Landscape mobile optimization */
		@media (max-height: 600px) and (orientation: landscape) {
			justify-content: center;
			padding-block: 0.75rem;
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
		margin-block: auto;
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

		/* Mobile optimization */
		@media (max-width: 480px) {
			gap: 1rem;
			padding: 0.75rem 0;
		}

		/* Landscape mobile optimization */
		@media (max-height: 600px) and (orientation: landscape) {
			gap: 0.875rem;
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
		flex-shrink: 0;

		/* View transition for entire header group - prevents flickering */
		view-transition-name: auth-header;
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
		letter-spacing: -0.025em;
		color: var(--foreground, #0f172a);
		margin: 0;

		@media (max-width: 480px) {
			font-size: 1.35rem;
		}
	}

	.auth-subtitle {
		font-size: 0.875rem;
		color: var(--foreground-400, #64748b);
		margin: 0;

		@media (max-width: 480px) {
			font-size: 0.8125rem;
		}
	}

	@media (prefers-color-scheme: dark) {
		.auth-title {
			color: #f8fafc;
		}
		.auth-subtitle {
			color: #94a3b8;
		}
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
		margin-bottom: 0.5rem;
		word-wrap: break-word;
		overflow-wrap: break-word;

		.alert-icon {
			flex-shrink: 0;
			margin-top: 0.1rem;
			width: 1.1rem;
			height: 1.1rem;
		}

		&--success {
			background: rgb(34 197 94 / 0.1);
			color: #16a34a;
			border: 1px solid rgb(34 197 94 / 0.25);
		}
		&--error {
			background: rgb(239 68 68 / 0.08);
			color: #dc2626;
			border: 1px solid rgb(239 68 68 / 0.25);
			animation: shake 0.4s ease-in-out;
		}

		/* Mobile: better text handling */
		@media (max-width: 480px) {
			padding: 0.625rem 0.875rem;
			font-size: 0.8125rem;
			gap: 0.5rem;
		}
	}

	@keyframes shake {
		0%, 100% { transform: translateX(0); }
		20%, 60% { transform: translateX(-5px); }
		40%, 80% { transform: translateX(5px); }
	}

	/* ══ Layout Structure ══ */
	:global(.form-root) {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
	}

	:global(.textField-root) {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		width: 100%;
	}

	:global(.auth-input-wrapper) {
		position: relative;
		width: 100%;

		:global(.auth-input-icon) {
			position: absolute;
			left: 0.875rem;
			top: 50%;
			transform: translateY(-50%);
			width: 1.125rem;
			height: 1.125rem;
			color: #94a3b8;
			pointer-events: none;
			z-index: 2;
			transition: color 0.2s;
		}

		/* Sync icon color with input validation state.
		   DÙNG general-sibling combinator `~` (KHÔNG phải `:has()`): icon
		   `.auth-input-icon` là sibling ĐỨNG SAU `.input-root` trong DOM
		   (markup đã sắp icon sau <Input> — icon position:absolute nên thứ
		   tự DOM không đổi vị trí hiển thị). `~` được hỗ trợ mọi browser
		   (kể cả Safari 15, target es2020) → đồng bộ màu icon theo
		   validation state mà không cần `:has()` (Safari 15 chưa support). */
		:global(.input-root.color-error) ~ :global(.auth-input-icon) {
			color: #dc2626 !important;
		}

		:global(.input-root.color-success) ~ :global(.auth-input-icon) {
			color: #16a34a !important;
		}
	}

	:global(.auth-input) {
		:global(.input-highlight-wrapper) {
			padding-left: 2.5rem !important;
		}
	}

	:global(.auth-actions) {
		display: flex;
		gap: 0.75rem;
		margin-top: 0.5rem;
		align-items: center !important;

		:global(.auth-btn-submit) {
			flex: 1 !important;
			height: 2.5rem !important;
			min-height: 2.5rem !important;
		}

		:global(.auth-btn-reset) {
			height: 2.5rem !important;
			min-height: 2.5rem !important;
			padding: 0.5rem 1rem !important;
			line-height: 1 !important;
			display: flex !important;
			align-items: center !important;
		}
	}

	:global(.auth-divider) {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-top: 0.5rem;

		&::before,
		&::after {
			content: '';
			flex: 1;
			height: 1px;
			background: var(--border, rgba(148, 163, 184, 0.2));
		}
	}

	:global(.auth-switch-link) {
		display: flex;
		margin-top: 0.5rem;
		width: 100%;

		:global(.auth-switch-btn) {
			display: flex !important;
			align-items: center !important;
			justify-content: center !important;
			gap: 0.35rem !important;
			height: 2.5rem !important;
			min-height: 2.5rem !important;
			max-height: 2.5rem !important;
			line-height: 1 !important;
			padding-inline: 1rem !important;
			width: 100% !important;
			flex: 1 !important;

			// Use :deep() to penetrate scoped component styles
			:deep(.button-render) {
				width: 100% !important;
				flex: 1 !important;
				flex-grow: 1 !important;
				flex-basis: 0 !important;
			}
		}
	}

	

</style>
