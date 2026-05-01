import {
	peopleControllerGetPersonDetailsOptions,
	peopleControllerGetPersonFilmographyInfiniteOptions,
} from "@opnshelf/api";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Calendar,
	ChevronLeft,
	Clapperboard,
	Loader2,
	MapPin,
	Star,
} from "lucide-react";
import { useMemo } from "react";
import { setupApiClient } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";
import { formatDate } from "#/lib/date-utils";
import { usePersonDetails } from "#/lib/hooks";
import { buildPersonPageMeta } from "#/lib/media-meta";
import ActionableMediaCard from "../../../components/ActionableMediaCard";
import DetailsCard from "../../../components/DetailsCard";
import ErrorState from "../../../components/ErrorState";
import LoadingState from "../../../components/LoadingState";

setupApiClient();

export const Route = createFileRoute("/people/$personId/$personName")({
	loader: async ({ context, params }) => {
		return context.queryClient.ensureQueryData(
			peopleControllerGetPersonDetailsOptions({
				path: { personId: params.personId },
			}),
		);
	},
	head: ({ loaderData, params }) => {
		const meta = buildPersonPageMeta(loaderData, params.personName);
		return {
			meta: [
				{ title: meta.title },
				{
					name: "description",
					content: meta.description,
				},
			],
		};
	},
	component: PersonDetailPage,
});

function PersonDetailPage() {
	const { personId } = Route.useParams();
	const { userSettings } = useAuth();
	const userTimezone = userSettings?.timezone;

	const { data: person, isLoading, error } = usePersonDetails(personId);

	const {
		data: filmographyData,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = useInfiniteQuery({
		...peopleControllerGetPersonFilmographyInfiniteOptions({
			path: { personId },
			query: { pageSize: 20 },
		}),
		enabled: !!personId,
	});

	const filmographyItems = useMemo(() => {
		if (!filmographyData?.pages) return [];
		return filmographyData.pages.flatMap((page) => page.items);
	}, [filmographyData]);

	const knownForItems = useMemo(() => {
		if (!person?.filmography) return [];
		return [...person.filmography]
			.filter((item) => item.vote_average && item.vote_average > 0)
			.sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
			.slice(0, 6);
	}, [person?.filmography]);

	if (isLoading) return <LoadingState />;
	if (error || !person) {
		return (
			<ErrorState
				message="Failed to load person"
				backTo="/"
				backLabel="Back to Dashboard"
			/>
		);
	}

	const profileUrl = person.profile_path
		? `https://image.tmdb.org/t/p/w500${person.profile_path}`
		: "";

	const birthYear = person.birthday
		? new Date(person.birthday).getFullYear()
		: null;
	const deathYear = person.deathday
		? new Date(person.deathday).getFullYear()
		: null;
	const age =
		birthYear && !Number.isNaN(birthYear)
			? deathYear && !Number.isNaN(deathYear)
				? deathYear - birthYear
				: new Date().getFullYear() - birthYear
			: null;

	return (
		<div className="min-h-screen pb-8">
			{/* Hero Section */}
			<div className="relative z-10 min-h-[40vh] overflow-hidden">
				{/* Subtle gradient background */}
				<div className="absolute inset-0 h-[50vh] bg-linear-to-br from-gray-800 to-gray-900" />
				<div className="absolute inset-0 bg-linear-to-t from-(--background) via-(--background)/60 to-transparent" />
				<div className="absolute inset-0 bg-linear-to-r from-(--background) via-(--background)/40 to-transparent" />

				<div className="container-app relative pt-8">
					<Link to="/" className="btn btn-secondary mb-6 inline-flex gap-2">
						<ChevronLeft className="size-4" />
						Back to Dashboard
					</Link>

					<div className="grid gap-8 lg:grid-cols-[280px_1fr] lg:gap-12">
						{/* Profile Photo — Desktop */}
						<div className="hidden lg:block">
							<div className="aspect-2/3 overflow-hidden rounded-xl shadow-2xl">
								{profileUrl ? (
									<img
										src={profileUrl}
										alt={person.name}
										className="h-full w-full object-cover"
									/>
								) : (
									<div className="flex h-full w-full items-center justify-center bg-linear-to-br from-gray-700 to-gray-800">
										<span className="text-gray-400">No Photo</span>
									</div>
								)}
							</div>
						</div>

						{/* Info */}
						<div className="flex flex-col justify-end pb-8 lg:pb-16">
							{/* Mobile Photo + Name */}
							<div className="mb-6 flex gap-4 lg:hidden">
								<div className="h-40 w-28 shrink-0 overflow-hidden rounded-lg">
									{profileUrl ? (
										<img
											src={profileUrl}
											alt={person.name}
											className="h-full w-full object-cover"
										/>
									) : (
										<div className="h-full w-full bg-linear-to-br from-gray-700 to-gray-800" />
									)}
								</div>
								<div className="flex flex-col justify-center">
									<h1 className="text-display-2">{person.name}</h1>
								</div>
							</div>

							{/* Desktop Name */}
							<div className="hidden lg:block">
								<h1 className="text-display-2">{person.name}</h1>
							</div>

							{/* Meta */}
							<div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
								{person.known_for_department && (
									<span className="badge badge-accent">
										<Clapperboard className="mr-1 size-3" />
										{person.known_for_department}
									</span>
								)}
								{person.birthday && (
									<span className="flex items-center gap-1 text-(--foreground-muted)">
										<Calendar className="size-4" />
										Born {formatDate(person.birthday, userTimezone)}
										{age !== null && !person.deathday && ` (${age} years)`}
									</span>
								)}
								{person.deathday && (
									<span className="flex items-center gap-1 text-(--foreground-muted)">
										<Calendar className="size-4" />
										Died {formatDate(person.deathday, userTimezone)}
										{age !== null && ` (aged ${age})`}
									</span>
								)}
								{person.place_of_birth && (
									<span className="flex items-center gap-1 text-(--foreground-muted)">
										<MapPin className="size-4" />
										{person.place_of_birth}
									</span>
								)}
								{person.popularity !== undefined && (
									<span className="flex items-center gap-1 text-(--foreground-muted)">
										<Star className="size-4 fill-yellow-500 text-yellow-500" />
										{Math.round(person.popularity * 10) / 10}
									</span>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="container-app relative z-20 mt-8">
				<div className="grid gap-8 lg:grid-cols-[2fr_1fr] lg:gap-12">
					{/* Left Column */}
					<div className="space-y-8">
						{/* Biography */}
						{person.biography && (
							<section>
								<h2 className="mb-4 text-display-3">Biography</h2>
								<p className="whitespace-pre-line text-(--foreground-muted) leading-relaxed">
									{person.biography}
								</p>
							</section>
						)}

						{/* Known For */}
						{knownForItems.length > 0 && (
							<section>
								<h2 className="mb-4 text-display-3">Known For</h2>
								<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
									{knownForItems.map((item) => (
										<ActionableMediaCard
											key={`known-${item.id}-${item.media_type}`}
											id={item.id}
											title={item.title}
											posterUrl={
												item.poster_path
													? `https://image.tmdb.org/t/p/w300${item.poster_path}`
													: ""
											}
											type={item.media_type === "movie" ? "movie" : "show"}
											rating={
												item.vote_average
													? Math.round(item.vote_average * 10) / 10
													: undefined
											}
											size="sm"
											layout="poster"
										/>
									))}
								</div>
							</section>
						)}

						{/* Full Filmography */}
						<section>
							<h2 className="mb-4 text-display-3">Filmography</h2>
							{filmographyItems.length === 0 && !isFetchingNextPage ? (
								<p className="text-(--foreground-muted) text-sm">
									No filmography available.
								</p>
							) : (
								<>
									<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
										{filmographyItems.map((item) => (
											<ActionableMediaCard
												key={`film-${item.id}-${item.media_type}`}
												id={item.id}
												title={item.title}
												posterUrl={
													item.poster_path
														? `https://image.tmdb.org/t/p/w300${item.poster_path}`
														: ""
												}
												type={item.media_type === "movie" ? "movie" : "show"}
												rating={
													item.vote_average
														? Math.round(item.vote_average * 10) / 10
														: undefined
												}
												size="sm"
												layout="poster"
											/>
										))}
									</div>
									{hasNextPage && (
										<div className="mt-6 flex justify-center">
											<button
												type="button"
												onClick={() => fetchNextPage()}
												disabled={isFetchingNextPage}
												className="btn btn-secondary gap-2"
											>
												{isFetchingNextPage ? (
													<>
														<Loader2 className="size-4 animate-spin" />
														Loading...
													</>
												) : (
													"Load more"
												)}
											</button>
										</div>
									)}
								</>
							)}
						</section>
					</div>

					{/* Right Column - Sidebar */}
					<div className="space-y-6">
						<DetailsCard
							items={[
								{
									label: "Department",
									value: person.known_for_department || "Unknown",
								},
								{
									label: "Born",
									value: person.birthday
										? formatDate(person.birthday, userTimezone)
										: "Unknown",
								},
								{
									label: "Birthplace",
									value: person.place_of_birth || "Unknown",
								},
								{
									label: "Popularity",
									value:
										person.popularity !== undefined
											? String(Math.round(person.popularity * 10) / 10)
											: "N/A",
								},
								...(person.deathday
									? [
											{
												label: "Died",
												value: formatDate(person.deathday, userTimezone),
											},
										]
									: []),
							]}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
