import { z } from "zod";
import type { TraktSyncClient } from "./trakt-sync.client";
import { listMemberPayload } from "./remote-lists";
import {
	contentValue,
	encodeContent,
	validateOutboundContent,
	type ContentKind,
	type ContentOptions,
} from "./content-value";
import { equivalent, fingerprint, type SyncRecord } from "./reconcile";

type Api = Pick<TraktSyncClient, "request">;
const object = z.record(z.string(), z.unknown());
const media = z.object({
	title: z.string().optional(),
	ids: z.object({
		trakt: z.number().int().positive(),
		tmdb: z.number().int().positive().nullish(),
	}),
	season: z.number().int().nonnegative().optional(),
	number: z.number().int().nonnegative().optional(),
});
const note = z.object({
	id: z.number().int().positive(),
	notes: z.string().nullish(),
	privacy: z.enum(["public", "private", "friends"]),
	spoiler: z.boolean().optional(),
	created_at: z.string().datetime().optional(),
	item: object.optional(),
});
const comment = z.object({
	id: z.number().int().positive(),
	comment: z.string(),
	spoiler: z.boolean(),
	review: z.boolean(),
	parent_id: z.number().nullable().optional(),
	created_at: z.string().datetime().optional(),
});
async function pages(api: Api, token: string, path: string) {
	const result: Record<string, unknown>[] = [];
	const cursors = new Set<string>();
	let total: number | undefined;
	let pageCount: number | undefined;
	for (let page = 1; ; page++) {
		const response = await api.request(
			`${path}${path.includes("?") ? "&" : "?"}page=${page}&limit=100`,
			token,
		);
		const count = response.headers.get("x-pagination-item-count");
		const countPages = response.headers.get("x-pagination-page-count");
		if (
			count === null ||
			countPages === null ||
			!/^\d+$/.test(count) ||
			!/^\d+$/.test(countPages)
		)
			throw new Error(
				"Trakt content pagination is incomplete. No removals were applied.",
			);
		if (total === undefined) {
			total = Number(count);
			pageCount = Number(countPages);
		}
		if (total !== Number(count) || pageCount !== Number(countPages))
			throw new Error(
				"Trakt content changed during pagination. No removals were applied.",
			);
		const rows = z.array(object).parse(response.data);
		for (const row of rows) {
			const identity = JSON.stringify(row);
			if (cursors.has(identity))
				throw new Error(
					"Trakt content pagination repeated an item. No removals were applied.",
				);
			cursors.add(identity);
		}
		result.push(...rows);
		if (page >= Number(countPages)) break;
		if (!rows.length)
			throw new Error(
				"Trakt content pagination ended early. No removals were applied.",
			);
	}
	if (result.length !== total)
		throw new Error(
			"Trakt content snapshot is incomplete. No removals were applied.",
		);
	return result;
}
function coordinates(
	kind: ContentKind,
	raw: Record<string, unknown>,
): SyncRecord {
	const type = z
		.enum(["movie", "show", "season", "episode"])
		.safeParse(raw.type);
	if (!type.success)
		return {
			key: `${kind}:unsupported:${String(raw.id ?? "attachment")}`,
			kind,
			mediaType: "list",
			mediaId: null,
			season: 0,
			episode: 0,
			title: `Unsupported ${kind} attachment`,
			value: encodeContent({}),
			problem:
				"This attachment type has no Opnshelf equivalent. The original is preserved.",
		};
	const item = media.parse(raw[type.data]);
	const parent = type.data === "movie" ? item : media.parse(raw.show ?? item);
	return {
		key: `${kind}:${type.data}:${item.ids.trakt}`,
		kind,
		mediaType: type.data,
		mediaId: parent.ids.tmdb?.toString() ?? null,
		season:
			type.data === "season"
				? (item.number ?? 0)
				: type.data === "episode"
					? (item.season ?? 0)
					: 0,
		episode: type.data === "episode" ? (item.number ?? 0) : 0,
		title: parent.title ?? `${type.data} ${parent.ids.trakt}`,
		traktId: item.ids.trakt,
		traktParentId: parent.ids.trakt,
		value: encodeContent({}),
	};
}
export async function snapshotContent(
	api: Api,
	token: string,
	options: ContentOptions,
): Promise<SyncRecord[]> {
	const result: SyncRecord[] = [];
	if (options.notes) {
		for (const raw of await pages(api, token, "/users/me/notes/all")) {
			const n = note.parse(raw);
			const attachment =
				n.item?.type && n.item[n.item.type as string]
					? n.item
					: object.parse(
							(await api.request(`/notes/${n.id}/item`, token)).data,
						);
			const record = coordinates("note", attachment);
			result.push({
				...record,
				key: `note:${n.id}`,
				traktId: n.id,
				value: encodeContent({
					content: n.notes ?? "",
					spoiler: n.spoiler ?? false,
				}),
				visibility: n.privacy === "public" ? "public" : "private",
				createdAt: n.created_at,
				problem:
					record.problem ??
					(n.spoiler
						? "This Note's spoiler flag has no Opnshelf equivalent. Remove the flag on Trakt or keep it out of sync."
						: undefined),
			});
		}
	}
	if (options.reviews) {
		for (const raw of await pages(api, token, "/users/me/comments/all/all")) {
			const c = comment.parse(raw.comment);
			if (c.parent_id) continue;
			const record = coordinates("review", raw);
			result.push({
				...record,
				key: `review:${c.id}`,
				traktId: c.id,
				value: encodeContent({
					content: c.comment,
					spoiler: c.spoiler || /\[spoiler\]/i.test(c.comment),
				}),
				visibility: "public",
				createdAt: c.created_at,
				problem:
					record.problem ??
					(!c.review
						? "This is a short Trakt comment, not a Review. It was preserved on Trakt; ignore it to keep it out of sync."
						: undefined),
			});
		}
	}
	if (options.library) {
		const settings = z
			.object({ user: z.object({ private: z.boolean() }) })
			.parse((await api.request("/users/settings", token)).data);
		for (const raw of await pages(
			api,
			token,
			"/sync/collection/media?extended=metadata",
		)) {
			const record = coordinates("library", raw);
			const metadata = object.parse(raw.metadata ?? {});
			const format =
				metadata.media_type === "bluray" && metadata.resolution === "uhd_4k"
					? "bluray4k"
					: metadata.media_type;
			const unsupported = Object.entries(metadata).some(
				([key, value]) =>
					value !== null &&
					value !== undefined &&
					!["media_type", "resolution"].includes(key),
			);
			const resolutionLost =
				metadata.resolution != null &&
				!(format === "bluray4k" && metadata.resolution === "uhd_4k");
			result.push({
				...record,
				visibility: settings.user.private ? "private" : "public",
				createdAt: z.string().datetime().parse(raw.collected_at),
				value: encodeContent({
					format: typeof format === "string" ? format : "",
				}),
				problem:
					record.problem ??
					(unsupported || resolutionLost
						? "This collection item has video/audio metadata that Opnshelf cannot represent. The original is preserved."
						: !["digital", "bluray", "bluray4k", "dvd"].includes(String(format))
							? "Trakt did not supply a supported ownership format. No Digital format was assumed."
							: undefined),
			});
		}
	}
	if (new Set(result.map((r) => r.key)).size !== result.length)
		throw new Error(
			"Trakt returned duplicate content identities. No removals were applied.",
		);
	return result;
}
function optionsFor(record: SyncRecord): ContentOptions {
	return {
		notes: record.kind === "note",
		library: record.kind === "library",
		reviews: record.kind === "review",
	};
}
export async function writeContent(
	api: Api,
	token: string,
	desired: SyncRecord,
	remove: boolean,
	previous?: SyncRecord | null,
	onCreated?: (record: SyncRecord) => Promise<void>,
) {
	if (!remove) validateOutboundContent(desired);
	const records = await snapshotContent(api, token, optionsFor(desired));
	const expected = remove ? desired : previous;
	const current = expected
		? (records.find((r) => r.key === expected.key) ?? null)
		: null;
	if (expected && fingerprint(current) !== fingerprint(expected))
		throw new Error(
			"Trakt content changed before transfer. Choose which version to keep.",
		);
	const value = contentValue(desired);
	let id = remove ? desired.traktId : previous?.traktId;
	if (remove) {
		if (!id)
			throw new Error("Missing linked Trakt identity. Nothing was deleted.");
		if (desired.kind === "library") {
			const body = await listMemberPayload(
				api,
				token,
				{
					mediaType: desired.mediaType as
						| "movie"
						| "show"
						| "season"
						| "episode",
					mediaId: desired.mediaId,
					season: desired.season,
					episode: desired.episode,
					notes: "",
				},
				false,
			);
			await api.request("/sync/collection/remove", token, body);
		} else
			await api.request(
				`/${desired.kind === "note" ? "notes" : "comments"}/${id}`,
				token,
				undefined,
				"DELETE",
			);
		return;
	}
	const mediaBody = await listMemberPayload(
		api,
		token,
		{
			mediaType: desired.mediaType as "movie" | "show" | "season" | "episode",
			mediaId: desired.mediaId,
			season: desired.season,
			episode: desired.episode,
			notes: "",
		},
		false,
	);
	const item = Object.values(mediaBody)[0][0];
	if (desired.kind === "library") {
		const rows = records.filter(
			(r) =>
				r.mediaType === desired.mediaType &&
				r.mediaId === desired.mediaId &&
				r.season === desired.season &&
				r.episode === desired.episode,
		);
		if (rows.some((r) => r.problem || r.key !== previous?.key))
			throw new Error(
				"The destination collection contains unrepresentable ownership details. Nothing was overwritten.",
			);
		const body = {
			[`${desired.mediaType}s`]: [
				{
					...item,
					collected_at: desired.createdAt ?? new Date().toISOString(),
					media_type: value.format === "bluray4k" ? "bluray" : value.format,
					...(value.format === "bluray4k" ? { resolution: "uhd_4k" } : {}),
				},
			],
		};
		await api.request("/sync/collection", token, body);
	} else {
		const path = desired.kind === "note" ? "/notes" : "/comments";
		const body =
			desired.kind === "note"
				? {
						notes: value.content,
						spoiler: false,
						...(previous
							? {}
							: {
									privacy: desired.visibility ?? "private",
									item: { type: desired.mediaType, [desired.mediaType]: item },
								}),
					}
				: {
						comment: value.content,
						spoiler: value.spoiler,
						...(previous ? {} : { [desired.mediaType]: item }),
					};
		const response = await api.request(
			`${path}${id ? `/${id}` : ""}`,
			token,
			body,
			id ? "PUT" : "POST",
		);
		if (!id) {
			id = z
				.object({ id: z.number().int().positive() })
				.parse(response.data).id;
			await onCreated?.({
				...desired,
				key: `${desired.kind}:${id}`,
				traktId: id,
			});
		}
	}
	const after = await snapshotContent(api, token, optionsFor(desired));
	if (
		!after.some(
			(r) => (id === undefined || r.traktId === id) && equivalent(r, desired),
		)
	)
		throw new Error(
			"Trakt has not confirmed this item. Choose which version to keep.",
		);
}
