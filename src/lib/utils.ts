import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/** True only for absolute http(s) URLs — rejects `javascript:`, `data:` and other script-capable schemes. */
export function isSafeHttpUrl(value: string | null | undefined): value is string {
	if (!value) return false;
	try {
		const { protocol } = new URL(value);
		return protocol === 'https:' || protocol === 'http:';
	} catch {
		return false;
	}
}

export type WithElementRef<T> = T & { ref?: any };
export type WithoutChildrenOrChild<T> = Omit<T, 'children' | 'child'>;
