<!-- src/routes/ui/radiogroup/+page.svelte -->
<script lang="ts">
	import { Button } from '$components/element';
	import { FieldMessages, Form, Input, RadioGroup, RadioItem, TextField } from '$components/form';
	import type { Color, Size } from '$components/interface';

	// ── State (probe locate qua data-test + .radiogroup-root con trực tiếp) ──
	// Audit: đủ 14 size của type Size (2xs → 9xl; 'full' KHÔNG thuộc Size —
	// .size-full chỉ set width/height 100% cho container) + đủ 7 Color.
	const sizesList: Size[] = [
		'2xs',
		'xs',
		'sm',
		'md',
		'lg',
		'xl',
		'2xl',
		'3xl',
		'4xl',
		'5xl',
		'6xl',
		'7xl',
		'8xl',
		'9xl'
	];
	const colorsList: Color[] = ['default', 'primary', 'info', 'secondary', 'success', 'warning', 'error'];
	// Checked sẵn item đầu để thấy luôn checked-state (fill + label màu semantic)
	let sizePicked = $state<Record<string, string>>(
		Object.fromEntries(sizesList.map((s) => [s, 'on']))
	);
	let colorPicked = $state<Record<string, string>>(
		Object.fromEntries(colorsList.map((c) => [c, 'on']))
	);
	let colorValue = $state<string | null>(null);
	let planValue = $state<string | null>(null);
	let disabledValue = $state<string | null>('plan-sm');
	let requiredValue = $state<string | null>(null);

	// rg-form: gate submit theo page state (Form không export configs → page tự quản).
	// formContext chỉ đọc được BÊN TRONG Form (context parent→child), nên page dùng
	// state bind + regex email để quyết định disabled — đồng bộ với probe RG8.
	let formRadio = $state<string | null>(null);
	let formEmail = $state('');
	let formSubmitted = $state(false);
	const emailOk = $derived(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(formEmail.trim()));
	const formValid = $derived(!!formRadio && emailOk);
	function handleSubmit() {
		if (!formValid) return;
		formSubmitted = true;
	}
</script>

<div class="page" data-test="radiogroup-demo">
	<h1 class="page-title">RadioGroup · single-select (native radio + roving tabindex)</h1>

	<!-- Sizes: đủ 14 token type Size (2xs → 9xl) — --radio-size scale theo --font-size -->
	<section class="demo" data-test="rg-sizes">
		<h2>Sizes (2xs → 9xl — đủ 14 token của type Size)</h2>
		{#each sizesList as s (s)}
			<RadioGroup size={s} bind:value={sizePicked[s]} aria-label="Size {s}">
				<RadioItem id="on" label={s} />
				<RadioItem id="off" label="—" />
			</RadioGroup>
		{/each}
		<p class="demo-hint">
			<code>.size-full</code> KHÔNG thuộc type <code>Size</code> (chỉ set width/height 100%
			cho container) nên không áp cho form field. 'full' user liệt kê trong yêu cầu
			không triển khai được theo nguyên tắc hệ thống.
		</p>
	</section>

	<!-- Colors: đủ 7 giá trị type Color — checked-state đổi theo màu semantic -->
	<section class="demo" data-test="rg-colors">
		<h2>Colors (default / primary / info / secondary / success / warning / error)</h2>
		{#each colorsList as c (c)}
			<RadioGroup color={c} bind:value={colorPicked[c]} aria-label="Color {c}">
				<RadioItem id="on" label={c} />
				<RadioItem id="off" label="—" />
			</RadioGroup>
		{/each}
		<p class="demo-hint">
			Checked fill + label màu theo <code>--radio-checked-color</code> (primary mặc định /
			semantic theo prop); unchecked border theo <code>--color</code>. error/success cũng
			tự sinh từ validation (required + đã chọn).
		</p>
	</section>

	<!-- Horizontal + description (2 hàng: label + description) -->
	<section class="demo" data-test="rg-horizontal">
		<h2>Horizontal + description</h2>
		<RadioGroup orientation="horizontal" bind:value={colorValue} aria-label="Favorite color">
			<RadioItem
				id="red"
				label="Red"
				description={{ en: 'Warm & bold', vi: 'Nóng và nổi bật' }}
			/>
			<RadioItem
				id="blue"
				label="Blue"
				description={{ en: 'Calm & professional', vi: 'Bình tĩnh, chuyên nghiệp' }}
			/>
			<RadioItem id="green" label="Green" description="Nature & growth" />
		</RadioGroup>
		<p class="demo-hint">
			Đang chọn: <code>{colorValue ?? 'chưa có'}</code>
		</p>
	</section>

	<!-- Required + FieldMessages (showValid) -->
	<section class="demo" data-test="rg-required">
		<h2>Required + FieldMessages (showValid)</h2>
		<RadioGroup
			name="rg-required-plan"
			required
			bind:value={requiredValue}
			aria-label="Subscription plan"
		>
			<RadioItem id="free" label="Free" description="0 USD / month" />
			<RadioItem id="pro" label="Pro" description="10 USD / month" />
			<!-- FieldMessages NẰM TRONG RadioGroup (descendant trực tiếp → radio context) -->
			<FieldMessages showValid />
		</RadioGroup>
		<p class="demo-hint">
			Đang chọn: <code>{requiredValue ?? 'chưa có'}</code> — chọn option → sau ~300ms debounce
			lên message "valid" (showValid); group required chưa chọn → validation pending.
		</p>
	</section>

	<!-- Disabled items (item-level) -->
	<section class="demo" data-test="rg-disabled">
		<h2>Disabled (item-level)</h2>
		<RadioGroup name="rg-disabled" bind:value={disabledValue} aria-label="Disabled demo">
			<RadioItem id="plan-sm" label="Small" />
			<RadioItem id="plan-md" label="Medium" disabled />
			<RadioItem id="plan-lg" label="Large" />
		</RadioGroup>
		<p class="demo-hint">
			Đang chọn: <code>{disabledValue ?? 'chưa có'}</code> — "Medium" disabled (item-level):
			mouse không chọn được, keyboard (Arrow) bỏ qua.
		</p>
	</section>

	<!-- In Form: RadioGroup required + Input email + submit gate (page state) -->
	<section class="demo" data-test="rg-form">
		<h2>Trong Form (required + submit gate)</h2>
		<Form onSubmit={handleSubmit}>
			<RadioGroup name="rg-form-plan" required bind:value={formRadio} aria-label="Plan">
				<RadioItem id="basic" label="Basic" />
				<RadioItem id="premium" label="Premium" />
				<FieldMessages showValid />
			</RadioGroup>

			<TextField name="rg-form-email" required>
				<Input type="email" bind:value={formEmail} placeholder="you@example.com" />
				<FieldMessages />
			</TextField>

			<Button type="submit" color="success" variant="solid" disabled={!formValid}>
				{formSubmitted ? 'Đã submit ✓' : 'Submit'}
			</Button>
		</Form>
		<p class="demo-hint">
			Nút Submit disabled tới khi: đã chọn plan + email đúng định dạng.
		</p>
	</section>

	<!-- Keyboard guide (roving tabindex: MỘT stop Tab) -->
	<section class="demo" data-test="rg-keyboard">
		<h2>Keyboard guide</h2>
		<div class="keyboard-guide">
			<ul>
				<li><kbd>Tab</kbd> — vào group (mỗi group chỉ MỘT stop: item active)</li>
				<li><kbd>ArrowDown</kbd> / <kbd>ArrowRight</kbd> — focus option kế tiếp (wrap)</li>
				<li><kbd>ArrowUp</kbd> / <kbd>ArrowLeft</kbd> — focus option trước (wrap)</li>
				<li><kbd>Home</kbd> / <kbd>End</kbd> — focus option đầu / cuối</li>
				<li><kbd>Space</kbd> — chọn option đang focus</li>
			</ul>
		</div>
		<RadioGroup name="rg-keyboard" bind:value={planValue} aria-label="Keyboard demo">
			<RadioItem id="k1" label="Option 1" />
			<RadioItem id="k2" label="Option 2" />
			<RadioItem id="k3" label="Option 3" />
		</RadioGroup>
		<p class="demo-hint">
			Đang chọn: <code>{planValue ?? 'chưa có'}</code>
		</p>
	</section>
</div>

<style lang="scss">
	.page {
		max-width: 720px;
		margin: 0 auto;
		padding: 2rem 1.5rem 6rem;
		color: var(--foreground);
	}
	.page-title {
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 1.5rem;
	}
	.demo {
		margin-bottom: 2.5rem;
		h2 {
			font-size: 1rem;
			font-weight: 600;
			margin-bottom: 0.75rem;
			opacity: 0.8;
		}
	}
	.demo-hint {
		margin: 0.5rem 0 0;
		font-size: 0.8rem;
		opacity: 0.7;
	}
	.keyboard-guide {
		margin: 0.5rem 0;
		padding: 0.75rem 1rem;
		border: 1px dashed var(--border, rgba(125, 125, 125, 0.4));
		border-radius: 0.5rem;
		ul {
			margin: 0;
			padding-left: 1rem;
			display: flex;
			flex-direction: column;
			gap: 0.3rem;
		}
		li {
			font-size: 0.85rem;
		}
	}
	kbd {
		display: inline-block;
		min-width: 2rem;
		padding: 0.1rem 0.4rem;
		border: 1px solid var(--border, rgba(125, 125, 125, 0.4));
		border-radius: 0.25rem;
		font-family: monospace;
		font-size: 0.8rem;
		text-align: center;
	}
</style>
