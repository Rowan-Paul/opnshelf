export type ReleasePlatform = "web" | "ios" | "android";
export type ReleaseAvailability = {
	status: "available" | "coming-soon" | "update-required";
	minimumVersion?: string;
	note?: string;
};
export type ReleaseNote = {
	slug: string;
	title: string;
	publishedAt: string;
	summary: string;
	platforms: Record<ReleasePlatform, ReleaseAvailability>;
	markdown: string;
};
export const RELEASE_PLATFORM_NAMES: Record<ReleasePlatform, string> = {
	web: "Web",
	ios: "iOS",
	android: "Android",
};
export const RELEASE_PLATFORMS: ReleasePlatform[] = ["web", "ios", "android"];

export function releaseAvailabilityLabel(value: ReleaseAvailability): string {
	const label = {
		available: "Available",
		"coming-soon": "Coming soon",
		"update-required": "Update required",
	}[value.status];
	return `${label}${value.minimumVersion ? ` · v${value.minimumVersion}+` : ""}${value.note ? ` · ${value.note}` : ""}`;
}
export function releaseNoteDate(value: string): string {
	return new Date(value).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
		timeZone: "UTC",
	});
}

function record(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
export function parseReleaseNotes(value: unknown): ReleaseNote[] {
	if (!Array.isArray(value)) throw new Error("Invalid Release Notes feed");
	const slugs = new Set<string>();
	const dates = new Set<string>();
	return value
		.map((entry: unknown) => {
			if (
				!record(entry) ||
				typeof entry.slug !== "string" ||
				!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug) ||
				typeof entry.title !== "string" ||
				!entry.title.trim() ||
				typeof entry.summary !== "string" ||
				!entry.summary.trim() ||
				typeof entry.markdown !== "string" ||
				!entry.markdown.trim() ||
				typeof entry.publishedAt !== "string" ||
				!Number.isFinite(Date.parse(entry.publishedAt)) ||
				new Date(entry.publishedAt).toISOString() !== entry.publishedAt ||
				!record(entry.platforms)
			)
				throw new Error("Invalid Release Notes entry");
			if (slugs.has(entry.slug) || dates.has(entry.publishedAt))
				throw new Error(
					"Release Notes need unique slugs and publication timestamps",
				);
			slugs.add(entry.slug);
			dates.add(entry.publishedAt);
			const platforms = {} as Record<ReleasePlatform, ReleaseAvailability>;
			for (const platform of RELEASE_PLATFORMS) {
				const item = entry.platforms[platform];
				if (
					!record(item) ||
					(item.status !== "available" &&
						item.status !== "coming-soon" &&
						item.status !== "update-required") ||
					(item.minimumVersion !== undefined &&
						(typeof item.minimumVersion !== "string" ||
							!/^\d+\.\d+\.\d+$/.test(item.minimumVersion))) ||
					(item.note !== undefined && typeof item.note !== "string")
				)
					throw new Error("Invalid release platform availability");
				platforms[platform] = {
					status: item.status,
					...(item.minimumVersion
						? { minimumVersion: String(item.minimumVersion) }
						: {}),
					...(item.note ? { note: String(item.note) } : {}),
				};
			}
			return {
				slug: entry.slug,
				title: entry.title,
				publishedAt: entry.publishedAt,
				summary: entry.summary,
				markdown: entry.markdown,
				platforms,
			};
		})
		.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function fetchReleaseNotes(
	origin: string,
	signal?: AbortSignal,
): Promise<ReleaseNote[]> {
	const response = await fetch(
		`${origin.replace(/\/$/, "")}/api/release-notes`,
		{ signal, credentials: "omit" },
	);
	if (!response.ok) throw new Error("Could not load Release Notes");
	return parseReleaseNotes(await response.json());
}
