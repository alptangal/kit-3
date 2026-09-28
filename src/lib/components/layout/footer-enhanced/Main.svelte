<script lang="ts">
	import type { BasicProps } from '$components/interface';
	import type { ToastConfigs, ToastProps } from '$components/element/tooltip/_interface';

	export interface FooterProps extends BasicProps {
		companyName?: string;
		year?: number;
		copyrightText?: string;
		showPoweredBy?: boolean;
		toastConfigs?: {
			color?: string;
			size?: string;
		};
	}

	export interface FooterConfigs extends BasicProps {
		companyName: string;
		year: number;
		copyrightText: string;
		showPoweredBy: boolean;
	}
</script>

<nav class="footer" role="contentinfo">
	<div class="footer__container">
		{#if configs.companyName}
			<div class="footer__brand">{@html configs.companyName}</div>
		{/if}
		<div class="footer__links">
			<a href="#" class="footer__link">Trang chính</a>
			<a href="#" class="footer__link">Giới thiệu</a>
			<a href="#" class="footer__link">Hỗ trợ</a>
			<a href="#" class="footer__link">Liên hệ</a>
		</div>
		<div class="footer__copyright">
			<p>
				{@if configs.showPoweredBy}
					© {#if configs.year}{configs.year}{/if} {configs.companyName || 'Công ty'}
				{:else}
					© {#if configs.year}{configs.year}{/if} All rights reserved
				{/if}
			</p>
		</div>
		{#if configs.toastConfigs}
			<div
				class="footer__toast-trigger"
				role="button"
				aria-label="Show toast notification"
				onclick={() => {}}
			>
				<span class="footer__toast-icon">ℹ️</span>
			</div>
		{/if}
	</div>
</nav>

<style lang="scss">
	.footer {
		background: var(--background);
		border-top: var(--border-width) solid var(--border, rgb(255 255 255 / 0.08));
		padding: var(--padding-xl) var(--padding-md);
		width: 100%;
		color: var(--foreground-400);
		font-size: var(--font-size-xs);

		&__container {
			max-width: 120rem;
			margin: 0 auto;
			display: flex;
			flex-wrap: wrap;
			justify-content: space-between;
			gap: var(--gap-md);
		}

		&__brand {
			font-size: var(--font-size-sm);
			font-weight: 500;
			color: var(--foreground);
			margin-bottom: var(--gap-sm);
		}

		&__links {
			display: flex;
			gap: var(--gap-md);
			flex-wrap: wrap;
			margin-bottom: var(--gap-sm);

			&__link {
				color: var(--foreground-400);
				text-decoration: none;
				transition: color 0.2s;
				&:hover {
					color: var(--foreground);
				}
			}
		}

		&__copyright {
			margin-top: var(--padding-md);
			border-top: var(--border-width) solid var(--border, rgb(255 255 255 / 0.08));
			padding-top: var(--padding-md);
			display: flex;
			justify-content: space-between;
			align-items: center;
			flex-wrap: wrap;
			gap: var(--gap-sm);

			& p {
				margin: 0;
			}
		}

		&__toast-trigger {
			cursor: pointer;
			color: var(--foreground-400);
			font-size: var(--font-size-xs);
			&:hover {
				color: var(--foreground);
			}
		}

		&__toast-icon {
			font-size: var(--font-size-sm);
		}
	}
</style>