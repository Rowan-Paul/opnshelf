import {
	showsControllerGetUserUpNextOptions,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { Tv } from "lucide-react";
import { z } from "zod/mini";
import { Pagination } from "#/components/Pagination";
import { UpNextEpisodeCard } from "#/components/UpNextEpisodeCard";
import { UpNextServiceFilter } from "#/components/UpNextServiceFilter";
import { useAuth } from "#/lib/auth-context";
import { findShowProgress, useShowProgress } from "#/lib/hooks";

const searchSchema = z.object({
	services: z.optional(
		z.union([
			z.number().check(z.int(), z.minimum(1), z.maximum(999999999)),
			z
				.string()
				.check(z.regex(/^(mine|[1-9][0-9]{0,8}(,[1-9][0-9]{0,8}){0,49})$/)),
		]),
	),
	page: z._default(z.optional(z.coerce.number().check(z.minimum(1))), 1),
});

export const Route = createFileRoute("/profile/$handle/up-next")({
	loader: async ({ context, params }) => {
		try {
			const profile = await context.queryClient.ensureQueryData(
				usersControllerGetPublicProfileOptions({
					path: { handle: params.handle },
				}),
			);
			return { profile };
		} catch {
			return { profile: null };
		}
	},
	head: ({ loaderData }) => {
		const name =
			loaderData?.profile?.displayName || loaderData?.profile?.handle || "User";
		return {
			meta: [{ title: `${name}'s Up Next | Opnshelf` }],
		};
	},
	component: ProfileUpNextPage,
	validateSearch: searchSchema,
});

// TanStack quotes numeric strings in URLs. Keep single-service links identical to Mobile.
function serviceSearchValue(services: string | undefined) {
	return services && /^[0-9]+$/.test(services) ? Number(services) : services;
}

function ProfileUpNextPage() {
	const { handle } = Route.useParams();
	const search = useSearch({ from: Route.id });
	const navigate = useNavigate();
	const { user, userSettings } = useAuth();
	const page = search.page;

	const { data: profile } = useQuery({
		...usersControllerGetPublicProfileOptions({ path: { handle } }),
	});
	const userDid = profile?.did || "";
	const isOwner = user?.did === userDid;

	const country = userSettings?.watchCountry ?? "US";
	const services =
		isOwner && search.services ? String(search.services) : undefined;
	const setServices = (services: string | undefined) =>
		navigate({
			to: "/profile/$handle/up-next",
			params: { handle },
			search: { page: 1, services: serviceSearchValue(services) },
			replace: true,
		});
	const upNextOptions = showsControllerGetUserUpNextOptions({
		path: { userDid },
		query: { page, pageSize: 20, services },
	});
	const { data, isLoading, isFetching, isError, refetch } = useQuery({
		...upNextOptions,
		// Refresh the filtered queue when My Services or watch country changes.
		queryKey: [
			{
				...upNextOptions.queryKey[0],
				tags: services
					? [country, ...(userSettings?.streamingServiceIds ?? []).map(String)]
					: undefined,
			},
		],
		placeholderData: (previous, previousQuery) =>
			previousQuery?.queryKey[0].path?.userDid === userDid
				? keepPreviousData(previous)
				: undefined,
		enabled: !!userDid,
	});

	const items = data?.items ?? [];
	const { data: viewerProgressData, isLoading: isViewerProgressLoading } =
		useShowProgress(isOwner ? [] : items.map((item) => item.showId));

	const handlePageChange = (newPage: number) => {
		navigate({
			to: "/profile/$handle/up-next",
			params: { handle },
			search: { page: newPage, services: serviceSearchValue(services) },
			replace: true,
		});
	};

	return (
		<div className="space-y-6">
			<header className="flex flex-wrap items-center justify-between gap-4">
				{" "}
				<div className="flex items-baseline gap-3">
					<h1 className="text-display-2">Up Next</h1>
					{data && (
						<span className="text-(--foreground-muted) text-sm">
							{data.total} {data.total === 1 ? "show" : "shows"}
						</span>
					)}
				</div>
				{isOwner && (
					<UpNextServiceFilter
						country={country}
						savedIds={userSettings?.streamingServiceIds ?? []}
						value={services}
						onChange={(value) => void setServices(value)}
					/>
				)}
			</header>
			{isError && (
				<div role="alert" className="flex items-center gap-3">
					<p>Couldn't load Up Next.</p>
					<button
						type="button"
						className="btn btn-secondary"
						onClick={() => void refetch()}
					>
						Try again
					</button>
				</div>
			)}
			{isLoading ? (
				<div
					className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
					aria-busy="true"
				>
					{[1, 2, 3, 4, 5, 6].map((i) => (
						<div key={i} className="card overflow-hidden" aria-hidden="true">
							<div className="aspect-video animate-pulse bg-(--background-subtle)" />
							<div className="space-y-4 p-4">
								<div className="h-4 w-2/3 animate-pulse rounded bg-(--background-subtle)" />
								<div className="space-y-2">
									<div className="h-3 animate-pulse rounded bg-(--background-subtle)" />
									<div className="h-3 animate-pulse rounded bg-(--background-subtle)" />
									<div className="h-3 w-3/4 animate-pulse rounded bg-(--background-subtle)" />
								</div>
								<div className="flex items-center justify-between gap-2">
									<div className="h-3 w-28 animate-pulse rounded bg-(--background-subtle)" />
									<div className="h-9 w-32 animate-pulse rounded bg-(--background-subtle)" />
								</div>
							</div>
						</div>
					))}
				</div>
			) : isError && !data ? null : items.length === 0 ? (
				<div
					className="card p-8 text-center"
					aria-busy={isFetching}
					style={{ opacity: isFetching ? 0.5 : 1 }}
				>
					<Tv className="mx-auto mb-3 size-12 text-(--foreground-muted)" />
					<p className="text-(--foreground-muted)">
						{services ? "No shows on these services" : "All caught up!"}
					</p>
					<p className="mt-1 text-(--foreground-muted) text-sm">
						{services
							? "Try turning off the filter to see all of Up Next."
							: "No upcoming episodes to watch."}
					</p>
				</div>
			) : (
				<div
					className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
					aria-busy={isFetching}
					style={{ opacity: isFetching ? 0.5 : 1 }}
				>
					{items.map((item) => {
						const nextEp = item.nextEpisode;
						const viewerProgress = findShowProgress(
							viewerProgressData,
							item.showId,
						);
						const progressData = isOwner
							? {
									episodesWatched: item.episodesWatched,
									episodesTotal: item.totalEpisodes,
									percentage:
										item.totalEpisodes > 0
											? Math.round(
													(item.episodesWatched / item.totalEpisodes) * 100,
												)
											: 0,
								}
							: viewerProgress?.state !== "unavailable"
								? viewerProgress
								: undefined;

						return (
							<UpNextEpisodeCard
								key={`${item.showId}-${nextEp.seasonNumber}-${nextEp.episodeNumber}`}
								item={item}
								isOwner={isOwner}
								progress={progressData}
								isProgressLoading={!isOwner && isViewerProgressLoading}
							/>
						);
					})}
				</div>
			)}

			{/* Pagination */}
			{data && data.totalPages > 1 && (
				<div className="flex justify-center pt-4">
					<Pagination
						page={data.page}
						totalPages={data.totalPages}
						onPageChange={handlePageChange}
					/>
				</div>
			)}
		</div>
	);
}
