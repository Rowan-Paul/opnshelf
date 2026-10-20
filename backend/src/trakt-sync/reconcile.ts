import { contentValue } from "./content-value";

/** Pure reconciliation policy. Transport IDs and last successful values survive disconnects. */
export type Direction = "inbound" | "outbound" | "both";
export type MediaType = "movie" | "show" | "season" | "episode" | "list";
export type SyncRecord = {
	key: string;
	kind:
		| "watch"
		| "rating"
		| "list"
		| "watchlist"
		| "favorites"
		| "note"
		| "library"
		| "review";
	mediaType: MediaType;
	mediaId: string | null;
	season: number;
	episode: number;
	title: string;
	value: string | number | null;
	traktId?: number;
	traktParentId?: number;
	rkey?: string;
	cid?: string;
	problem?: string;
	// The identity is known, but membership could not be read authoritatively.
	unreadable?: boolean;
	visibility?: "public" | "private";
	createdAt?: string;
};
export type Baseline = {
	linked: boolean;
	eligible: boolean;
	localBase: SyncRecord | null;
	remoteBase: SyncRecord | null;
};
export type Decision = "none" | "push" | "pull" | "conflict";

export function isListRecord(record: { kind: string }): boolean {
	return (
		record.kind === "list" ||
		record.kind === "watchlist" ||
		record.kind === "favorites"
	);
}

export function mediaKey(record: SyncRecord): string {
	if (record.kind === "library")
		return `library:${record.mediaType}:${record.mediaId}:${record.season}:${record.episode}:${contentValue(record).format}`;
	if (isListRecord(record)) return record.kind;
	return `${record.kind}:${record.mediaType}:${record.mediaId}:${record.season}:${record.episode}`;
}

export function fingerprint(record: SyncRecord | null): string {
	return record
		? JSON.stringify([mediaKey(record), record.value, record.visibility])
		: "missing";
}

export function minute(value: SyncRecord["value"]): number | null {
	return typeof value === "string"
		? Math.floor(Date.parse(value) / 60_000)
		: null;
}

export function equivalent(
	a: SyncRecord | null,
	b: SyncRecord | null,
): boolean {
	if (!a || !b) return a === b;
	if (a.unreadable || b.unreadable) return false;
	if (mediaKey(a) !== mediaKey(b)) return false;
	return a.kind === "watch"
		? minute(a.value) === minute(b.value)
		: a.value === b.value;
}

export function decide(
	base: Baseline,
	local: SyncRecord | null,
	remote: SyncRecord | null,
	direction: Direction,
	resolution?: string | null,
): Decision {
	const localChanged = fingerprint(local) !== fingerprint(base.localBase);
	const remoteChanged = fingerprint(remote) !== fingerprint(base.remoteBase);
	if (!base.eligible && !localChanged && !remoteChanged) return "none";
	if (resolution === "opnshelf") return "push";
	if (resolution === "trakt") return "pull";
	if (equivalent(local, remote)) return "none";
	if (base.linked && !localChanged && !remoteChanged) return "none";
	// Initial absence is not a deletion. One-way sync never erases unrelated data.
	if (direction === "inbound") return remote || base.linked ? "pull" : "none";
	if (direction === "outbound") return local || base.linked ? "push" : "none";
	if (!base.linked) {
		if (local && remote) return "conflict";
		return local ? "push" : remote ? "pull" : "none";
	}
	if (localChanged && remoteChanged) return "conflict";
	if (localChanged) return "push";
	if (remoteChanged) return "pull";
	return "none";
}

/** Never claim an ambiguous or undated pair is the same viewing. */
export function candidates(
	record: SyncRecord,
	others: SyncRecord[],
): SyncRecord[] {
	return others.filter(
		(other) =>
			mediaKey(record) === mediaKey(other) &&
			(!isListRecord(record) ||
				record.kind !== "list" ||
				record.title === other.title) &&
			(record.kind !== "review" || record.value === other.value) &&
			(record.kind !== "watch" ||
				record.value === null ||
				other.value === null ||
				Math.abs((minute(record.value) ?? 0) - (minute(other.value) ?? 0)) <=
					5),
	);
}

export function readRecord(value: unknown): SyncRecord | null {
	if (!value || typeof value !== "object") return null;
	const v = value as Partial<SyncRecord>;
	if (
		typeof v.key !== "string" ||
		![
			"watch",
			"rating",
			"list",
			"watchlist",
			"favorites",
			"note",
			"library",
			"review",
		].includes(v.kind ?? "") ||
		!["movie", "show", "season", "episode", "list"].includes(
			v.mediaType ?? "",
		) ||
		!(v.mediaId === null || typeof v.mediaId === "string") ||
		typeof v.season !== "number" ||
		typeof v.episode !== "number" ||
		typeof v.title !== "string"
	)
		return null;
	return v as SyncRecord;
}
