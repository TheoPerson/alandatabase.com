import { writable, type Readable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
	id: string;
	message: string;
	type: ToastType;
}

const toastStore = writable<ToastMessage[]>([]);

export const toasts: Readable<ToastMessage[]> = {
	subscribe: toastStore.subscribe
};

export function addToast(message: string, type: ToastType = 'info') {
	const id = Math.random().toString(36).slice(2);
	toastStore.update((all) => [...all, { id, message, type }]);
	setTimeout(() => {
		toastStore.update((all) => all.filter((t) => t.id !== id));
	}, 3000);
}
