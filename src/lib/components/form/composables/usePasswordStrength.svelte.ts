// composables/usePasswordStrength.svelte.ts
// Spec: usePasswordStrength(password)
export interface PasswordStrength {
	score: number;
	label: string;
	percent: number;
	color: string;
}

export function usePasswordStrength(
	getPassword: () => string,
	config: { getLang?: () => string; labels?: { weak?: Record<string, string>; fair?: Record<string, string>; good?: Record<string, string>; strong?: Record<string, string> } } = {}
) {
	const strength = $derived.by<PasswordStrength>(() => {
		const pwd = getPassword();
		if (!pwd) return { score: 0, label: '', percent: 0, color: 'transparent' };
		let score = 0;
		if (pwd.length >= 8) score++;
		if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
		if (/\d/.test(pwd)) score++;
		if (/[^a-zA-Z\d\s]/.test(pwd)) score++;
		const lang = config.getLang?.() ?? 'en';
		if (score <= 1) {
			return { score: 1, label: config.labels?.weak?.[lang] ?? config.labels?.weak?.['en'] ?? 'Weak', percent: 25, color: '#ef4444' };
		} else if (score === 2) {
			return { score: 2, label: config.labels?.fair?.[lang] ?? config.labels?.fair?.['en'] ?? 'Fair', percent: 50, color: '#f59e0b' };
		} else if (score === 3) {
			return { score: 3, label: config.labels?.good?.[lang] ?? config.labels?.good?.['en'] ?? 'Good', percent: 75, color: '#3b82f6' };
		} else {
			return { score: 4, label: config.labels?.strong?.[lang] ?? config.labels?.strong?.['en'] ?? 'Strong', percent: 100, color: '#10b981' };
		}
	});

	return {
		get value() { return strength; },
		get score() { return strength.score; },
		get label() { return strength.label; },
		get percent() { return strength.percent; },
		get color() { return strength.color; }
	};
}
