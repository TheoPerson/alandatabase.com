export interface ErrorCopy {
	title: string;
	description: string;
	// Whether trying again can plausibly help (a server hiccup) or not (a missing page).
	retryable: boolean;
}

const MAX_MESSAGE = 160;

// SvelteKit sanitises `error.message`, but a long or empty one is not worth showing.
function usable(message: string | undefined): string | null {
	const text = (message ?? '').trim();
	return text && text.length <= MAX_MESSAGE ? text : null;
}

export function errorCopy(status: number, message?: string): ErrorCopy {
	if (status === 404) {
		return {
			title: "We can't find that page",
			description: 'The link may be old, or the page may have been moved or removed.',
			retryable: false
		};
	}
	if (status === 401 || status === 403) {
		return {
			title: 'This area is private',
			description: 'Sign in with an account that has access, or head back to the public catalogue.',
			retryable: false
		};
	}
	if (status >= 400 && status < 500) {
		return {
			title: "That request didn't look right",
			description: usable(message) ?? 'Check the address and try again.',
			retryable: false
		};
	}
	return {
		title: 'Something went wrong on our side',
		description: usable(message) ?? 'Nothing was lost. Please try again in a moment.',
		retryable: true
	};
}
