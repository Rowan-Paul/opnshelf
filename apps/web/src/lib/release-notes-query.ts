import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

const getReleaseNotes = createServerFn({ method: "GET" }).handler(async () => {
	const { publishedReleaseNotes } = await import("./release-notes.server");
	return publishedReleaseNotes();
});
export const releaseNotesOptions = () =>
	queryOptions({
		queryKey: ["release-notes"],
		queryFn: () => getReleaseNotes(),
		staleTime: 60_000,
		refetchInterval: 60_000,
	});
