import { describe, expect, it } from "vitest";
import { markdownToDocument } from "./markdown-to-doc";
import { documentToPcktContent } from "./pckt";

describe("Pckt mirror serializer", () => {
	it("uses Pckt blocks and UTF-8 byte offsets for facets", () => {
		const content = documentToPcktContent(
			markdownToDocument("🌍 **café** and [link](https://example.com)"),
		) as {
			$type: string;
			items: Array<{
				$type: string;
				plaintext: string;
				facets: Array<{ index: { byteStart: number; byteEnd: number } }>;
			}>;
		};

		expect(content.$type).toBe("blog.pckt.content");
		expect(content.items[0].$type).toBe("blog.pckt.block.text");
		expect(content.items[0].plaintext).toBe("🌍 café and link");
		expect(content.items[0].facets[0].index).toEqual({
			byteStart: 5,
			byteEnd: 10,
		});
	});
});
