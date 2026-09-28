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
				{#if configs.showPoweredBy}
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
		background: var(--background, #09090b);
		border-top: 1px solid var(--border, rgb(255 255 255 / 0.08));
		padding: 1.5rem 1rem;
		width: 100%;
		color: var(--foreground-400, #71717a);
		font-size: 0.75rem;

		&__container {
			max-width: 120rem;
			margin: 0 auto;
			display: flex;
			flex-wrap: wrap;
			justify-content: space-between;
			gap: 1rem;
		}

		&__brand {
			font-size: 0.875rem;
			font-weight: 500;
			color: var(--foreground, #f4f4f5);
			margin-bottom: 0.5rem;
		}

		&__links {
			display: flex;
			gap: 1rem;
			flex-wrap: wrap;
			margin-bottom: 0.5rem;

			&__link {
				color: var(--foreground-400, #71717a);
				text-decoration: none;
				transition: color 0.2s;
				&:hover {
					color: var(--foreground, #f4f4f5);
				}
			}
		}

		&__copyright {
			margin-top: 1rem;
			border-top: 1px solid var(--border, rgb(255 255 255 / 0.08));
			padding-top: 1rem;
			display: flex;
			justify-content: space-between;
			align-items: center;
			flex-wrap: wrap;
			gap: 0.5rem;

			& p {
				margin: 0;
			}

			&__trigger {
				cursor: pointer;
				color: var(--foreground-400, #71717a);
				font-size: 0.75rem;
				&:hover {
					color: var(--foreground, #f4f4f5);
				}
			}
		}
	}
</style>