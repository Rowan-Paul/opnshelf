import { z } from "zod";
import type { TraktSyncClient } from "./trakt-sync.client";
import {
	encodeList,
	listValue,
	memberKey,
	validateList,
	type ListMember,
} from "../integrations/list-value";
import {
	equivalent,
	fingerprint,
	type SyncRecord,
} from "../integrations/reconcile";

type Api = Pick<TraktSyncClient, "request">;
class ListReadError extends Error {}
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
			throw new ListReadError(
				"Trakt List pagination was incomplete. No removals were applied.",
			);
		if (total === undefined) {
			total = Number(count);
			pageCount = Number(countPages);
		}
		if (total !== Number(count) || pageCount !== Number(countPages))
			throw new ListReadError(
				"Trakt List changed during pagination. No removals were applied.",
			);
		const items = z.array(rowSchema).parse(data);
		rows.push(...items);
		if (page >= Number(countPages)) break;
		if (!items.length)
			throw new ListReadError("Trakt returned an incomplete List page.");
	}
	if (rows.length !== total)
		throw new ListReadError(
			`Trakt returned an incomplete List (${rows.length} of ${total} items). No removals were applied.`,
		);
	if (new Set(rows.map((r) => r.id)).size !== rows.length)
		throw new ListReadError(
			"Trakt returned duplicate List memberships. No removals were applied.",
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
	defaultKind: "watchlist" | "favorites" = "watchlist",
): SyncRecord {
	const kind = metadata ? "list" : defaultKind;
	const defaultName = defaultKind === "favorites" ? "Favorites" : "Watchlist";
	const items = rows.map(member);
	return {
		key: metadata ? `list:${metadata.ids.trakt}` : `${defaultKind}:trakt`,
		kind,
		mediaType: "list",
		mediaId: null,
		title: metadata?.name ?? defaultName,
		season: 0,
		episode: 0,
		remoteId: metadata?.ids.trakt,
		visibility: metadata
			? metadata.privacy === "public"
				? "public"
				: "private"
			: watchlistVisibility,
		problem: items.some(
			(i) =>
				!i ||
				(kind === "favorites" &&
					i.mediaType !== "movie" &&
					i.mediaType !== "show"),
		)
			? "This List contains unsupported media types. They remain on Trakt; remove them or keep this List out of sync."
			: items.some((i) => !i?.mediaId)
				? "This List contains a title without a TMDB match. Resolve it on Trakt before retrying; the List is preserved."
				: undefined,
		value: encodeList({
			name: metadata?.name ?? defaultName,
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
function unreadable(list: SyncRecord, problem: string): SyncRecord {
	return { ...list, value: null, unreadable: true, problem };
}
async function readList(list: SyncRecord, read: () => Promise<SyncRecord>) {
	try {
		return await read();
	} catch (error) {
		// Authentication and provider-wide backoff still apply to the account.
		if (
			error &&
			typeof error === "object" &&
			"status" in error &&
			[401, 429].includes(Number(error.status))
		)
			throw error;
		return unreadable(
			list,
			error instanceof ListReadError
				? error.message
				: "Trakt could not read this List. Retry in Needs attention; the List is preserved.",
		);
	}
}
export async function snapshotLists(
	api: Api,
	token: string,
	options: {
		lists?: boolean;
		watchlist?: boolean;
		favorites?: boolean;
		listId?: number;
	},
): Promise<SyncRecord[]> {
	const result: SyncRecord[] = [];
	if (options.lists) {
		const selected = (list: z.infer<typeof metadataSchema>) =>
			options.listId === undefined || list.ids.trakt === options.listId;
		const before = (await customLists(api, token)).filter(selected);
		for (const list of before) {
			result.push(
				await readList(record(list, []), async () => {
					// No type filter: unsupported records must remain visible instead of appearing deleted.
					const rows = await pages(
						api,
						token,
						`/users/me/lists/${list.ids.trakt}/items`,
					);
					if (rows.length !== list.item_count)
						throw new ListReadError(
							"Trakt List changed during the read. No removals were applied.",
						);
					return record(list, rows);
				}),
			);
		}
		const after = (await customLists(api, token)).filter(selected);
		const afterById = new Map(after.map((list) => [list.ids.trakt, list]));
		const beforeIds = new Set(before.map((list) => list.ids.trakt));
		for (let i = 0; i < before.length; i++) {
			if (
				JSON.stringify(before[i]) !==
				JSON.stringify(afterById.get(before[i].ids.trakt))
			)
				result[i] = unreadable(
					result[i],
					"Trakt List changed during the read. Retry in Needs attention; no removals were applied.",
				);
		}
		for (const list of after) {
			if (!beforeIds.has(list.ids.trakt))
				result.push(
					unreadable(
						record(list, []),
						"Trakt List changed during the read. Retry in Needs attention; no removals were applied.",
					),
				);
		}
	}
	if (options.watchlist || options.favorites) {
		const settings = z
			.object({ user: z.object({ private: z.boolean() }) })
			.parse((await api.request("/users/settings", token)).data);
		for (const kind of ["watchlist", "favorites"] as const) {
			if (!options[kind]) continue;
			result.push(
				await readList(
					record(null, [], settings.user.private ? "private" : "public", kind),
					async () =>
						record(
							null,
							await pages(api, token, `/sync/${kind}/all/rank/asc`),
							settings.user.private ? "private" : "public",
							kind,
						),
				),
			);
		}
	}
	return result;
}
export async function listMemberPayload(
	api: Api,
	token: string,
	item: ListMember,
	includeNotes = true,
) {
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
			{
				ids: { trakt: id },
				...(includeNotes && item.notes ? { notes: item.notes } : {}),
			},
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
	if (desired.kind !== "list" && remove)
		throw new Error(
			"Default Lists cannot be deleted. Remove their memberships instead.",
		);
	if (remove) {
		if (!desired.remoteId) throw new Error("Missing Trakt List identity.");
		await api.request(
			`/users/me/lists/${desired.remoteId}`,
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
	if (desired.kind === "favorites") {
		if (desired.visibility === "private")
			throw new Error(
				"Private Favorites cannot be sent to Trakt until its Favorites privacy behavior is verified. Your List is preserved.",
			);
		if (
			value.items.some(
				(item) => item.mediaType !== "movie" && item.mediaType !== "show",
			)
		)
			throw new Error(
				"Trakt Favorites supports movies and shows only. Seasons and episodes were preserved; no parent shows were substituted.",
			);
	}
	const identityReads = new Map<
		string,
		Promise<Awaited<ReturnType<Api["request"]>>>
	>();
	const identities: Api = {
		request: (path, requestToken) => {
			let pending = identityReads.get(path);
			if (!pending) {
				pending = api.request(path, requestToken);
				identityReads.set(path, pending);
			}
			return pending;
		},
	};
	const bodies = new Map<
		string,
		Awaited<ReturnType<typeof listMemberPayload>>
	>();
	if (desired.kind === "list" && !desired.remoteId)
		for (const item of value.items)
			bodies.set(
				memberKey(item),
				await listMemberPayload(identities, token, item),
			);
	let id = desired.remoteId;
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
		desired.kind !== "list"
			? `/sync/${desired.kind}`
			: `/users/me/lists/${id}/items`;
	const rows = await pages(
		api,
		token,
		`${base}${desired.kind !== "list" ? "/all/rank/asc" : ""}`,
	);
	if (previous !== undefined && previous !== null) {
		const metadata =
			desired.kind === "list"
				? metadataSchema.parse(
						(await api.request(`/users/me/lists/${id}`, token)).data,
					)
				: null;
		const current = record(
			metadata,
			rows,
			previous.visibility,
			desired.kind === "favorites" ? "favorites" : "watchlist",
		);
		if (fingerprint(current) !== fingerprint(previous))
			throw new Error(
				"The Trakt List changed before transfer. Choose which version to keep.",
			);
	}
	const existing = rows.map((row) => ({ row, item: member(row) }));
	if (
		existing.some(
			(i) =>
				!i.item ||
				(desired.kind === "favorites" &&
					i.item.mediaType !== "movie" &&
					i.item.mediaType !== "show"),
		)
	)
		throw new Error(
			"The destination List contains unsupported media. Nothing was removed.",
		);
	const existingByKey = new Map<string, (typeof existing)[number]>();
	for (const old of existing) {
		if (old.item && !existingByKey.has(memberKey(old.item)))
			existingByKey.set(memberKey(old.item), old);
	}
	const desiredKeys = new Set(value.items.map(memberKey));
	// Existing memberships already carry Trakt IDs. Only additions need a lookup.
	// Resolve all additions before changing metadata or removing memberships.
	for (const item of value.items) {
		const key = memberKey(item);
		if (!existingByKey.has(key) && !bodies.has(key))
			bodies.set(
				key,
				await listMemberPayload(
					identities,
					token,
					item,
					desired.kind !== "favorites",
				),
			);
	}
	if (desired.kind === "favorites") {
		const settings = z
			.object({
				limits: z.object({
					favorites: z.object({ item_count: z.number().int().nonnegative() }),
				}),
			})
			.parse((await api.request("/users/settings", token)).data);
		const existingKeys = new Set(
			existing.flatMap((e) => (e.item ? [memberKey(e.item)] : [])),
		);
		const additions = value.items.filter(
			(item) => !existingKeys.has(memberKey(item)),
		);
		if (
			additions.length > 0 &&
			existingKeys.size + additions.length >
				settings.limits.favorites.item_count
		)
			throw new Error(
				"This transfer would exceed your Trakt Favorites limit. Free space on Trakt and retry; no Favorites were removed or truncated.",
			);
	}
	if (desired.kind === "list")
		await api.request(
			`/users/me/lists/${id}`,
			token,
			{ name: value.name, description: value.description },
			"PUT",
		);
	for (let index = 0; index < value.items.length; index++) {
		const item = value.items[index];
		const old = existingByKey.get(memberKey(item));
		if (!old) {
			assertOutcome(
				(await api.request(base, token, bodies.get(memberKey(item)))).data,
			);
		} else if (old.item?.notes !== item.notes)
			await api.request(
				`${base}/${old.row.id}`,
				token,
				{ notes: item.notes || null },
				"PUT",
			);
	}
	const notedAdditions =
		desired.kind === "favorites"
			? value.items.filter(
					(item) => item.notes && !existingByKey.has(memberKey(item)),
				)
			: [];
	if (notedAdditions.length) {
		// Favorites needs membership IDs for notes. Read all newly added IDs once.
		const addedByKey = new Map<string, number>();
		for (const row of await pages(api, token, `${base}/all/rank/asc`)) {
			const item = member(row);
			if (item) addedByKey.set(memberKey(item), row.id);
		}
		for (const item of notedAdditions) {
			const addedId = addedByKey.get(memberKey(item));
			if (!addedId)
				throw new Error(
					"Trakt has not confirmed the new Favorite. Retry to reconcile.",
				);
			await api.request(
				`${base}/${addedId}`,
				token,
				{ notes: item.notes },
				"PUT",
			);
		}
	}
	for (const old of existing) {
		const oldItem = old.item;
		if (!oldItem) throw new Error("Unsupported destination List membership.");
		if (desiredKeys.has(memberKey(oldItem))) continue;
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
		`${base}${desired.kind !== "list" ? "/all/rank/asc" : ""}`,
	);
	const currentByKey = new Map<string, number>();
	for (const row of current) {
		const item = member(row);
		if (item && !currentByKey.has(memberKey(item)))
			currentByKey.set(memberKey(item), row.id);
	}
	const rank = value.items.map((item) => currentByKey.get(memberKey(item)));
	if (rank.some((v) => !v) || current.length !== rank.length)
		throw new Error(
			"Trakt List changed during transfer. Choose which version to keep.",
		);
	if (rank.length && rank.some((id, index) => id !== current[index].id)) {
		const path =
			desired.kind !== "list"
				? `/sync/${desired.kind}/reorder`
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
		listId: id,
		watchlist: desired.kind === "watchlist",
		favorites: desired.kind === "favorites",
	});
	if (!confirmation.some((r) => equivalent(r, desired)))
		throw new Error(
			"Trakt has not confirmed this List. Choose which version to keep.",
		);
}
