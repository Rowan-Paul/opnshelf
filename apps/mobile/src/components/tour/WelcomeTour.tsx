import {
	usersControllerGetMySettingsOptions,
	usersControllerUpdateMySettingsMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, usePathname } from "expo-router";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	BackHandler,
	Dimensions,
	Pressable,
	type ScrollView,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import {
	ANCHOR_TIMEOUT_MS,
	HOLE_PAD,
	MEASURE_MS,
	SCROLL_TARGET_Y,
	shouldRunTour,
	TOUR_STEPS,
	TOUR_VERSION,
} from "@/lib/welcome-tour";

/**
 * Welcome Tour overlay (ADR 0024). Six steps that walk the real app: each one
 * drives the app to a surface and points at something structural there, never at
 * content, so a brand-new account sees the same tour as a full one. The step
 * list and the gate live in `@/lib/welcome-tour`.
 */

/* -------------------------------------------------------------------------- */
/* Anchors                                                                    */
/* -------------------------------------------------------------------------- */

interface Measurable {
	measureInWindow: (
		callback: (x: number, y: number, width: number, height: number) => void,
	) => void;
}

/**
 * Live anchors, keyed by step anchor id. A plain module map rather than context:
 * the tour is mounted once above the router and the targets are scattered across
 * tab screens, so there is nothing for a provider to sit between.
 */
const anchors = new Map<string, Measurable>();

/** Marks a view as a tour target. Replaces a wrapper rather than adding one. */
export function TourAnchor({
	id,
	className,
	children,
}: {
	id: string;
	className?: string;
	children: ReactNode;
}) {
	return (
		<View
			// Android flattens layout-only views, and a flattened view cannot be
			// measured.
			collapsable={false}
			className={className}
			ref={(node) => {
				if (node) anchors.set(id, node as unknown as Measurable);
				else anchors.delete(id);
			}}
		>
			{children}
		</View>
	);
}

/**
 * The Home sections sit below the fold, so Home hands its ScrollView over and
 * the tour scrolls a step's anchor into view itself.
 */
let homeScroll: { view: ScrollView | null; offsetY: number } = {
	view: null,
	offsetY: 0,
};

export function registerTourScroller(view: ScrollView | null) {
	homeScroll = { view, offsetY: view ? homeScroll.offsetY : 0 };
}

export function setTourScrollOffset(offsetY: number) {
	homeScroll.offsetY = offsetY;
}

/* -------------------------------------------------------------------------- */
/* Replay                                                                     */
/* -------------------------------------------------------------------------- */

let replay: (() => void) | null = null;

/**
 * Re-runs the tour from Settings without touching the stored version, so a
 * re-run works even when that write is what failed.
 */
export function replayWelcomeTour() {
	router.replace("/");
	replay?.();
}

/* -------------------------------------------------------------------------- */
/* Tour                                                                       */
/* -------------------------------------------------------------------------- */

export function WelcomeTour() {
	const { user, isAuthenticated } = useAuth();
	const pathname = usePathname();
	const insets = useSafeAreaInsets();
	const queryClient = useQueryClient();

	const [index, setIndex] = useState<number | null>(null);
	// Set the moment the tour ends, so the in-flight settings write cannot be
	// mistaken for "never taken" and restart it.
	const [ended, setEnded] = useState(false);

	const { data: settings } = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!user,
	});

	const complete = useMutation({
		mutationKey: ["users", "me", "settings", "welcome-tour"],
		...usersControllerUpdateMySettingsMutation(),
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: usersControllerGetMySettingsOptions().queryKey,
			});
		},
	});

	const seenVersion = settings?.welcomeTourMobileVersion;

	useEffect(() => {
		replay = () => {
			setEnded(false);
			setIndex(0);
		};
		return () => {
			replay = null;
		};
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
		if (pathname !== step.route) router.navigate(step.route);
	}, [step, pathname]);

	const end = useCallback(() => {
		setEnded(true);
		setIndex(null);
		complete.mutate({ body: { welcomeTourMobileVersion: TOUR_VERSION } });
		router.navigate("/");
	}, [complete]);

	// Android hardware back steps the tour backwards, and out of it on step one.
	// Left to the router it would strand this overlay on a screen the tour did
	// not choose.
	useEffect(() => {
		if (index === null) return;
		const subscription = BackHandler.addEventListener(
			"hardwareBackPress",
			() => {
				if (index === 0) end();
				else setIndex(index - 1);
				return true;
			},
		);
		return () => subscription.remove();
	}, [index, end]);

	const rect = useAnchorRect(step?.anchor, index);
	// Anchors are measured in window coordinates, but the hole is positioned
	// inside this overlay. The two origins differ by the system bars, which put
	// every ring a status bar too high, so measure this view and work in its own
	// coordinate space instead of assuming the offset is zero.
	const overlayRef = useRef<View>(null);
	const [frame, setFrame] = useState<AnchorRect | null>(null);
	const measureOverlay = useCallback(() => {
		overlayRef.current?.measureInWindow((x, y, width, height) => {
			setFrame({ x, y, width, height });
		});
	}, []);

	if (!step || index === null) return null;

	const isLast = index === TOUR_STEPS.length - 1;
	const window = Dimensions.get("window");
	const height = frame?.height || window.height;
	const hole = rect
		? {
				top: rect.y - (frame?.y ?? 0) - HOLE_PAD,
				left: rect.x - (frame?.x ?? 0) - HOLE_PAD,
				width: rect.width + HOLE_PAD * 2,
				height: rect.height + HOLE_PAD * 2,
			}
		: null;

	// Card below the hole when it fits, above it when it does not, and centred
	// when the step has nothing to point at.
	const cardTop = !hole
		? undefined
		: hole.top + hole.height + 320 < height
			? hole.top + hole.height + 12
			: undefined;
	const cardBottom =
		hole && cardTop === undefined
			? Math.max(insets.bottom + 12, height - hole.top + 12)
			: undefined;

	return (
		<View
			ref={overlayRef}
			onLayout={measureOverlay}
			className="absolute inset-0"
			pointerEvents="box-none"
		>
			{/* Four dim panels around the target rather than one overlay with a
			    cut-out: the hole is a real gap, so the long-press step can be tried
			    on the poster it points at. */}
			{hole ? (
				<>
					<Dim
						style={{ top: 0, left: 0, right: 0, height: Math.max(0, hole.top) }}
					/>
					<Dim
						style={{
							top: hole.top + hole.height,
							left: 0,
							right: 0,
							bottom: 0,
						}}
					/>
					<Dim
						style={{
							top: hole.top,
							left: 0,
							width: Math.max(0, hole.left),
							height: hole.height,
						}}
					/>
					<Dim
						style={{
							top: hole.top,
							left: hole.left + hole.width,
							right: 0,
							height: hole.height,
						}}
					/>
					<View
						pointerEvents="none"
						className="absolute rounded-xl border-2 border-primary"
						style={hole}
					/>
				</>
			) : (
				<Dim style={{ top: 0, left: 0, right: 0, bottom: 0 }} />
			)}

			<View
				className="absolute gap-2 rounded-2xl border border-border bg-card p-4"
				style={{
					left: 16,
					right: 16,
					top: cardTop ?? (hole ? undefined : height / 2 - 140),
					bottom: cardBottom,
				}}
			>
				<Text className="text-muted-foreground text-xs">
					Step {index + 1} of {TOUR_STEPS.length}
				</Text>
				<Text className="font-bold font-display text-foreground text-lg">
					{step.title}
				</Text>
				<Text className="text-muted-foreground text-sm leading-5">
					{step.body}
				</Text>
				<View className="mt-2 flex-row items-center justify-between">
					<Pressable hitSlop={8} onPress={end}>
						<Text className="font-medium text-muted-foreground text-sm">
							Skip
						</Text>
					</Pressable>
					<View className="flex-row items-center gap-2">
						{index > 0 ? (
							<Pressable
								className="rounded-full border border-border px-4 py-2"
								onPress={() => setIndex(index - 1)}
							>
								<Text className="font-semibold text-foreground text-sm">
									Back
								</Text>
							</Pressable>
						) : null}
						<Pressable
							className="rounded-full bg-primary px-4 py-2"
							onPress={() => (isLast ? end() : setIndex(index + 1))}
						>
							<Text className="font-semibold text-primary-foreground text-sm">
								{isLast ? "Done" : "Next"}
							</Text>
						</Pressable>
					</View>
				</View>
			</View>
		</View>
	);
}

/** One dim panel. Swallows the touches that land on it. */
function Dim({ style }: { style: object }) {
	return (
		<View
			className="absolute bg-black/65"
			style={style}
			onStartShouldSetResponder={() => true}
		/>
	);
}

interface AnchorRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Tracks the anchor's window box for as long as the step is open, and scrolls it
 * into view once if Home is holding it below the fold. Polled rather than
 * measured once: the anchor mounts a navigation late, and moves again when its
 * data lands. Returns null while the anchor is missing past ANCHOR_TIMEOUT_MS,
 * which shows the card unanchored.
 */
function useAnchorRect(
	anchor: string | undefined,
	stepIndex: number | null,
): AnchorRect | null {
	const [rect, setRect] = useState<AnchorRect | null>(null);
	const scrolledFor = useRef<string | null>(null);

	useEffect(() => {
		if (!anchor) {
			setRect(null);
			return;
		}
		setRect(null);
		const key = `${stepIndex}:${anchor}`;
		const startedAt = Date.now();
		let cancelled = false;

		const measure = () => {
			const target = anchors.get(anchor);
			if (!target) {
				if (Date.now() - startedAt > ANCHOR_TIMEOUT_MS) setRect(null);
				return;
			}
			target.measureInWindow((x, y, width, height) => {
				if (cancelled) return;
				if (width === 0 && height === 0) return;
				const window = Dimensions.get("window");
				const offscreen = y < 0 || y + height > window.height;
				if (offscreen && homeScroll.view && scrolledFor.current !== key) {
					scrolledFor.current = key;
					homeScroll.view.scrollTo({
						y: Math.max(0, homeScroll.offsetY + y - SCROLL_TARGET_Y),
						animated: true,
					});
					return;
				}
				setRect({ x, y, width, height });
			});
		};

		measure();
		const timer = setInterval(measure, MEASURE_MS);
		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	}, [anchor, stepIndex]);

	return rect;
}
