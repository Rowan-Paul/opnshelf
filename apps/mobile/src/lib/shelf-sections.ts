export type ShelfSection<T> = {
	label: string;
	items: T[];
};

/** Group dated Watches in response order and put all undated Watches last. */
export function groupShelfSections<T extends { watchedDate?: string }>(
	items: T[],
	labelForDate: (date: string) => string,
): ShelfSection<T>[] {
	const sections: ShelfSection<T>[] = [];
	const undated: T[] = [];

	for (const item of items) {
		if (!item.watchedDate) {
			undated.push(item);
			continue;
		}

		const label = labelForDate(item.watchedDate);
		const section = sections.at(-1);
		if (section?.label === label) section.items.push(item);
		else sections.push({ label, items: [item] });
	}

	if (undated.length > 0) {
		sections.push({ label: "No date", items: undated });
	}

	return sections;
}
