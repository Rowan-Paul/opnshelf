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
				? { $type: "app.offprint.richtext.facet#bold" }
				: run.type === "italic"
					? { $type: "app.offprint.richtext.facet#italic" }
					: run.type === "code"
						? { $type: "app.offprint.richtext.facet#code" }
						: run.type === "link"
							? { $type: "app.offprint.richtext.facet#link", uri: run.href }
							: null;
		if (feature && byteStart !== byteEnd) {
			facets.push({
				$type: "app.offprint.richtext.facet",
				index: { byteStart, byteEnd },
				features: [feature],
			});
		}
	}
	return {
		$type: "app.offprint.block.text",
		plaintext,
		...(facets.length && { facets }),
	};
}

/** Offprint's supported portable subset is a sequence of rich text blocks. */
export function documentToOffprintContent(
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
	return { $type: "app.offprint.content", items };
}
