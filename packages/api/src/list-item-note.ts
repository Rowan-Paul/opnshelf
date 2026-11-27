export function isListItemNoteTooLong(note: string): boolean {
	const presentationSequences = note.match(/[^\uFE0E\uFE0F][\uFE0E\uFE0F]/g);
	return [...note].length - (presentationSequences?.length ?? 0) > 1000;
}
