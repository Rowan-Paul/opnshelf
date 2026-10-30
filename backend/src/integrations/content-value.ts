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

/** Validate export constraints before recording an uncertain remote write. */
export function validateOutboundContent(desired: SyncRecord) {
	validateContent(desired);
	const value = contentValue(desired);
	if (
		desired.kind === "review" &&
		value.content.trim().split(/\s+/u).length < 200
	)
		throw new Error(
			"Trakt classifies Reviews at 200 words. Shorter text stays in Opnshelf; no text was padded.",
		);
	if (desired.kind === "library" && (value.notes || value.boxSet))
		throw new Error(
			"Trakt collection cannot represent this item's notes or Box Set. Your Library Item is preserved.",
		);
	if (desired.kind === "library" && desired.visibility === "private")
		throw new Error(
			"Private Library Items cannot be sent until Trakt collection privacy is verified.",
		);
	if (
		desired.kind === "review" &&
		/\[\/?spoiler\]/i.test(value.content) &&
		!value.spoiler
	)
		throw new Error(
			"Mark this Review as containing spoilers before sending it to Trakt.",
		);
}
