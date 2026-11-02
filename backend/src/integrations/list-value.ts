import { z } from "zod";
import type { SyncRecord } from "./reconcile";

export const listItemSchema = z.object({
	mediaType: z.enum(["movie", "show", "season", "episode"]),
	mediaId: z
		.string()
		.regex(/^[1-9]\d*$/)
		.nullable(),
	season: z.number().int().nonnegative(),
	episode: z.number().int().nonnegative(),
	notes: z.string(),
});
export type ListMember = z.infer<typeof listItemSchema>;
export const listValueSchema = z.object({
	name: z.string().min(1),
	description: z.string(),
	items: z.array(listItemSchema),
});
export type ListValue = z.infer<typeof listValueSchema>;
export function memberKey(item: ListMember) {
	item = normalizeMember(item);
	return `${item.mediaType}:${item.mediaId}:${item.season}:${item.episode}`;
}
export function listValue(record: SyncRecord): ListValue {
	return listValueSchema.parse(JSON.parse(String(record.value)));
}
export function encodeList(value: ListValue): string {
	return JSON.stringify(
		listValueSchema.parse({
			...value,
			items: value.items.map(normalizeMember),
		}),
	);
}
export function validateList(value: ListValue) {
	if (value.name.length > 100 || value.description.length > 500)
		throw new Error(
			"This List's name or description exceeds Opnshelf's limits. Shorten it before retrying; no text was truncated.",
		);
	if (value.items.some((item) => !item.mediaId))
		throw new Error(
			"This List contains a title without a TMDB match. Resolve it on Trakt before retrying; the List is preserved.",
		);
	if (new Set(value.items.map(memberKey)).size !== value.items.length)
		throw new Error(
			"This List contains duplicate memberships that cannot be represented. The List is preserved.",
		);
}

/** Existing List records also use scoped show IDs; retain their media identity. */
function normalizeMember(item: ListMember): ListMember {
	if (item.mediaType !== "show" || !item.mediaId) return item;
	const match = /^(\d+):season:(\d+)(?::episode:(\d+))?$/.exec(item.mediaId);
	if (!match) return item;
	return {
		...item,
		mediaType: match[3] === undefined ? "season" : "episode",
		mediaId: match[1],
		season: Number(match[2]),
		episode: Number(match[3] ?? 0),
	};
}
