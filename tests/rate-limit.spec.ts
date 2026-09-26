// tests/rate-limit.spec.ts
import { test, expect } from '@playwright/test';

/**
 * Rate Limiting Tests
 *
 * Tests verify:
 * - /api/login: 5 requests/minute per IP
 * - /api/register: 3 requests/minute per IP
 * - 429 Too Many Requests with Retry-After header
 * - Whitelisted paths bypass rate limiting
 */

// Helper to make login request using Playwright's request fixture
async function makeLoginRequest(
	request: any,
	username: string,
	password: string,
	remember = false
) {
	const response = await request.post('/api/login', {
		data: { username, password, remember }
	});
	return response;
}

async function makeRegisterRequest(
	request: any,
	email: string,
	username: string,
	password: string,
	firstname: string,
	lastname: string
) {
	const response = await request.post('/api/register', {
		data: { email, username, password, firstname, lastname }
	});
	return response;
}

test.describe('Rate Limiting - /api/login', () => {
	test('allows up to 5 requests per minute', async ({ request }) => {
		// Make 5 requests - all should succeed (or fail for auth reasons, not rate limit)
		for (let i = 0; i < 5; i++) {
			const response = await makeLoginRequest(request, `user${i}`, 'password123');
			// Should not be 429 (rate limited)
			expect(response.status()).not.toBe(429);
		}
	});

	test('blocks 6th request within 1 minute', async ({ request }) => {
		// Make 5 requests first
		for (let i = 0; i < 5; i++) {
			await makeLoginRequest(request, `testuser${i}`, 'password123');
		}

		// 6th request should be rate limited
		const response = await makeLoginRequest(request, 'testuser6', 'password123');

		expect(response.status()).toBe(429);

		// Check for Retry-After header
		const retryAfter = response.headers()['retry-after'];
		expect(retryAfter).toBeTruthy();
		expect(parseInt(retryAfter)).toBeGreaterThan(0);

		// Check response body
		const body = await response.json();
		expect(body.ok).toBe(false);
		expect(body.message).toBeTruthy();
	});
});

test.describe('Rate Limiting - /api/register', () => {
	test('allows up to 3 requests per minute', async ({ request }) => {
		for (let i = 0; i < 3; i++) {
			const response = await makeRegisterRequest(
				request,
				`test${i}@example.com`,
				`testuser${i}`,
				'password123',
				'Test',
				'User'
			);
			expect(response.status()).not.toBe(429);
		}
	});

	test('blocks 4th request within 1 minute', async ({ request }) => {
		// Make 3 requests first
		for (let i = 0; i < 3; i++) {
			await makeRegisterRequest(
				request,
				`regtest${i}@example.com`,
				`reguser${i}`,
				'password123',
				'Test',
				'User'
			);
		}

		// 4th request should be rate limited
		const response = await makeRegisterRequest(
			request,
			'regtest4@example.com',
			'reguser4',
			'password123',
			'Test',
			'User'
		);

		expect(response.status()).toBe(429);

		const retryAfter = response.headers()['retry-after'];
		expect(retryAfter).toBeTruthy();
		expect(parseInt(retryAfter)).toBeGreaterThan(0);

		const body = await response.json();
		expect(body.ok).toBe(false);
		expect(body.message).toBeTruthy();
	});
});

test.describe('Rate Limiting - Headers', () => {
	test('returns rate limit headers on successful requests', async ({ request }) => {
		const response = await makeLoginRequest(request, 'headeruser', 'password123');

		// Check for rate limit headers
		expect(response.headers()['x-ratelimit-limit']).toBe('5');
		expect(response.headers()['x-ratelimit-remaining']).toBeTruthy();
		expect(response.headers()['x-ratelimit-reset']).toBeTruthy();
	});

	test('returns rate limit headers on register', async ({ request }) => {
		const response = await makeRegisterRequest(
			request,
			'header@example.com',
			'headeruser',
			'password123',
			'Test',
			'User'
		);

		expect(response.headers()['x-ratelimit-limit']).toBe('3');
		expect(response.headers()['x-ratelimit-remaining']).toBeTruthy();
		expect(response.headers()['x-ratelimit-reset']).toBeTruthy();
	});
});

test.describe('Rate Limiting - Whitelisted paths', () => {
	test('bypasses rate limiting for health check', async ({ request }) => {
		// Make many requests to health endpoint
		for (let i = 0; i < 20; i++) {
			const response = await request.get('/api/health');
			expect(response.status()).not.toBe(429);
		}
	});

	test('bypasses rate limiting for static assets', async ({ request }) => {
		// Try to access a non-existent static asset (should 404, not 429)
		const response = await request.get('/nonexistent.js');
		expect(response.status()).not.toBe(429);
	});

	test('bypasses rate limiting for encryption public key endpoint', async ({ request }) => {
		for (let i = 0; i < 20; i++) {
			const response = await request.get('/api/encryption/public-key');
			expect(response.status()).not.toBe(429);
		}
	});
});

test.describe('Rate Limiting - Separate limits per endpoint', () => {
	test('login and register have independent limits', async ({ request }) => {
		// Exhaust login limit (5 requests)
		for (let i = 0; i < 5; i++) {
			await makeLoginRequest(request, `independent${i}`, 'password123');
		}

		// Login should now be rate limited
		const loginResponse = await makeLoginRequest(request, 'independent5', 'password123');
		expect(loginResponse.status()).toBe(429);

		// But register should still work (3 requests)
		const registerResponse = await makeRegisterRequest(
			request,
			'independent@example.com',
			'independentuser',
			'password123',
			'Test',
			'User'
		);
		expect(registerResponse.status()).not.toBe(429);
	});
});

test.describe('Rate Limiting - Vietnamese messages', () => {
	test('returns Vietnamese error message on rate limit', async ({ request }) => {
		// Exhaust login limit
		for (let i = 0; i < 5; i++) {
			await makeLoginRequest(request, `vnuser${i}`, 'password123');
		}

		const response = await makeLoginRequest(request, 'vnuser5', 'password123');
		expect(response.status()).toBe(429);

		const body = await response.json();
		// Check for Vietnamese message
		expect(body.message.vi).toContain('Quá nhiều yêu cầu');
	});
});