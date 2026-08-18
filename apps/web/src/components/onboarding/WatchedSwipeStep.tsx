import {
	invalidateWatchActivityQueries,
	moviesControllerMarkWatchedMutation,
	onboardingDiscoveryOptions,
	showsControllerMarkShowWatchedMutation,
	type UnifiedSearchResultDto,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Loader2, RotateCcw, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const SWIPE_THRESHOLD = 90;

function titleFor(item: UnifiedSearchResultDto) {
	return item.title ?? item.name ?? "Unknown title";
}

function yearFor(item: UnifiedSearchResultDto) {
	const date = item.release_date ?? item.first_air_date;
	return date?.slice(0, 4);
}

function posterFor(item: UnifiedSearchResultDto) {
	return item.poster_path
		? `https://image.tmdb.org/t/p/w500${item.poster_path}`
		: undefined;
}

export function WatchedSwipeStep({
	onNext,
	onWatched,
}: {
	onNext: () => void;
	onWatched: () => void;
}) {
	const queryClient = useQueryClient();
	const { data, isLoading, isError, refetch } = useQuery(
		onboardingDiscoveryOptions(),
	);
	const items = useMemo(() => {
		const seen = new Set<string>();
		return (data?.results ?? []).filter((item) => {
			const key = `${item.media_type}-${item.id}`;
			if (!posterFor(item) || seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	}, [data]);
	const [index, setIndex] = useState(0);
	const [dragX, setDragX] = useState(0);
	const dragStart = useRef<number | null>(null);
	const current = items[index];

	const finishWatched = () => {
		invalidateWatchActivityQueries(queryClient);
		onWatched();
		setDragX(0);
		setIndex((value) => value + 1);
	};

	const movieMutation = useMutation({
		mutationKey: ["onboarding", "movies", current?.id ?? "", "markWatched"],
		...moviesControllerMarkWatchedMutation(),
		onSuccess: finishWatched,
		onError: (error) => {
			setDragX(0);
			toast.error(
				error instanceof Error ? error.message : "Could not add this movie",
			);
		},
	});

	const showMutation = useMutation({
		mutationKey: ["onboarding", "shows", current?.id ?? "", "markShowWatched"],
		...showsControllerMarkShowWatchedMutation(),
		onSuccess: (result) => {
			if (result.count === 0) {
				setDragX(0);
				toast.error("No episodes were added. You can retry or skip this show.");
				return;
			}
			if (result.count < result.requested) {
				toast.warning(`Added ${result.count} of ${result.requested} episodes.`);
			}
			finishWatched();
		},
		onError: (error) => {
			setDragX(0);
			toast.error(
				error instanceof Error ? error.message : "Could not add this show",
			);
		},
	});

	const isPending = movieMutation.isPending || showMutation.isPending;

	const skip = () => {
		if (isPending || !current) return;
		setDragX(0);
		setIndex((value) => value + 1);
	};

	const markWatched = () => {
		if (isPending || !current) return;
		setDragX(SWIPE_THRESHOLD);
		if (current.media_type === "movie") {
			movieMutation.mutate({
				body: { movieId: String(current.id), watchedAt: null },
			});
		} else {
			showMutation.mutate({
				body: { showId: String(current.id), watchedAt: null },
			});
		}
	};

	if (isLoading) {
		return (
			<div className="card flex min-h-128 items-center justify-center p-8">
				<Loader2
					className="size-8 animate-spin text-(--accent)"
					aria-label="Loading titles"
				/>
			</div>
		);
	}

	if (isError) {
		return (
			<div className="card p-8 text-center">
				<h2 className="text-display-3">Pick what you have watched</h2>
				<p className="mt-2 text-(--foreground-muted) text-sm">
					We could not load the titles.
				</p>
				<div className="mt-6 flex justify-center gap-3">
					<button
						type="button"
						className="btn btn-secondary"
						onClick={() => refetch()}
					>
						<RotateCcw className="size-4" /> Retry
					</button>
					<button type="button" className="btn btn-primary" onClick={onNext}>
						Skip
					</button>
				</div>
			</div>
		);
	}

	if (!current) {
		return (
			<div className="card p-8 text-center">
				<div className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-500/10">
					<Check className="size-8 text-green-500" />
				</div>
				<h2 className="mt-5 text-display-3">That is the stack</h2>
				<p className="mt-2 text-(--foreground-muted) text-sm">
					Your picks are now on your shelf.
				</p>
				<button
					type="button"
					className="btn btn-primary mt-7 w-full"
					onClick={onNext}
				>
					Continue <ArrowRight className="size-4" />
				</button>
			</div>
		);
	}

	const next = items[index + 1];
	const rotation = dragX / 18;

	return (
		<div className="card p-5 sm:p-6">
			<div className="mb-5 text-center">
				<h2 className="text-display-3">What have you watched?</h2>
				<p className="mt-1 text-(--foreground-muted) text-sm">
					Swipe right for watched, left to skip.
				</p>
			</div>

			<div className="relative mx-auto aspect-2/3 w-full max-w-72 touch-pan-y select-none">
				{next && (
					<div className="absolute inset-0 translate-y-2 scale-95 overflow-hidden rounded-2xl bg-(--background-subtle) opacity-60">
						<img
							src={posterFor(next)}
							alt=""
							className="h-full w-full object-cover"
						/>
					</div>
				)}
				<button
					type="button"
					aria-label={`${titleFor(current)}. Use left arrow to skip or right arrow to mark watched.`}
					className="absolute inset-0 cursor-grab overflow-hidden rounded-2xl bg-(--background-subtle) text-left shadow-xl outline-none ring-(--accent) transition-transform duration-200 focus-visible:ring-2 active:cursor-grabbing motion-reduce:transition-none"
					style={{
						transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
						transition: dragStart.current === null ? undefined : "none",
					}}
					onPointerDown={(event) => {
						if (isPending) return;
						dragStart.current = event.clientX - dragX;
						event.currentTarget.setPointerCapture(event.pointerId);
					}}
					onPointerMove={(event) => {
						if (dragStart.current !== null)
							setDragX(event.clientX - dragStart.current);
					}}
					onPointerUp={(event) => {
						if (dragStart.current === null) return;
						event.currentTarget.releasePointerCapture(event.pointerId);
						dragStart.current = null;
						if (dragX <= -SWIPE_THRESHOLD) skip();
						else if (dragX >= SWIPE_THRESHOLD) markWatched();
						else setDragX(0);
					}}
					onPointerCancel={() => {
						dragStart.current = null;
						setDragX(0);
					}}
					onKeyDown={(event) => {
						if (event.key === "ArrowLeft") skip();
						if (event.key === "ArrowRight") markWatched();
					}}
				>
					<img
						src={posterFor(current)}
						alt=""
						className="h-full w-full object-cover"
						draggable={false}
					/>
					<div className="absolute inset-0 bg-linear-to-t from-black/90 via-transparent to-black/10" />
					<div className="absolute inset-x-0 bottom-0 p-5 text-white">
						<p className="font-semibold text-xl">{titleFor(current)}</p>
						<p className="mt-1 text-sm text-white/80">
							{current.media_type === "movie" ? "Movie" : "Show"}
							{yearFor(current) ? ` · ${yearFor(current)}` : ""}
						</p>
					</div>
					{dragX < -25 && (
						<div className="absolute top-5 right-5 -rotate-8 rounded-lg border-4 border-red-400 px-3 py-1 font-bold text-red-400 text-xl">
							SKIP
						</div>
					)}
					{dragX > 25 && (
						<div className="absolute top-5 left-5 rotate-8 rounded-lg border-4 border-green-400 px-3 py-1 font-bold text-green-400 text-xl">
							WATCHED
						</div>
					)}
					{isPending && (
						<div className="absolute inset-0 flex items-center justify-center bg-black/35">
							<Loader2 className="size-9 animate-spin text-white" />
						</div>
					)}
				</button>
			</div>

			<div className="mt-6 grid grid-cols-2 gap-3">
				<button
					type="button"
					className="btn btn-secondary"
					onClick={skip}
					disabled={isPending}
					aria-label="Skip this title"
				>
					<X className="size-5 text-red-500" /> Skip
				</button>
				<button
					type="button"
					className="btn btn-primary"
					onClick={markWatched}
					disabled={isPending}
					aria-label="Mark this title as watched"
				>
					<Check className="size-5" /> Watched
				</button>
			</div>
			<button
				type="button"
				onClick={onNext}
				disabled={isPending}
				className="mt-4 w-full text-center text-(--foreground-muted) text-sm hover:text-(--foreground)"
			>
				Skip this step
			</button>
			<p className="mt-3 text-center text-(--foreground-subtle) text-xs">
				{index + 1} of {items.length} · Arrow keys also work
			</p>
		</div>
	);
}
