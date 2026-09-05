// src/lib/dpop/fetchWithDpop.ts
import { createDpopProof } from './proof';

let refreshInFlight: Promise<boolean> | null = null;

export async function tryRefreshToken(): Promise<boolean> {
	// Tránh trường hợp nhiều request 401 cùng lúc → gọi refresh nhiều lần song song
	if (refreshInFlight) return refreshInFlight;

	refreshInFlight = (async () => {
		try {
			const htu = new URL('/api/auth/refresh', location.origin).toString();
			// Lưu ý: refresh KHÔNG cần accessToken cũ, vì access token có thể đã hết hạn
			const proof = await createDpopProof({ htm: 'POST', htu });

			const res = await fetch('/api/auth/refresh', {
				method: 'POST',
				headers: { DPoP: proof },
				credentials: 'include' // bắt buộc để cookie refreshToken (httpOnly) được gửi kèm
			});

			if (!res.ok) {
				sessionStorage.removeItem('accessToken');
				return false;
			}

			const { accessToken } = await res.json();
			sessionStorage.setItem('accessToken', accessToken);
			return true;
		} catch {
			sessionStorage.removeItem('accessToken');
			return false;
		} finally {
			refreshInFlight = null; // reset để lần 401 sau vẫn gọi lại được
		}
	})();

	return refreshInFlight;
}

export async function callProtectedApi(path: string, init: RequestInit = {}) {
	const accessToken = sessionStorage.getItem('accessToken');
	if (!accessToken) {
		location.href = '/login';
		throw new Error('Not logged in');
	}

	const htm = (init.method ?? 'GET').toUpperCase();
	const htu = new URL(path, location.origin).toString();
	const proof = await createDpopProof({ htm, htu, accessToken });

	const res = await fetch(path, {
		...init,
		headers: {
			...init.headers,
			Authorization: `DPoP ${accessToken}`,
			DPoP: proof
		}
	});

	if (res.status === 401) {
		const refreshed = await tryRefreshToken();
		if (refreshed) {
			// Retry đúng 1 lần với access token mới, không đệ quy vô hạn
			const newAccessToken = sessionStorage.getItem('accessToken')!;
			const retryProof = await createDpopProof({ htm, htu, accessToken: newAccessToken });
			return fetch(path, {
				...init,
				headers: {
					...init.headers,
					Authorization: `DPoP ${newAccessToken}`,
					DPoP: retryProof
				}
			});
		}
		location.href = '/login';
	}

	return res;
}
