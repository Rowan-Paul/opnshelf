export const NO_DATE_SECTION_LABEL = "No date";

export function groupShelfItemsByDate<T extends { watchedDate?: string }>(
	items: T[],
	getDateLabel: (date: string) => string,
): Array<{ label: string; items: T[] }> {
	const sections: Array<{ label: string; items: T[] }> = [];
	const datedSections = new Map<string, { label: string; items: T[] }>();
	const undatedItems: T[] = [];

	for (const item of items) {
		if (!item.watchedDate) {
			undatedItems.push(item);
			continue;
		}

		const label = getDateLabel(item.watchedDate);
		const existing = datedSections.get(label);
		if (existing) {
			existing.items.push(item);
			continue;
		}

		const section = { label, items: [item] };
		datedSections.set(label, section);
		sections.push(section);
	}

	if (undatedItems.length > 0) {
		sections.push({ label: NO_DATE_SECTION_LABEL, items: undatedItems });
	}

	return sections;
}
