import type { DocumentBlock, InlineRun } from "./markdown-to-doc";

type LeafletFacet = {
	$type: "pub.leaflet.richtext.facet";
	index: { byteStart: number; byteEnd: number };
	features: Array<{ $type: string; uri?: string }>;
};

type LeafletTextBlock = {
	$type:
		| "pub.leaflet.blocks.text"
		| "pub.leaflet.blocks.header"
		| "pub.leaflet.blocks.blockquote";
	plaintext: string;
	facets?: LeafletFacet[];
	level?: number;
};

function byteLength(value: string): number {
	return new TextEncoder().encode(value).byteLength;
}

function textBlock(
	runs: InlineRun[],
	type: LeafletTextBlock["$type"] = "pub.leaflet.blocks.text",
	level?: number,
): LeafletTextBlock {
	let plaintext = "";
	const facets: LeafletFacet[] = [];
	for (const run of runs) {
		const byteStart = byteLength(plaintext);
		plaintext += run.text;
		const byteEnd = byteLength(plaintext);
		const feature =
			run.type === "bold"
				? { $type: "pub.leaflet.richtext.facet#bold" }
				: run.type === "italic"
					? { $type: "pub.leaflet.richtext.facet#italic" }
					: run.type === "code"
						? { $type: "pub.leaflet.richtext.facet#code" }
						: run.type === "link"
							? { $type: "pub.leaflet.richtext.facet#link", uri: run.href }
							: null;
		if (feature && byteStart !== byteEnd) {
			facets.push({
				$type: "pub.leaflet.richtext.facet",
				index: { byteStart, byteEnd },
				features: [feature],
			});
		}
	}
	return {
		$type: type,
		plaintext,
		...(facets.length && { facets }),
		...(level && { level }),
	};
}

function leafBlock(block: DocumentBlock): Record<string, unknown> {
	switch (block.type) {
		case "heading":
			return textBlock(block.runs, "pub.leaflet.blocks.header", block.level);
		case "blockquote":
			return textBlock(block.runs, "pub.leaflet.blocks.blockquote");
		case "codeBlock":
			return {
				$type: "pub.leaflet.blocks.code",
				plaintext: block.code,
				...(block.language && { language: block.language }),
			};
		case "list":
			return {
				$type: block.ordered
					? "pub.leaflet.blocks.orderedList"
					: "pub.leaflet.blocks.unorderedList",
				children: block.items.map((runs) => ({ content: textBlock(runs) })),
			};
		case "paragraph":
			return textBlock(block.runs);
	}
}

/** Serialise the app-neutral document model to Leaflet's rich content union. */
export function documentToLeafletContent(
	blocks: DocumentBlock[],
): Record<string, unknown> {
	return {
		$type: "pub.leaflet.content",
		pages: [
			{
				$type: "pub.leaflet.pages.linearDocument",
				blocks: blocks.map((block) => ({
					$type: "pub.leaflet.pages.linearDocument#block",
					block: leafBlock(block),
				})),
			},
		],
	};
}
