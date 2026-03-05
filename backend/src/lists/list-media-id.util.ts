export function buildScopedShowMediaId(
	mediaId: string,
	seasonNumber?: number,
	episodeNumber?: number,
): string {
	const parsed = parseScopedShowMediaId(mediaId);
	if (parsed) {
		return mediaId;
	}

	if (typeof seasonNumber === "number" && Number.isFinite(seasonNumber)) {
		if (typeof episodeNumber === "number" && Number.isFinite(episodeNumber)) {
			return `${mediaId}:season:${seasonNumber}:episode:${episodeNumber}`;
		}
		return `${mediaId}:season:${seasonNumber}`;
	}

	return mediaId;
}

export function parseScopedShowMediaId(mediaId: string):
	| {
			showId: string;
			seasonNumber?: number;
			episodeNumber?: number;
	  }
	| undefined {
	const episodeMatch = mediaId.match(/^([^:]+):season:(\d+):episode:(\d+)$/);
	if (episodeMatch) {
		return {
			showId: episodeMatch[1],
			seasonNumber: Number(episodeMatch[2]),
			episodeNumber: Number(episodeMatch[3]),
		};
	}

	const seasonMatch = mediaId.match(/^([^:]+):season:(\d+)$/);
	if (seasonMatch) {
		return {
			showId: seasonMatch[1],
			seasonNumber: Number(seasonMatch[2]),
		};
	}

	return undefined;
}
