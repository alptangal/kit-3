//$lib/server/rate-limit.ts

/**
 * Rate Limiting Module - Sliding Window Algorithm
 * In-memory implementation with IP + endpoint keying
 *
 * Limits:
 * - /api/login: 5 requests/minute per IP
 * - /api/register: 3 requests/minute per IP
 */

import type { RequestHandler } from '@sveltejs/kit';
import { dev } from '$app/environment';

interface RateLimitEntry {
	count: number;
	windowStart: number;
}

interface RateLimitConfig {
	maxRequests: number;
	windowMs: number;
}

interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	retryAfter?: number; // seconds until next request allowed
	resetTime: number; // timestamp when window resets
}

// In-memory store: Map<key, RateLimitEntry>
const rateLimitStore = new Map<string, RateLimitEntry>();

// Default configurations per endpoint
const ENDPOINT_CONFIGS: Record<string, RateLimitConfig> = {
	'/api/login': { maxRequests: 5, windowMs: 60_000 }, // 5 req/min
	'/api/register': { maxRequests: 3, windowMs: 60_000 } // 3 req/min
};

// Whitelisted paths that bypass rate limiting
const WHITELIST_PATHS = [
	'/api/health',
	'/api/health/',
	'/api/encryption/public-key',
	'/api/encryption/public-key/'
];

// Whitelisted IP ranges (CIDR) - for internal services, load balancers, etc.
const WHITELIST_IPS: string[] = [
	'127.0.0.1',
	'::1',
	'::ffff:127.0.0.1' // IPv6 mapped IPv4
];

/**
 * Check if a path should be whitelisted from rate limiting
 */
function isWhitelistedPath(pathname: string): boolean {
	// Exact match or prefix match for static assets
	if (WHITELIST_PATHS.some(p => pathname === p || pathname.startsWith(p))) {
		return true;
	}

	// Static assets (files with extensions)
	if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)$/i.test(pathname)) {
		return true;
	}

	return false;
}

/**
 * Check if an IP is whitelisted
 */
function isWhitelistedIP(ip: string): boolean {
	// Normalize IPv6 mapped IPv4
	const normalizedIp = ip.replace(/^::ffff:/, '');
	return WHITELIST_IPS.includes(normalizedIp);
}

/**
 * Clean up expired entries from the store
 * Called periodically to prevent memory leaks
 */
function cleanupExpiredEntries(): void {
	const now = Date.now();
	for (const [key, entry] of rateLimitStore.entries()) {
		if (now - entry.windowStart > 300_000) { // 5 minutes old
			rateLimitStore.delete(key);
		}
	}
}

/**
 * Get rate limit configuration for an endpoint
 */
function getConfig(pathname: string): RateLimitConfig | null {
	// Exact match first
	if (ENDPOINT_CONFIGS[pathname]) {
		return ENDPOINT_CONFIGS[pathname];
	}

	// Check for prefix match (e.g., /api/login/...)
	for (const [endpoint, config] of Object.entries(ENDPOINT_CONFIGS)) {
		if (pathname.startsWith(endpoint)) {
			return config;
		}
	}

	return null;
}

/**
 * Generate rate limit key from IP and endpoint
 */
function generateKey(ip: string, endpoint: string): string {
	return `${ip}:${endpoint}`;
}

/**
 * Sliding window rate limit check
 * Returns result with allowed status, remaining requests, and retry-after info
 */
export function checkRateLimit(
	ip: string,
	pathname: string
): RateLimitResult {
	const config = getConfig(pathname);

	// No config means no rate limiting for this endpoint
	if (!config) {
		return {
			allowed: true,
			remaining: Infinity,
			resetTime: Date.now() + 60_000
		};
	}

	const key = generateKey(ip, pathname);
	const now = Date.now();
	const entry = rateLimitStore.get(key);

	if (!entry) {
		// First request in this window
		rateLimitStore.set(key, { count: 1, windowStart: now });
		return {
			allowed: true,
			remaining: config.maxRequests - 1,
			resetTime: now + config.windowMs
		};
	}

	// Check if we're in a new window
	if (now - entry.windowStart >= config.windowMs) {
		// Window expired, start new window
		rateLimitStore.set(key, { count: 1, windowStart: now });
		return {
			allowed: true,
			remaining: config.maxRequests - 1,
			resetTime: now + config.windowMs
		};
	}

	// Still in current window
	if (entry.count >= config.maxRequests) {
		// Rate limit exceeded
		const retryAfter = Math.ceil((entry.windowStart + config.windowMs - now) / 1000);
		return {
			allowed: false,
			remaining: 0,
			retryAfter,
			resetTime: entry.windowStart + config.windowMs
		};
	}

	// Increment count
	entry.count++;
	rateLimitStore.set(key, entry);

	return {
		allowed: true,
		remaining: config.maxRequests - entry.count,
		resetTime: entry.windowStart + config.windowMs
	};
}

/**
 * Get client IP from request
 * Handles proxied requests (X-Forwarded-For, X-Real-IP)
 */
export function getClientIp(request: Request, getClientAddress?: () => string | undefined): string {
	// Try SvelteKit's getClientAddress first
	if (getClientAddress) {
		try {
			const ip = getClientAddress();
			if (ip) return ip;
		} catch {
			// Ignore errors
		}
	}

	// Fallback to headers (for reverse proxy setups)
	const forwardedFor = request.headers.get('x-forwarded-for');
	if (forwardedFor) {
		// X-Forwarded-For can have multiple IPs, take the first (client)
		return forwardedFor.split(',')[0].trim();
	}

	const realIp = request.headers.get('x-real-ip');
	if (realIp) {
		return realIp;
	}

	// Default fallback
	return 'unknown';
}

/**
 * SvelteKit hook wrapper for rate limiting
 * Apply BEFORE encryption/decryption to save compute
 */
export function createRateLimitHook() {
	// Run cleanup every 5 minutes
	if (!dev) {
		setInterval(cleanupExpiredEntries, 5 * 60_000);
	}

	return async function rateLimitHook({ request, getClientAddress, url }: {
		request: Request;
		getClientAddress?: () => string | undefined;
		url: URL;
	}): Promise<Response | null> {
		const pathname = url.pathname;

		// Skip whitelisted paths
		if (isWhitelistedPath(pathname)) {
			return null;
		}

		// Get client IP
		const clientIp = getClientIp(request, getClientAddress);

		// Skip whitelisted IPs
		if (isWhitelistedIP(clientIp)) {
			return null;
		}

		// Check rate limit
		const result = checkRateLimit(clientIp, pathname);

		// Build response headers
		const headers = new Headers();
		headers.set('X-RateLimit-Limit', getConfig(pathname)?.maxRequests.toString() ?? '0');
		headers.set('X-RateLimit-Remaining', result.remaining.toString());
		headers.set('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());

		if (!result.allowed) {
			// Rate limit exceeded
			headers.set('Retry-After', result.retryAfter?.toString() ?? '60');

			return new Response(
				JSON.stringify({
					message: {
						vi: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
						en: 'Too many requests. Please try again later.'
					},
					ok: false
				}),
				{
					status: 429,
					headers,
					statusText: 'Too Many Requests'
				}
			);
		}

		// Attach rate limit info to request for downstream use
		(request as any).rateLimit = result;

		return null; // Continue to next handler
	};
}

/**
 * Manual rate limit check for use inside endpoint handlers
 * Returns response if rate limited, null if allowed
 */
export async function applyRateLimit(
	request: Request,
	getClientAddress: () => string | undefined,
	pathname: string
): Promise<Response | null> {
	// Skip whitelisted paths
	if (isWhitelistedPath(pathname)) {
		return null;
	}

	const clientIp = getClientIp(request, getClientAddress);

	// Skip whitelisted IPs
	if (isWhitelistedIP(clientIp)) {
		return null;
	}

	const result = checkRateLimit(clientIp, pathname);

	const headers = new Headers();
	headers.set('X-RateLimit-Limit', getConfig(pathname)?.maxRequests.toString() ?? '0');
	headers.set('X-RateLimit-Remaining', result.remaining.toString());
	headers.set('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());

	if (!result.allowed) {
		headers.set('Retry-After', result.retryAfter?.toString() ?? '60');

		return new Response(
			JSON.stringify({
				message: {
					vi: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
					en: 'Too many requests. Please try again later.'
				},
				ok: false
			}),
			{
				status: 429,
				headers,
				statusText: 'Too Many Requests'
			}
		);
	}

	// Attach to request for downstream use
	(request as any).rateLimit = result;

	return null;
}

/**
 * Reset rate limit for a specific IP and endpoint (useful for testing)
 */
export function resetRateLimit(ip: string, endpoint: string): void {
	const key = generateKey(ip, endpoint);
	rateLimitStore.delete(key);
}

/**
 * Get current rate limit status without incrementing
 */
export function getRateLimitStatus(ip: string, pathname: string): RateLimitResult | null {
	const config = getConfig(pathname);
	if (!config) return null;

	const key = generateKey(ip, pathname);
	const entry = rateLimitStore.get(key);
	const now = Date.now();

	if (!entry) {
		return {
			allowed: true,
			remaining: config.maxRequests,
			resetTime: now + config.windowMs
		};
	}

	if (now - entry.windowStart >= config.windowMs) {
		return {
			allowed: true,
			remaining: config.maxRequests,
			resetTime: now + config.windowMs
		};
	}

	return {
		allowed: entry.count < config.maxRequests,
		remaining: Math.max(0, config.maxRequests - entry.count),
		retryAfter: entry.count >= config.maxRequests
			? Math.ceil((entry.windowStart + config.windowMs - now) / 1000)
			: undefined,
		resetTime: entry.windowStart + config.windowMs
	};
}

export { ENDPOINT_CONFIGS, WHITELIST_PATHS, WHITELIST_IPS };