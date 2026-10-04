// src/lib/modules/highlight.ts
// Engine so khớp + highlight search (NHẠY DẤU đúng hệ ngôn ngữ) — dùng chung:
//  - Select: filter option + tô highlight label/description theo ô search
//  - Sidebar P3: filter menu item theo `match` + tô highlight label
//
// Ngữ nghĩa (ngôn ngữ Việt):
//  - Query CÓ dấu (vd "á") → chỉ khớp đúng ký tự có dấu đó (KHÔNG khớp "a" hay "à").
//  - Query KHÔNG dấu (vd "a", "truong") → wildcard dấu (khớp a/à/á…, "truong"→"Trường").
//  - Case-insensitive. "đ" là chữ riêng (KHÔNG phải "d" + dấu) — "don" không khớp "đơn".
//
// Token = { base (chữ gốc, lowercase), marks (chuỗi dấu combining), orig (index gốc) }.
// Mỗi ký tự original giải NFD thành base + các dấu combining; orig giữ index gốc để
// slice text đúng vị trí khi highlight (1 token ≙ 1 ký tự original).

export interface TextSegment {
	text: string;
	isMatch: boolean;
}

interface Token {
	base: string;
	marks: string;
	orig: number;
}

const tokenize = (text: string): Token[] => {
	const tokens: Token[] = [];
	for (let i = 0; i < text.length; i++) {
		const nfd = text[i].normalize('NFD');
		let marks = '';
		for (let k = 1; k < nfd.length; k++) {
			const code = nfd.codePointAt(k)!;
			if (code >= 0x0300 && code <= 0x036f) marks += nfd[k]; // chỉ lấy dấu combining
		}
		tokens.push({ base: nfd[0].toLowerCase(), marks, orig: i });
	}
	return tokens;
};

// Hai token khớp không (NHẠY DẤU). Query token KHÔNG dấu (marks='') → wildcard dấu
// (khớp mọi biến thể dấu của cùng chữ gốc). Query token CÓ dấu → bắt buộc đúng dấu đó.
const tokensMatch = (q: Token, t: Token): boolean => {
	if (q.base !== t.base) return false;
	if (q.marks === '') return true;
	return q.marks === t.marks;
};

// Tìm mọi vị trí khớp (query) trong text (dãy token). Trả về [start, end) theo index
// ORIGINAL của text (để slice). Loại bỏ trùng lặp overlap (giữ match bắt đầu sớm nhất).
const findMatches = (textTokens: Token[], queryTokens: Token[]): [number, number][] => {
	const m = queryTokens.length;
	if (m === 0) return [];
	const raw: [number, number][] = [];
	for (let i = 0; i + m <= textTokens.length; i++) {
		let ok = true;
		for (let k = 0; k < m; k++) {
			if (!tokensMatch(queryTokens[k], textTokens[i + k])) {
				ok = false;
				break;
			}
		}
		if (ok) raw.push([textTokens[i].orig, textTokens[i + m - 1].orig + 1]);
	}
	const merged: [number, number][] = [];
	let lastEnd = -1;
	for (const [s, e] of raw) {
		if (s >= lastEnd) {
			merged.push([s, e]);
			lastEnd = e;
		}
	}
	return merged;
};

/** text (label/match) có chứa query (nhạy dấu, case-insensitive) không? */
export function queryMatchesText(text: string, query: string): boolean {
	const q = query.trim();
	if (!text || !q) return false;
	return findMatches(tokenize(text), tokenize(q)).length > 0;
}

/**
 * Chia text thành các đoạn { text, isMatch } theo query (nhạy dấu + case-insensitive).
 * Query rỗng / không khớp → 1 đoạn duy nhất (isMatch=false).
 * Dùng để highlight label theo ô search (màu primary + đậm, không nền).
 */
export function matchSegments(text: string, query: string): TextSegment[] {
	const q = query.trim();
	if (!text || !q) return [{ text, isMatch: false }];
	const matches = findMatches(tokenize(text), tokenize(q));
	if (matches.length === 0) return [{ text, isMatch: false }];
	const segments: TextSegment[] = [];
	let cursor = 0;
	for (const [start, end] of matches) {
		if (start > cursor) segments.push({ text: text.slice(cursor, start), isMatch: false });
		segments.push({ text: text.slice(start, end), isMatch: true });
		cursor = end;
	}
	if (cursor < text.length) segments.push({ text: text.slice(cursor), isMatch: false });
	return segments;
}
