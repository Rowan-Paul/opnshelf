import {
	type FollowedActivityItemDto,
	socialControllerGetFeedOptions,
	socialControllerGetFollowingOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SocialUserAvatar } from "@/components/social/SocialUserAvatar";
import {
	getOptionalString,
	getSocialDisplayName,
} from "@/components/social/social-display";
import { M3Button } from "@/components/ui/m3-button";
import {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import { getProfilePeopleRoute, getProfileRoute } from "@/lib/profile-routes";
import { createTitleSlug, getTmdbPosterUrl } from "@/lib/utils";

const PAGE_SIZE = 5;

export function FriendsActivitySection({ userHandle }: { userHandle: string }) {
	const followingQuery = useQuery({
		...socialControllerGetFollowingOptions({
			path: { handle: userHandle },
			query: { page: 1, pageSize: 1 },
		}),
	});
	const feedQuery = useQuery({
		...socialControllerGetFeedOptions({
			query: { page: 1, pageSize: PAGE_SIZE },
		}),
	});

	const totalFollowing = followingQuery.data?.total ?? 0;
	const activityItems = feedQuery.data?.items ?? [];

	if (followingQuery.isLoading || feedQuery.isLoading) {
		return <FriendsActivitySectionSkeleton />;
	}

	if (totalFollowing === 0) {
		return (
			<section>
				<FriendsActivitySectionHeader userHandle={userHandle} />
				<M3Card
					variant="elevated"
					className="rounded-xl border"
					style={{ borderColor: "var(--md-sys-color-outline-variant)" }}
				>
					<M3CardHeader>
						<M3CardTitle>No recent friend activity yet</M3CardTitle>
						<M3CardDescription>
							Follow friends on OpnShelf to see what they have watched lately.
						</M3CardDescription>
					</M3CardHeader>
					<M3CardContent>
						<M3Button variant="filled" asChild className="rounded-full px-6">
							<Link {...getProfilePeopleRoute(userHandle)}>Find friends</Link>
						</M3Button>
					</M3CardContent>
				</M3Card>
			</section>
		);
	}

	if (activityItems.length === 0) {
		return (
			<section>
				<FriendsActivitySectionHeader userHandle={userHandle} />
				<M3Card
					variant="elevated"
					className="rounded-xl border"
					style={{ borderColor: "var(--md-sys-color-outline-variant)" }}
				>
					<M3CardHeader>
						<M3CardTitle>No recent friend activity yet</M3CardTitle>
						<M3CardDescription>
							You are following friends already. Their watched movies and
							episodes will show up here as soon as they log something new.
						</M3CardDescription>
					</M3CardHeader>
				</M3Card>
			</section>
		);
	}

	return (
		<section>
			<FriendsActivitySectionHeader userHandle={userHandle} />
			<div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
				{activityItems.map((item) => (
					<FriendsActivityCard key={item.id} item={item} />
				))}
			</div>
		</section>
	);
}

function FriendsActivitySectionHeader({ userHandle }: { userHandle: string }) {
	return (
		<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
			<div>
				<h2 className="md-headline-small">Friends Activity</h2>
				<p
					className="mt-1 md-body-medium"
					style={{ color: "var(--md-sys-color-on-surface-variant)" }}
				>
					Recent watched activity from friends you follow.
				</p>
			</div>
			<M3Button variant="text" className="rounded-full px-4" asChild>
				<Link {...getProfilePeopleRoute(userHandle)}>
					Find more friends
					<ArrowRight className="size-4" />
				</Link>
			</M3Button>
		</div>
	);
}

function FriendsActivitySectionSkeleton() {
	return (
		<section>
			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<div className="space-y-2">
					<Skeleton className="h-7 w-44 rounded-full bg-(--md-sys-color-surface-container-highest)" />
					<Skeleton className="h-4 w-72 max-w-full rounded-full bg-(--md-sys-color-surface-container-highest)" />
				</div>
				<Skeleton className="h-10 w-36 rounded-full bg-(--md-sys-color-surface-container-highest)" />
			</div>
			<div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
				{Array.from({ length: 5 }, (_, index) => (
					<div
						key={`friends-activity-skeleton-${index + 1}`}
						className="w-[min(11rem,70vw)] shrink-0 rounded-xl border p-3 sm:w-46 lg:w-48"
						style={{
							backgroundColor: "var(--md-sys-color-surface-container-low)",
							borderColor: "var(--md-sys-color-outline-variant)",
						}}
					>
						<Skeleton className="mb-3 aspect-2/3 w-full rounded-xl bg-(--md-sys-color-surface-container-highest)" />
						<div className="space-y-2 px-1 pb-1">
							<Skeleton className="h-5 w-4/5 rounded-full bg-(--md-sys-color-surface-container-highest)" />
							<Skeleton className="h-4 w-2/3 rounded-full bg-(--md-sys-color-surface-container-highest)" />
							<div className="flex items-center gap-2 pt-2">
								<Skeleton className="size-7 rounded-full bg-(--md-sys-color-surface-container-highest)" />
								<div className="flex-1 space-y-2">
									<Skeleton className="h-4 w-20 rounded-full bg-(--md-sys-color-surface-container-highest)" />
									<Skeleton className="h-3 w-24 rounded-full bg-(--md-sys-color-surface-container-highest)" />
								</div>
							</div>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}

function FriendsActivityCard({ item }: { item: FollowedActivityItemDto }) {
	const { is24Hour, timezone } = useFormattedDate();
	const actorName = getSocialDisplayName(
		item.actor.displayName,
		item.actor.handle,
	);
	const posterUrl = getTmdbPosterUrl(item.posterPath);
	const mediaTitle =
		item.type === "movie"
			? (getOptionalString(item.title) ?? "Untitled movie")
			: (getOptionalString(item.showTitle) ?? "Untitled show");
	const activityDate = new Date(item.activityAt);
	const isCurrentYear =
		new Intl.DateTimeFormat("en-US", {
			timeZone: timezone,
			year: "numeric",
		}).format(activityDate) ===
		new Intl.DateTimeFormat("en-US", {
			timeZone: timezone,
			year: "numeric",
		}).format(new Date());
	const formattedActivityDate = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		month: "short",
		day: "numeric",
		...(isCurrentYear ? {} : { year: "numeric" }),
	}).format(activityDate);
	const formattedActivityTime = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		hour: "numeric",
		minute: "2-digit",
		...(is24Hour ? { hour12: false } : { hour12: true }),
	}).format(activityDate);
	const mediaTarget =
		item.type === "movie" && item.movieId && item.title
			? {
					to: "/movies/$movieId/$title" as const,
					params: {
						movieId: item.movieId,
						title: createTitleSlug(item.title),
					},
				}
			: item.showId && item.showTitle && item.seasonNumber && item.episodeNumber
				? {
						to: "/shows/$showId/$title/seasons/$seasonNumber/episodes/$episodeNumber" as const,
						params: {
							showId: item.showId,
							title: createTitleSlug(item.showTitle),
							seasonNumber: String(item.seasonNumber),
							episodeNumber: String(item.episodeNumber),
						},
					}
				: item.showId && item.showTitle
					? {
							to: "/shows/$showId/$title" as const,
							params: {
								showId: item.showId,
								title: createTitleSlug(item.showTitle),
							},
						}
					: null;

	return (
		<div
			className="group flex h-full w-[min(11rem,70vw)] shrink-0 flex-col rounded-xl border p-3 transition-transform duration-200 hover:-translate-y-1 sm:w-46 lg:w-48"
			style={{
				backgroundColor: "var(--md-sys-color-surface-container-low)",
				borderColor: "var(--md-sys-color-outline-variant)",
			}}
		>
			{mediaTarget ? (
				<Link
					{...mediaTarget}
					className="relative mb-3 block overflow-hidden rounded-xl"
				>
					<div
						className="aspect-2/3"
						style={{
							backgroundColor: "var(--md-sys-color-surface-container-highest)",
						}}
					>
						{posterUrl ? (
							<img
								src={posterUrl}
								alt={mediaTitle}
								className="h-full w-full object-cover"
							/>
						) : (
							<div
								className="flex h-full w-full items-center justify-center px-4 text-center text-sm"
								style={{ color: "var(--md-sys-color-on-surface-variant)" }}
							>
								No poster available
							</div>
						)}
					</div>
				</Link>
			) : (
				<div
					className="mb-3 flex aspect-2/3 items-center justify-center rounded-xl px-4 text-center text-sm"
					style={{
						backgroundColor: "var(--md-sys-color-surface-container-highest)",
						color: "var(--md-sys-color-on-surface-variant)",
					}}
				>
					No poster available
				</div>
			)}

			<div className="flex min-h-35 flex-1 flex-col px-1 pb-1">
				<div>
					{mediaTarget ? (
						<Link {...mediaTarget} className="block rounded-xl">
							<h3 className="mb-1 line-clamp-2 text-sm font-semibold transition-colors hover:text-(--md-sys-color-primary)">
								{mediaTitle}
							</h3>
						</Link>
					) : (
						<h3 className="mb-1 line-clamp-2 text-sm font-semibold">
							{mediaTitle}
						</h3>
					)}
				</div>

				<div
					className="mt-auto flex min-h-16 items-center gap-2 rounded-lg border px-2.5 py-2"
					style={{
						backgroundColor: "var(--md-sys-color-surface-container)",
						borderColor: "var(--md-sys-color-outline-variant)",
					}}
				>
					<Link
						{...getProfileRoute(item.actor.handle, "shelf", { page: 1 })}
						className="shrink-0"
					>
						<SocialUserAvatar
							avatar={item.actor.avatar}
							displayName={item.actor.displayName}
							handle={item.actor.handle}
							className="size-8"
						/>
					</Link>
					<div className="min-w-0">
						<Link
							{...getProfileRoute(item.actor.handle, "shelf", { page: 1 })}
							className="block"
						>
							<p className="truncate text-sm font-medium">{actorName}</p>
						</Link>
						<p
							className="text-xs font-medium"
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							{formattedActivityDate} at {formattedActivityTime}
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
