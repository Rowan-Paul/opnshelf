export function formatCatalogueDate(
	date: string | null | undefined,
	locale?: string,
	month: "long" | "short" = "long",
): string | undefined {
	if (!date) return undefined;
	const parsed = new Date(date);
	if (Number.isNaN(parsed.getTime())) return undefined;

	return parsed.toLocaleDateString(locale, {
		day: "numeric",
		month,
		year: "numeric",
		timeZone: "UTC",
	});
}
