export const load = async ({ locals }) => {
	return {
		user: locals.user,
		abTests: locals.abTests
	};
};
