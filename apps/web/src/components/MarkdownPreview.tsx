import type { ReactNode } from "react";

/**
 * Minimal, dependency-free Markdown preview. This is a PREVIEW only — the
 * canonical rich render lives on the review's standard.site document page
 * (issue #115). It deliberately avoids dangerouslySetInnerHTML: text is parsed
 * into React nodes so no raw HTML from the user is ever injected.
 *
 * Supported: headings (#..######), unordered/ordered lists, blockquotes,
 * fenced code blocks, inline bold/italic/code, and paragraphs.
 */
function renderInline(text: string): ReactNode[] {
	const nodes: ReactNode[] = [];
	// Match **bold**, *italic*/_italic_, `code` in order of appearance.
	const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`)/g;
	let lastIndex = 0;
	let key = 0;
	let match: RegExpExecArray | null = pattern.exec(text);
	while (match !== null) {
		if (match.index > lastIndex) {
			nodes.push(text.slice(lastIndex, match.index));
		}
		const token = match[0];
		if (token.startsWith("**")) {
			nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
		} else if (token.startsWith("`")) {
			nodes.push(
				<code key={key++} className="rounded bg-(--background-subtle) px-1">
					{token.slice(1, -1)}
				</code>,
			);
		} else {
			nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
		}
		lastIndex = match.index + token.length;
		match = pattern.exec(text);
	}
	if (lastIndex < text.length) {
		nodes.push(text.slice(lastIndex));
	}
	return nodes;
}

export function MarkdownPreview({ markdown }: { markdown: string }) {
	const lines = markdown.replace(/\r\n/g, "\n").split("\n");
	const blocks: ReactNode[] = [];
	let key = 0;

	let i = 0;
	while (i < lines.length) {
		const line = lines[i];

		// Fenced code block
		if (line.trimStart().startsWith("```")) {
			const code: string[] = [];
			i++;
			while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
				code.push(lines[i]);
				i++;
			}
			i++; // skip closing fence
			blocks.push(
				<pre
					key={key++}
					className="overflow-auto rounded bg-(--background-subtle) p-3 text-xs"
				>
					<code>{code.join("\n")}</code>
				</pre>,
			);
			continue;
		}

		// Headings
		const heading = line.match(/^(#{1,6})\s+(.*)$/);
		if (heading) {
			const level = heading[1].length;
			const content = renderInline(heading[2]);
			const cls =
				level <= 2 ? "font-display font-semibold text-lg" : "font-semibold";
			blocks.push(
				<p key={key++} className={cls}>
					{content}
				</p>,
			);
			i++;
			continue;
		}

		// Blockquote
		if (line.startsWith(">")) {
			blocks.push(
				<blockquote
					key={key++}
					className="border-(--border) border-l-2 pl-3 text-(--foreground-muted) italic"
				>
					{renderInline(line.replace(/^>\s?/, ""))}
				</blockquote>,
			);
			i++;
			continue;
		}

		// Lists (consecutive items)
		if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
			const ordered = /^\s*\d+\.\s+/.test(line);
			const items: ReactNode[] = [];
			while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
				const itemText = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, "");
				items.push(
					<li key={`${items.length}-${itemText}`}>{renderInline(itemText)}</li>,
				);
				i++;
			}
			blocks.push(
				ordered ? (
					<ol key={key++} className="list-inside list-decimal space-y-1">
						{items}
					</ol>
				) : (
					<ul key={key++} className="list-inside list-disc space-y-1">
						{items}
					</ul>
				),
			);
			continue;
		}

		// Blank line
		if (line.trim() === "") {
			i++;
			continue;
		}

		// Paragraph (gather until blank line)
		const para: string[] = [];
		while (
			i < lines.length &&
			lines[i].trim() !== "" &&
			!/^(#{1,6})\s+/.test(lines[i]) &&
			!lines[i].startsWith(">") &&
			!/^\s*([-*]|\d+\.)\s+/.test(lines[i]) &&
			!lines[i].trimStart().startsWith("```")
		) {
			para.push(lines[i]);
			i++;
		}
		// Soft line breaks within a paragraph are preserved via pre-line;
		// inline markdown is parsed against the joined text.
		blocks.push(
			<p key={key++} className="whitespace-pre-line leading-relaxed">
				{renderInline(para.join("\n"))}
			</p>,
		);
	}

	return <div className="space-y-3 text-sm">{blocks}</div>;
}
