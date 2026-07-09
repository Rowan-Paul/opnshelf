import { describe, expect, it } from "vitest";
import { documentToLeafletContent } from "./leaflet";
import { markdownToDocument } from "./markdown-to-doc";

describe("Leaflet mirror serializer", () => {
	it("uses UTF-8 byte offsets for rich-text facets", () => {
		const content = documentToLeafletContent(
			markdownToDocument("🌍 **café** and [link](https://example.com)"),
		) as {
			pages: Array<{
				blocks: Array<{
					block: {
						plaintext: string;
						facets: Array<{ index: { byteStart: number; byteEnd: number } }>;
					};
				}>;
			}>;
		};

		const block = content.pages[0].blocks[0].block;
		expect(block.plaintext).toBe("🌍 café and link");
		// 🌍 occupies four UTF-8 bytes, unlike its two UTF-16 code units in JS.
		expect(block.facets[0].index).toEqual({ byteStart: 5, byteEnd: 10 });
		expect(block.facets[1].index).toEqual({ byteStart: 15, byteEnd: 19 });
	});

	it("preserves headings, lists, quotes, and code as Leaflet blocks", () => {
		const content = documentToLeafletContent(
			markdownToDocument(
				"# Title\n\n- one\n- two\n\n> note\n\n```ts\nconst x = 1\n```",
			),
		) as { pages: Array<{ blocks: Array<{ block: { $type: string } }> }> };

		expect(content.pages[0].blocks.map(({ block }) => block.$type)).toEqual([
			"pub.leaflet.blocks.header",
			"pub.leaflet.blocks.unorderedList",
			"pub.leaflet.blocks.blockquote",
			"pub.leaflet.blocks.code",
		]);
	});
});
