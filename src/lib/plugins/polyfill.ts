// src/hooks.client.ts

// ─── Object.hasOwn (Safari < 15.4) ───────────────────────────────────────────
if (!Object.hasOwn) {
	Object.hasOwn = (obj: object, prop: PropertyKey): boolean =>
		Object.prototype.hasOwnProperty.call(obj, prop);
}

// ─── structuredClone (Safari < 15.4) ─────────────────────────────────────────
if (typeof structuredClone === 'undefined') {
	(globalThis as any).structuredClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));
}

// ─── Array.prototype.at (Safari < 15.4) ──────────────────────────────────────
if (!Array.prototype.at) {
	Array.prototype.at = function (index: number) {
		const n = Math.trunc(index) || 0;
		return this[n < 0 ? this.length + n : n];
	};
}

// ─── Array.prototype.findLast (Safari < 15.4) ────────────────────────────────
if (!Array.prototype.findLast) {
	Array.prototype.findLast = function <T>(
		predicate: (value: T, index: number, array: T[]) => boolean,
		thisArg?: unknown
	): T | undefined {
		for (let i = this.length - 1; i >= 0; i--) {
			if (predicate.call(thisArg, this[i], i, this)) return this[i];
		}
		return undefined;
	};
}

// ─── Array.prototype.findLastIndex (Safari < 15.4) ───────────────────────────
if (!Array.prototype.findLastIndex) {
	Array.prototype.findLastIndex = function <T>(
		predicate: (value: T, index: number, array: T[]) => boolean,
		thisArg?: unknown
	): number {
		for (let i = this.length - 1; i >= 0; i--) {
			if (predicate.call(thisArg, this[i], i, this)) return i;
		}
		return -1;
	};
}

// ─── Array.prototype.toSorted (Safari < 16) ──────────────────────────────────
if (!Array.prototype.toSorted) {
	Array.prototype.toSorted = function <T>(compareFn?: (a: T, b: T) => number): T[] {
		return [...this].sort(compareFn);
	};
}

// ─── Array.prototype.toReversed (Safari < 16) ────────────────────────────────
if (!Array.prototype.toReversed) {
	Array.prototype.toReversed = function <T>(): T[] {
		return [...this].reverse();
	};
}

// ─── Array.prototype.toSpliced (Safari < 16) ─────────────────────────────────
if (!Array.prototype.toSpliced) {
	Array.prototype.toSpliced = function <T>(
		start: number,
		deleteCount?: number,
		...items: T[]
	): T[] {
		const copy = [...this];
		copy.splice(start, deleteCount ?? copy.length, ...items);
		return copy;
	};
}

// ─── Array.prototype.with (Safari < 16) ──────────────────────────────────────
if (!Array.prototype.with) {
	Array.prototype.with = function <T>(index: number, value: T): T[] {
		const copy = [...this] as T[];
		copy[index < 0 ? copy.length + index : index] = value;
		return copy;
	};
}
