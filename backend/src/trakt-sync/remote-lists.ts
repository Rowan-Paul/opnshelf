import { z } from "zod";
import type { TraktSyncClient } from "./trakt-sync.client";
import {
	encodeList,
	listValue,
	memberKey,
	validateList,
	type ListMember,
} from "./list-value";
import { equivalent, fingerprint, type SyncRecord } from "./reconcile";

type Api = Pick<TraktSyncClient, "request">;
const metadataSchema = z.object({
	name: z.string().min(1),
	description: z.string().nullish(),
	privacy: z.enum(["private", "friends", "link", "public"]),
	ids: z.object({ trakt: z.number().int().positive() }),
	item_count: z.number().int().nonnegative(),
	updated_at: z.string(),
});
const mediaSchema = z.object({
	ids: z.object({
		trakt: z.number().int().positive(),
		tmdb: z.number().int().positive().nullish(),
	}),
	season: z.number().int().nonnegative().optional(),
	number: z.number().int().nonnegative().optional(),
});
const rowSchema = z.object({
	id: z.number().int().positive(),
	rank: z.number().int().nonnegative(),
	notes: z.string().nullish(),
	type: z.string(),
	movie: mediaSchema.optional(),
	show: mediaSchema.optional(),
	season: mediaSchema.optional(),
	episode: mediaSchema.optional(),
});
type Row = z.infer<typeof rowSchema>;
async function pages(api: Api, token: string, path: string) {
	const rows: Row[] = [];
	let total: number | undefined;
	let pageCount: number | undefined;
	for (let page = 1; ; page++) {
		const { data, headers } = await api.request(
			`${path}?page=${page}&limit=100`,
			token,
		);
		const count = headers.get("x-pagination-item-count");
		const countPages = headers.get("x-pagination-page-count");
		if (
			count === null ||
			countPages === null ||
			!Number.isInteger(Number(count)) ||
			Number(count) < 0 ||
			!Number.isInteger(Number(countPages)) ||
			Number(countPages) < 0
		)
			throw new Error(
				"Trakt List pagination was incomplete. No removals were applied.",
			);
		if (total === undefined) {
			total = Number(count);
			pageCount = Number(countPages);
		}
		if (total !== Number(count) || pageCount !== Number(countPages))
			throw new Error(
				"Trakt List changed during pagination. No removals were applied.",
			);
		const items = z.array(rowSchema).parse(data);
		rows.push(...items);
		if (page >= Number(countPages)) break;
		if (!items.length)
			throw new Error("Trakt returned an incomplete List page.");
	}
	if (
		rows.length !== total ||
		new Set(rows.map((r) => r.id)).size !== rows.length
	)
		throw new Error(
			"Trakt returned incomplete or duplicate List memberships. No removals were applied.",
		);
	return rows.sort((a, b) => a.rank - b.rank);
}
function member(row: Row): ListMember | null {
	if (
		row.type !== "movie" &&
		row.type !== "show" &&
		row.type !== "season" &&
		row.type !== "episode"
	)
		return null;
	const item = row[row.type];
	if (!item) throw new Error("Trakt returned an invalid List membership.");
	return {
		mediaType: row.type,
		mediaId:
			(row.type === "movie" ? row.movie : row.show)?.ids.tmdb?.toString() ??
			null,
		season:
			row.type === "season"
				? (item.number ?? 0)
				: row.type === "episode"
					? (item.season ?? 0)
					: 0,
		episode: row.type === "episode" ? (item.number ?? 0) : 0,
		notes: row.notes ?? "",
	};
}
function record(
	metadata: {
		name: string;
		description?: string | null;
		privacy: string;
		ids: { trakt: number };
	} | null,
	rows: Row[],
	watchlistVisibility: "public" | "private" = "private",
): SyncRecord {
	const kind = metadata ? "list" : "watchlist";
	const items = rows.map(member);
	return {
		key: metadata ? `list:${metadata.ids.trakt}` : "watchlist:trakt",
		kind,
		mediaType: "list",
		mediaId: null,
		title: metadata?.name ?? "Watchlist",
		season: 0,
		episode: 0,
		traktId: metadata?.ids.trakt,
		visibility: metadata
			? metadata.privacy === "public"
				? "public"
				: "private"
			: watchlistVisibility,
		problem: items.some((i) => !i)
			? "This List contains unsupported media types. They remain on Trakt; remove them or keep this List out of sync."
			: undefined,
		value: encodeList({
			name: metadata?.name ?? "Watchlist",
			description: metadata?.description ?? "",
			items: items.filter((i): i is ListMember => i !== null),
		}),
	};
}
async function customLists(api: Api, token: string) {
	return z
		.array(metadataSchema)
		.parse((await api.request("/users/me/lists", token)).data);
}
export async function snapshotLists(
	api: Api,
	token: string,
	options: { lists?: boolean; watchlist?: boolean },
): Promise<SyncRecord[]> {
	const result: SyncRecord[] = [];
	if (options.lists) {
		const before = await customLists(api, token);
		for (const list of before) {
			// No type filter: unsupported records must remain visible instead of appearing deleted.
			const rows = await pages(
				api,
				token,
				`/users/me/lists/${list.ids.trakt}/items`,
			);
			if (rows.length !== list.item_count)
				throw new Error(
					"Trakt List changed during the read. No removals were applied.",
				);
			result.push(record(list, rows));
		}
		const after = await customLists(api, token);
		if (JSON.stringify(before) !== JSON.stringify(after))
			throw new Error(
				"Trakt Lists changed during the read. No removals were applied.",
			);
	}
	if (options.watchlist) {
		const settings = z
			.object({ user: z.object({ private: z.boolean() }) })
			.parse((await api.request("/users/settings", token)).data);
		result.push(
			record(
				null,
				await pages(api, token, "/sync/watchlist/all/rank/asc"),
				settings.user.private ? "private" : "public",
			),
		);
	}
	return result;
}
async function payload(api: Api, token: string, item: ListMember) {
	const type = item.mediaType === "movie" ? "movie" : "show";
	const response = await api.request(
		`/search/tmdb/${item.mediaId}?type=${type}`,
		token,
	);
	const matches = z
		.array(
			z.object({
				type: z.string(),
				movie: mediaSchema.optional(),
				show: mediaSchema.optional(),
			}),
		)
		.parse(response.data)
		.filter(
			(r) => r.type === type && r[type]?.ids.tmdb?.toString() === item.mediaId,
		);
	if (matches.length !== 1)
		throw new Error(
			"Trakt could not uniquely match a List membership. Nothing was removed.",
		);
	let id = matches[0][type]?.ids.trakt;
	if (!id) throw new Error("Trakt did not return a List membership identity.");
	if (item.mediaType === "season") {
		const seasons = z
			.array(mediaSchema)
			.parse((await api.request(`/shows/${id}/seasons`, token)).data);
		const season = seasons.find((s) => s.number === item.season);
		if (!season)
			throw new Error(
				"Trakt could not match this season. Nothing was removed.",
			);
		id = season.ids.trakt;
	}
	if (item.mediaType === "episode")
		id = mediaSchema.parse(
			(
				await api.request(
					`/shows/${id}/seasons/${item.season}/episodes/${item.episode}`,
					token,
				)
			).data,
		).ids.trakt;
	return {
		[`${item.mediaType}s`]: [
			{ ids: { trakt: id }, ...(item.notes ? { notes: item.notes } : {}) },
		],
	};
}
function assertOutcome(data: unknown) {
	const outcome = z
		.object({
			not_found: z.record(z.string(), z.array(z.unknown())).optional(),
		})
		.parse(data);
	if (Object.values(outcome.not_found ?? {}).some((items) => items.length))
		throw new Error(
			"Trakt could not match a List membership. No memberships were removed.",
		);
}
export async function writeList(
	api: Api,
	token: string,
	desired: SyncRecord,
	remove: boolean,
	previous?: SyncRecord | null,
	onCreated?: (record: SyncRecord) => Promise<void>,
) {
	if (desired.kind === "watchlist" && remove)
		throw new Error(
			"The watchlist cannot be deleted. Remove its memberships instead.",
		);
	if (remove) {
		if (!desired.traktId) throw new Error("Missing Trakt List identity.");
		await api.request(
			`/users/me/lists/${desired.traktId}`,
			token,
			undefined,
			"DELETE",
		);
		return;
	}
	const value = listValue(desired);
	validateList(value);
	if (value.items.some((i) => i.notes.length > 500))
		throw new Error(
			"A List note exceeds Trakt's 500-character limit. No text was truncated.",
		);
	// Resolve every membership before any destructive operation.
	const bodies = [];
	for (const item of value.items) bodies.push(await payload(api, token, item));
	let id = desired.traktId;
	if (desired.kind === "list" && !id) {
		const created = metadataSchema.parse(
			(
				await api.request("/users/me/lists", token, {
					name: value.name,
					description: value.description,
					privacy: desired.visibility ?? "private",
					sort_by: "rank",
					sort_how: "asc",
				})
			).data,
		);
		id = created.ids.trakt;
		await onCreated?.(record(created, []));
	}
	const base =
		desired.kind === "watchlist"
			? "/sync/watchlist"
			: `/users/me/lists/${id}/items`;
	const rows = await pages(
		api,
		token,
		`${base}${desired.kind === "watchlist" ? "/all/rank/asc" : ""}`,
	);
	if (previous !== undefined && previous !== null) {
		const metadata =
			desired.kind === "list"
				? metadataSchema.parse(
						(await api.request(`/users/me/lists/${id}`, token)).data,
					)
				: null;
		const current = record(metadata, rows, previous.visibility);
		if (fingerprint(current) !== fingerprint(previous))
			throw new Error(
				"The Trakt List changed before transfer. Choose which version to keep.",
			);
	}
	const existing = rows.map((row) => ({ row, item: member(row) }));
	if (existing.some((i) => !i.item))
		throw new Error(
			"The destination List contains unsupported media. Nothing was removed.",
		);
	if (desired.kind === "list")
		await api.request(
			`/users/me/lists/${id}`,
			token,
			{ name: value.name, description: value.description },
			"PUT",
		);
	for (let index = 0; index < value.items.length; index++) {
		const item = value.items[index];
		const old = existing.find(
			(i) => i.item && memberKey(i.item) === memberKey(item),
		);
		if (!old)
			assertOutcome((await api.request(base, token, bodies[index])).data);
		else if (old.item?.notes !== item.notes)
			await api.request(
				`${base}/${old.row.id}`,
				token,
				{ notes: item.notes || null },
				"PUT",
			);
	}
	for (const old of existing) {
		const oldItem = old.item;
		if (!oldItem) throw new Error("Unsupported destination List membership.");
		if (value.items.some((i) => memberKey(i) === memberKey(oldItem))) continue;
		const item = old.row[oldItem.mediaType];
		if (!item) throw new Error("Missing destination membership identity.");
		assertOutcome(
			(
				await api.request(`${base}/remove`, token, {
					[`${old.row.type}s`]: [{ ids: { trakt: item.ids.trakt } }],
				})
			).data,
		);
	}
	const current = await pages(
		api,
		token,
		`${base}${desired.kind === "watchlist" ? "/all/rank/asc" : ""}`,
	);
	const rank = value.items.map(
		(i) =>
			current.find((r) => {
				const m = member(r);
				return m && memberKey(m) === memberKey(i);
			})?.id,
	);
	if (rank.some((v) => !v) || current.length !== rank.length)
		throw new Error(
			"Trakt List changed during transfer. Choose which version to keep.",
		);
	if (rank.length) {
		const path =
			desired.kind === "watchlist"
				? "/sync/watchlist/reorder"
				: `/users/me/lists/${id}/items/reorder`;
		const outcome = z
			.object({ skipped_ids: z.array(z.number()), updated: z.number() })
			.parse((await api.request(path, token, { rank })).data);
		if (outcome.skipped_ids.length)
			throw new Error(
				"Trakt did not confirm the List order. Retry to reconcile.",
			);
	}
	const confirmation = await snapshotLists(api, token, {
		lists: desired.kind === "list",
		watchlist: desired.kind === "watchlist",
	});
	if (!confirmation.some((r) => equivalent(r, desired)))
		throw new Error(
			"Trakt has not confirmed this List. Choose which version to keep.",
		);
}
