import { z } from "zod";
import type { SyncRecord } from "./reconcile";

export type ContentKind = "note" | "library" | "review";
export type ContentOptions = {
	notes?: boolean;
	library?: boolean;
	reviews?: boolean;
};
export const contentValueSchema = z.object({
	content: z.string().default(""),
	spoiler: z.boolean().default(false),
	format: z.string().default(""),
	boxSet: z.string().default(""),
	notes: z.string().default(""),
});
export function contentValue(record: SyncRecord) {
	return contentValueSchema.parse(JSON.parse(String(record.value)));
}
export function encodeContent(value: z.input<typeof contentValueSchema>) {
	return JSON.stringify(contentValueSchema.parse(value));
}
export function isContentRecord(record: {
	kind: string;
}): record is { kind: ContentKind } {
	return ["note", "library", "review"].includes(record.kind);
}
export function validateContent(record: SyncRecord) {
	if (record.problem) throw new Error(record.problem);
	if (!record.mediaId)
		throw new Error("Choose a TMDB match before transferring this item.");
	const value = contentValue(record);
	if (record.kind === "note" && (value.content.length > 5000 || value.spoiler))
		throw new Error(
			"This Note's length or spoiler flag cannot be represented in Opnshelf. The original Note is preserved.",
		);
	if (
		record.kind === "review" &&
		(!value.content.trim() || value.content.length > 20000)
	)
		throw new Error(
			"This Review exceeds Opnshelf's text limits. No text was truncated.",
		);
	if (
		record.kind === "library" &&
		!["digital", "bluray", "bluray4k", "dvd"].includes(value.format)
	)
		throw new Error(
			"Choose a supported ownership format on Trakt before syncing this Library Item. No Digital format was assumed.",
		);
}
