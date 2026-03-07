export function parsePageNumber(input: unknown) {
	const parsed = Number(input);
	if (!Number.isInteger(parsed) || parsed < 1) {
		return 1;
	}

	return parsed;
}

export function getVisiblePages(currentPage: number, totalPages: number) {
	if (totalPages <= 0) {
		return [];
	}

	if (totalPages <= 5) {
		return Array.from({ length: totalPages }, (_, index) => index + 1);
	}

	const pages = new Set<number>([
		1,
		Math.max(currentPage - 1, 1),
		currentPage,
		Math.min(currentPage + 1, totalPages),
		totalPages,
	]);

	const orderedPages = [...pages]
		.filter((page) => page >= 1 && page <= totalPages)
		.sort((a, b) => a - b);

	const visiblePages: Array<number | "ellipsis"> = [];

	for (let index = 0; index < orderedPages.length; index += 1) {
		const page = orderedPages[index];
		const previousPage = orderedPages[index - 1];

		if (previousPage && page - previousPage > 1) {
			visiblePages.push("ellipsis");
		}

		visiblePages.push(page);
	}

	return visiblePages;
}
