import {
	usersControllerGetMySettingsOptions,
	usersControllerUpdateMySettingsMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "#/lib/auth-context";

/**
 * Welcome Tour (ADR 0024). Six steps that walk the real app: each one navigates
 * to a surface and points at something structural there, never at content, so a
 * brand-new account sees the same tour as a full one.
 *
 * Seen-state is `welcomeTourWebVersion` on the User. Bumping TOUR_VERSION
 * replays the whole tour for everyone; skipping counts as finishing.
 */
export const TOUR_VERSION = 1;

/**
 * Fired by the Settings entry to re-run the tour without touching the stored
 * version, so a re-run works even when that write is what failed.
 */
export const TOUR_REPLAY_EVENT = "opnshelf:tour-replay";

/** Time a step waits for its anchor before showing its card unanchored. */
const ANCHOR_TIMEOUT_MS = 1500;

/** Padding around the spotlighted element, in px. */
const HOLE_PAD = 8;

const CARD_WIDTH = 336;

interface TourStep {
	/** Route this step drives the app to. */
	to: "/" | "/search" | "/connections" | "/activity";
	/** `data-tour` value of the element to spotlight. */
	anchor: string;
	title: string;
	body: string;
}

export const TOUR_STEPS: readonly TourStep[] = [
	{
		to: "/search",
		anchor: "discover",
		title: "Start on Discover",
		body: "Search for a film, a show or a person. Below the box are the things trending now and what the people you follow have been watching.",
	},
	{
		to: "/search",
		anchor: "command",
		title: "Search from any page",
		body: "⌘K opens this from wherever you are, and it jumps to pages and settings too. Feedback lives in the same list, at the bottom.",
	},
	{
		to: "/connections",
		anchor: "connections",
		title: "Find people",
		body: "Follow the people whose taste you trust, and group them into circles when your feed gets busy.",
	},
	{
		to: "/activity",
		anchor: "activity",
		title: "See what they watch",
		body: "Every watch and review from the people you follow, newest first. It fills in once you follow someone.",
	},
	{
		to: "/",
		anchor: "up-next",
		title: "Up Next",
		body: "The next episode of every show you are part-way through. It fills in as you watch shows.",
	},
	{
		to: "/",
		anchor: "shelf",
		title: "Your Shelf",
		body: "Everything you have watched, newest first. Mark a film or an episode watched and it lands here.",
	},
] as const;

/** Routes that own the screen: the tour must not walk out from under them. */
function isTourBlockedPath(pathname: string): boolean {
	return (
		pathname === "/onboarding" ||
		pathname === "/login" ||
		pathname === "/signup" ||
		pathname === "/trakt-import" ||
		pathname.startsWith("/auth") ||
		pathname.startsWith("/embed")
	);
}

/** Whether the tour should start. Exported for the unit test. */
export function shouldRunTour(input: {
	isAuthenticated: boolean;
	needsOnboarding: boolean | undefined;
	seenVersion: number | undefined;
	pathname: string;
}): boolean {
	if (!input.isAuthenticated || input.needsOnboarding) return false;
	if (input.seenVersion === undefined) return false;
	if (isTourBlockedPath(input.pathname)) return false;
	return input.seenVersion < TOUR_VERSION;
}

export function WelcomeTour() {
	const { isAuthenticated, user, userSettings } = useAuth();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	const [index, setIndex] = useState<number | null>(null);
	// Set the moment the tour ends, so the in-flight settings write cannot be
	// mistaken for "never taken" and restart it.
	const [ended, setEnded] = useState(false);

	const complete = useMutation({
		mutationKey: ["users", "me", "settings", "welcome-tour"],
		...usersControllerUpdateMySettingsMutation(),
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: usersControllerGetMySettingsOptions().queryKey,
			});
		},
	});

	const seenVersion = userSettings?.welcomeTourWebVersion;

	useEffect(() => {
		const onReplay = () => {
			setEnded(false);
			setIndex(0);
		};
		window.addEventListener(TOUR_REPLAY_EVENT, onReplay);
		return () => window.removeEventListener(TOUR_REPLAY_EVENT, onReplay);
	}, []);

	useEffect(() => {
		if (ended || index !== null) return;
		if (
			shouldRunTour({
				isAuthenticated,
				needsOnboarding: user?.needsOnboarding,
				seenVersion,
				pathname,
			})
		) {
			setIndex(0);
		}
	}, [
		ended,
		index,
		isAuthenticated,
		user?.needsOnboarding,
		seenVersion,
		pathname,
	]);

	const step = index === null ? null : TOUR_STEPS[index];

	// Each step drives the app to its own surface before it measures anything.
	useEffect(() => {
		if (!step) return;
		if (pathname !== step.to) navigate({ to: step.to });
	}, [step, pathname, navigate]);

	const end = useCallback(() => {
		setEnded(true);
		setIndex(null);
		complete.mutate({ body: { welcomeTourWebVersion: TOUR_VERSION } });
		navigate({ to: "/" });
	}, [complete, navigate]);

	// Escape skips, matching every other overlay in the app.
	useEffect(() => {
		if (!step) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") end();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [step, end]);

	const rect = useAnchorRect(step?.anchor, index);

	if (!step || index === null) return null;

	const isLast = index === TOUR_STEPS.length - 1;

	return (
		<div className="fixed inset-0 z-100" role="dialog" aria-modal="true">
			{/* Swallows every click underneath. Carries the dim itself only when
			    there is no hole to cast it. */}
			<div className={`absolute inset-0 ${rect ? "" : "bg-black/65"}`} />

			{rect && (
				<div
					className="pointer-events-none absolute rounded-xl border-(--accent) border-2"
					style={{
						top: rect.top - HOLE_PAD,
						left: rect.left - HOLE_PAD,
						width: rect.width + HOLE_PAD * 2,
						height: rect.height + HOLE_PAD * 2,
						boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)",
					}}
				/>
			)}

			<div className="card absolute p-4 shadow-xl" style={cardStyle(rect)}>
				<p className="mb-1 text-(--foreground-muted) text-xs">
					Step {index + 1} of {TOUR_STEPS.length}
				</p>
				<h2 className="mb-2 font-display font-semibold text-lg">
					{step.title}
				</h2>
				<p className="mb-4 text-(--foreground-muted) text-sm leading-relaxed">
					{step.body}
				</p>
				<div className="flex items-center justify-between gap-2">
					<button type="button" className="btn btn-ghost" onClick={end}>
						Skip
					</button>
					<div className="flex items-center gap-2">
						{index > 0 && (
							<button
								type="button"
								className="btn btn-secondary"
								onClick={() => setIndex(index - 1)}
							>
								Back
							</button>
						)}
						<button
							type="button"
							className="btn btn-primary"
							onClick={() => (isLast ? end() : setIndex(index + 1))}
						>
							{isLast ? "Done" : "Next"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

/**
 * Tracks the anchor's viewport box for as long as the step is open.
 *
 * One rAF loop rather than scroll/resize/mutation listeners: the anchor mounts
 * a route change late, moves while the page scrolls it into view, and shifts
 * again when data lands, and the loop covers all three. Returns null while the
 * anchor is missing past ANCHOR_TIMEOUT_MS, which shows the card unanchored.
 */
function useAnchorRect(
	anchor: string | undefined,
	stepIndex: number | null,
): DOMRect | null {
	const [rect, setRect] = useState<DOMRect | null>(null);
	const scrolledFor = useRef<string | null>(null);

	useEffect(() => {
		if (!anchor) {
			setRect(null);
			return;
		}
		setRect(null);
		const key = `${stepIndex}:${anchor}`;
		const startedAt = performance.now();
		let frame = 0;

		const tick = () => {
			frame = requestAnimationFrame(tick);
			const element = document.querySelector(`[data-tour="${anchor}"]`);
			if (!element) {
				if (performance.now() - startedAt > ANCHOR_TIMEOUT_MS) setRect(null);
				return;
			}
			if (scrolledFor.current !== key) {
				scrolledFor.current = key;
				element.scrollIntoView({ block: "center", behavior: "smooth" });
			}
			setRect(element.getBoundingClientRect());
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [anchor, stepIndex]);

	return rect;
}

/** Below the anchor when it fits, above it when it does not, centred with none. */
function cardStyle(rect: DOMRect | null): React.CSSProperties {
	if (!rect) {
		return {
			width: CARD_WIDTH,
			left: "50%",
			top: "50%",
			transform: "translate(-50%, -50%)",
		};
	}
	const gap = HOLE_PAD + 12;
	const below = rect.bottom + gap;
	const fitsBelow = below + 220 < window.innerHeight;
	const left = Math.min(
		Math.max(12, rect.left + rect.width / 2 - CARD_WIDTH / 2),
		Math.max(12, window.innerWidth - CARD_WIDTH - 12),
	);
	return fitsBelow
		? { width: CARD_WIDTH, left, top: below }
		: {
				width: CARD_WIDTH,
				left,
				bottom: Math.max(12, window.innerHeight - rect.top + gap),
			};
}
