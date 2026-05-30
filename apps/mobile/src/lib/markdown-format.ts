/**
 * Pure, selection-aware markdown transforms for the review editor toolbar.
 *
 * Markdown is the source of truth for reviews (`site.standard.document` /
 * `at.markpub.markdown`), so the toolbar never holds a separate rich-text model:
 * each button just rewrites the markdown string and repositions the selection.
 * That makes the `stored markdown → edit → stored markdown` round-trip lossless
 * by construction — what you see in the TextInput is exactly what gets stored.
 *
 * Every function is pure: it takes the current value + selection and returns the
 * next value + selection, so it is trivially testable and has no RN dependency.
 */

export interface TextSelection {
	start: number;
	end: number;
}

export interface MarkdownEdit {
	text: string;
	selection: TextSelection;
}

/** Order a selection so `start <= end`, clamped to the value bounds. */
function normalize(value: string, sel: TextSelection): TextSelection {
	const start = Math.max(0, Math.min(sel.start, sel.end, value.length));
	const end = Math.min(Math.max(sel.start, sel.end), value.length);
	return { start, end };
}

/**
 * Wrap the selection in an inline marker (`**`, `*`, `` ` ``). Toggles off when
 * the marker already hugs the selection. With an empty selection it inserts the
 * pair and drops the caret between them so the user can type.
 */
export function wrapInline(
	value: string,
	selection: TextSelection,
	marker: string,
): MarkdownEdit {
	const { start, end } = normalize(value, selection);
	const before = value.slice(0, start);
	const selected = value.slice(start, end);
	const after = value.slice(end);

	// Markers already sit just outside the selection → unwrap.
	if (before.endsWith(marker) && after.startsWith(marker)) {
		const newBefore = before.slice(0, before.length - marker.length);
		const newAfter = after.slice(marker.length);
		return {
			text: newBefore + selected + newAfter,
			selection: {
				start: start - marker.length,
				end: end - marker.length,
			},
		};
	}

	if (start === end) {
		const caret = start + marker.length;
		return {
			text: before + marker + marker + after,
			selection: { start: caret, end: caret },
		};
	}

	return {
		text: before + marker + selected + marker + after,
		selection: { start: start + marker.length, end: end + marker.length },
	};
}

/**
 * Apply (or toggle off) a per-line block prefix across every line the selection
 * touches. `makePrefix(index)` builds the prefix for each line — constant for
 * headings/quotes/bullets, incrementing for ordered lists. `pattern` matches an
 * existing prefix so the action is reversible.
 */
function applyLinePrefix(
	value: string,
	selection: TextSelection,
	makePrefix: (index: number) => string,
	pattern: RegExp,
): MarkdownEdit {
	const { start, end } = normalize(value, selection);
	const lineStart = value.lastIndexOf("\n", start - 1) + 1;
	let lineEnd = value.indexOf("\n", end);
	if (lineEnd === -1) lineEnd = value.length;

	const block = value.slice(lineStart, lineEnd);
	const lines = block.split("\n");
	const meaningful = lines.filter((line) => line.trim().length > 0);
	const allPrefixed =
		meaningful.length > 0 && meaningful.every((line) => pattern.test(line));

	const newLines = lines.map((line, index) =>
		allPrefixed ? line.replace(pattern, "") : makePrefix(index) + line,
	);
	const newBlock = newLines.join("\n");
	const delta = newBlock.length - block.length;

	return {
		text: value.slice(0, lineStart) + newBlock + value.slice(lineEnd),
		selection: { start: lineStart, end: lineEnd + delta },
	};
}

/** Toggle an ATX heading of the given level (replacing any existing heading). */
export function toggleHeading(
	value: string,
	selection: TextSelection,
	level: 1 | 2 | 3,
): MarkdownEdit {
	return applyLinePrefix(
		value,
		selection,
		() => `${"#".repeat(level)} `,
		/^#{1,6}\s+/,
	);
}

/** Toggle a `> ` blockquote on the selected lines. */
export function toggleQuote(
	value: string,
	selection: TextSelection,
): MarkdownEdit {
	return applyLinePrefix(value, selection, () => "> ", /^>\s?/);
}

/** Toggle a `- ` bullet list on the selected lines. */
export function toggleBulletList(
	value: string,
	selection: TextSelection,
): MarkdownEdit {
	return applyLinePrefix(value, selection, () => "- ", /^[-*]\s+/);
}

/** Toggle a `1. ` ordered list on the selected lines, renumbering from one. */
export function toggleOrderedList(
	value: string,
	selection: TextSelection,
): MarkdownEdit {
	return applyLinePrefix(
		value,
		selection,
		(index) => `${index + 1}. `,
		/^\d+\.\s+/,
	);
}

/**
 * Insert a `[text](url)` link. Uses the current selection as the link text; with
 * no selection it drops in a `link` placeholder and selects it for overwrite.
 */
export function insertLink(
	value: string,
	selection: TextSelection,
	url: string,
): MarkdownEdit {
	const { start, end } = normalize(value, selection);
	const before = value.slice(0, start);
	const selected = value.slice(start, end);
	const after = value.slice(end);
	const label = selected || "link";
	const snippet = `[${label}](${url})`;

	if (selected) {
		const caret = start + snippet.length;
		return {
			text: before + snippet + after,
			selection: { start: caret, end: caret },
		};
	}

	// Select the placeholder label (`link`) so the user can type over it.
	return {
		text: before + snippet + after,
		selection: { start: start + 1, end: start + 1 + label.length },
	};
}

/**
 * Wrap the selected lines in a fenced code block on their own lines. With an
 * empty selection it inserts an empty fence and parks the caret on the blank
 * middle line.
 */
export function toggleCodeBlock(
	value: string,
	selection: TextSelection,
): MarkdownEdit {
	const { start, end } = normalize(value, selection);
	const lineStart = value.lastIndexOf("\n", start - 1) + 1;
	let lineEnd = value.indexOf("\n", end);
	if (lineEnd === -1) lineEnd = value.length;
	const block = value.slice(lineStart, lineEnd);

	if (block.length === 0) {
		const before = value.slice(0, lineStart);
		const after = value.slice(lineEnd);
		const snippet = "```\n\n```";
		const caret = lineStart + 4; // after "```\n"
		return {
			text: before + snippet + after,
			selection: { start: caret, end: caret },
		};
	}

	const fenced = `\`\`\`\n${block}\n\`\`\``;
	return {
		text: value.slice(0, lineStart) + fenced + value.slice(lineEnd),
		selection: { start: lineStart, end: lineStart + fenced.length },
	};
}
