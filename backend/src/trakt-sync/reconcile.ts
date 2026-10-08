/** Pure reconciliation policy. Transport IDs and last successful values survive disconnects. */
export type Direction = "inbound" | "outbound" | "both";
export type MediaType = "movie" | "show" | "season" | "episode";
export type SyncRecord = {
	key: string;
	kind: "watch" | "rating";
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
};
export type Baseline = {
	linked: boolean;
	eligible: boolean;
	localBase: SyncRecord | null;
	remoteBase: SyncRecord | null;
};
export type Decision = "none" | "push" | "pull" | "conflict";

export function mediaKey(record: SyncRecord): string {
	return `${record.kind}:${record.mediaType}:${record.mediaId}:${record.season}:${record.episode}`;
}

export function fingerprint(record: SyncRecord | null): string {
	return record ? JSON.stringify([mediaKey(record), record.value]) : "missing";
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
			(record.kind === "rating" ||
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
		!["watch", "rating"].includes(v.kind ?? "") ||
		!["movie", "show", "season", "episode"].includes(v.mediaType ?? "") ||
		!(v.mediaId === null || typeof v.mediaId === "string") ||
		typeof v.season !== "number" ||
		typeof v.episode !== "number" ||
		typeof v.title !== "string"
	)
		return null;
	return v as SyncRecord;
}
