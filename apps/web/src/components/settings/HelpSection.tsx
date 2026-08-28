import { TOUR_REPLAY_EVENT } from "#/components/tour/WelcomeTour";

/** Recovery actions and lightweight product help live away from preferences. */
export function HelpSection() {
	return (
		<section className="p-5 sm:p-7">
			<h2 className="mb-1 font-semibold text-lg">Welcome tour</h2>
			<p className="mb-6 text-(--foreground-muted) text-sm">
				Revisit the guided introduction to Discover, Connections, Activity, Up
				Next and your Shelf.
			</p>
			<button
				type="button"
				className="btn btn-secondary"
				onClick={() => window.dispatchEvent(new Event(TOUR_REPLAY_EVENT))}
			>
				Take the tour again
			</button>
		</section>
	);
}
