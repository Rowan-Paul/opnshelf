import { TraktSyncManager } from "#/components/trakt/TraktSyncManager";

export function ImportHistorySection() {
	return (
		<section
			id="import-history"
			className="scroll-mt-24 border-(--border) border-b p-5 sm:p-7"
		>
			<h2 className="mb-1 font-semibold text-lg">Trakt</h2>
			<p className="mb-5 text-(--foreground-muted) text-sm">
				Keep your Watch history, Ratings, Lists, watchlist and Favorites in sync
				with Trakt.
			</p>
			<TraktSyncManager embedded />
		</section>
	);
}
