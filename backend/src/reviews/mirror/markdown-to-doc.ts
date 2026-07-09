export type InlineRun =
	| { type: "text"; text: string }
	| { type: "bold"; text: string }
	| { type: "italic"; text: string }
	| { type: "code"; text: string }
	| { type: "link"; text: string; href: string };

export type DocumentBlock =
	| { type: "paragraph"; runs: InlineRun[] }
	| { type: "heading"; level: number; runs: InlineRun[] }
	| { type: "blockquote"; runs: InlineRun[] }
	| { type: "codeBlock"; code: string; language?: string }
	| { type: "list"; ordered: boolean; items: InlineRun[][] };

const blockStart = /^(#{1,6}\s|>\s?|[-*+]\s+|\d+\.\s+|```)/;
const inlineToken =
	/(\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;

function parseInline(text: string): InlineRun[] {
	const runs: InlineRun[] = [];
	let cursor = 0;
	for (const match of text.matchAll(inlineToken)) {
		const index = match.index ?? 0;
		if (index > cursor)
			runs.push({ type: "text", text: text.slice(cursor, index) });
		if (match[2] && match[3]) {
			runs.push({ type: "link", text: match[2], href: match[3] });
		} else if (match[4]) {
			runs.push({ type: "bold", text: match[4] });
		} else if (match[5]) {
			runs.push({ type: "italic", text: match[5] });
		} else if (match[6]) {
			runs.push({ type: "code", text: match[6] });
		}
		cursor = index + match[0].length;
	}
	if (cursor < text.length)
		runs.push({ type: "text", text: text.slice(cursor) });
	return runs.length ? runs : [{ type: "text", text }];
}

/**
 * A deliberately small, portable markdown reader for mirror output. Reviews
 * remain canonical Markdown; unsupported syntax is retained as paragraph text
 * rather than silently discarded.
 */
export function markdownToDocument(markdown: string): DocumentBlock[] {
	const lines = markdown.replace(/\r\n/g, "\n").split("\n");
	const blocks: DocumentBlock[] = [];

	for (let i = 0; i < lines.length; ) {
		const line = lines[i];
		if (!line.trim()) {
			i += 1;
			continue;
		}
		const fence = line.match(/^```([^\s]*)\s*$/);
		if (fence) {
			const code: string[] = [];
			i += 1;
			while (i < lines.length && !/^```\s*$/.test(lines[i]))
				code.push(lines[i++]);
			if (i < lines.length) i += 1;
			blocks.push({
				type: "codeBlock",
				code: code.join("\n"),
				language: fence[1] || undefined,
			});
			continue;
		}
		const heading = line.match(/^(#{1,6})\s+(.+)$/);
		if (heading) {
			blocks.push({
				type: "heading",
				level: heading[1].length,
				runs: parseInline(heading[2]),
			});
			i += 1;
			continue;
		}
		const quote = line.match(/^>\s?(.*)$/);
		if (quote) {
			blocks.push({ type: "blockquote", runs: parseInline(quote[1]) });
			i += 1;
			continue;
		}
		const list = line.match(/^(\d+\.|[-*+])\s+(.+)$/);
		if (list) {
			const ordered = /\d+\./.test(list[1]);
			const matcher = ordered ? /^\d+\.\s+(.+)$/ : /^[-*+]\s+(.+)$/;
			const items: InlineRun[][] = [];
			while (i < lines.length) {
				const item = lines[i].match(matcher);
				if (!item) break;
				items.push(parseInline(item[1]));
				i += 1;
			}
			blocks.push({ type: "list", ordered, items });
			continue;
		}

		const paragraph: string[] = [line];
		i += 1;
		while (i < lines.length && lines[i].trim() && !blockStart.test(lines[i])) {
			paragraph.push(lines[i++]);
		}
		blocks.push({ type: "paragraph", runs: parseInline(paragraph.join("\n")) });
	}

	return blocks;
}
