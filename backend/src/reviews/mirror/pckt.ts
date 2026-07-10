import type { DocumentBlock, InlineRun } from "./markdown-to-doc";

function byteLength(value: string): number {
	return new TextEncoder().encode(value).byteLength;
}

function textItem(runs: InlineRun[]): Record<string, unknown> {
	let plaintext = "";
	const facets: Array<Record<string, unknown>> = [];
	for (const run of runs) {
		const byteStart = byteLength(plaintext);
		plaintext += run.text;
		const byteEnd = byteLength(plaintext);
		const feature =
			run.type === "bold"
				? { $type: "blog.pckt.richtext.facet#bold" }
				: run.type === "italic"
					? { $type: "blog.pckt.richtext.facet#italic" }
					: run.type === "code"
						? { $type: "blog.pckt.richtext.facet#code" }
						: run.type === "link"
							? { $type: "blog.pckt.richtext.facet#link", uri: run.href }
							: null;
		if (feature && byteStart !== byteEnd) {
			facets.push({
				$type: "blog.pckt.richtext.facet",
				index: { byteStart, byteEnd },
				features: [feature],
			});
		}
	}
	return {
		$type: "blog.pckt.block.text",
		plaintext,
		...(facets.length && { facets }),
	};
}

/** Pckt's supported portable subset is a sequence of rich text blocks. */
export function documentToPcktContent(
	blocks: DocumentBlock[],
): Record<string, unknown> {
	const items = blocks.flatMap((block) => {
		switch (block.type) {
			case "heading":
				return [
					textItem([
						{ type: "bold", text: `${"#".repeat(block.level)} ` },
						...block.runs,
					]),
				];
			case "blockquote":
				return [textItem([{ type: "text", text: "> " }, ...block.runs])];
			case "codeBlock":
				return [textItem([{ type: "code", text: block.code }])];
			case "list":
				return block.items.map((runs, index) =>
					textItem([
						{ type: "text", text: block.ordered ? `${index + 1}. ` : "• " },
						...runs,
					]),
				);
			case "paragraph":
				return [textItem(block.runs)];
		}
		return [];
	});
	return { $type: "blog.pckt.content", items };
}
