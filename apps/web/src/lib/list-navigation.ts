/**
 * Next highlighted index for arrow-key navigation over a list, wrapping at both
 * ends. `-1` means nothing is highlighted, which is where a fresh list starts:
 * from there Down goes to the first item and Up to the last.
 */
export function nextIndex(
	current: number,
	length: number,
	step: 1 | -1,
): number {
	if (length === 0) {
		return -1;
	}
	if (current < 0) {
		return step === 1 ? 0 : length - 1;
	}
	return (current + step + length) % length;
}
