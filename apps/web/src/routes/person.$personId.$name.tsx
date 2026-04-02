import {
	type PersonFilmographyItemDto,
	peopleControllerGetPersonDetailsOptions,
	type TmdbPersonDetailDto,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Calendar, Film, MapPin, Star, Tv } from "lucide-react";
import { useMemo } from "react";
import { DetailHero } from "@/components/detail";
import { useTheme } from "@/components/theme-provider";
import { getTmdbPosterUrl, getTmdbProfileUrl } from "@/lib/utils";

export const Route = createFileRoute("/person/$personId/$name")({
	loader: async ({ params, context }) => {
		const { personId } = params;
		const { queryClient } = context;

		const data = await queryClient.fetchQuery({
			...peopleControllerGetPersonDetailsOptions({
				path: { personId },
			}),
		});

		return data as TmdbPersonDetailDto;
	},
	head: ({ loaderData }) => {
		const profileUrl = loaderData?.profile_path
			? `https://image.tmdb.org/t/p/w500${loaderData.profile_path}`
			: null;
		const title = loaderData
			? `${loaderData.name} | OpnShelf`
			: "Person | OpnShelf";
		const url = typeof window !== "undefined" ? window.location.href : "";

		return {
			meta: [
				{ title },
				{
					name: "description",
					content: loaderData?.biography?.slice(0, 160) || "",
				},
				{ property: "og:title", content: title },
				{
					property: "og:description",
					content: loaderData?.biography?.slice(0, 160) || "",
				},
				{ property: "og:type", content: "profile" },
				{ property: "og:url", content: url },
				...(profileUrl ? [{ property: "og:image", content: profileUrl }] : []),
				{ name: "twitter:card", content: "summary_large_image" },
				{ name: "twitter:title", content: title },
				{
					name: "twitter:description",
					content: loaderData?.biography?.slice(0, 160) || "",
				},
				...(profileUrl ? [{ name: "twitter:image", content: profileUrl }] : []),
			],
		};
	},
	component: PersonDetailPage,
});

function formatDate(dateString?: string): string | null {
	if (!dateString) return null;
	return new Date(dateString).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

function formatLifespan(birthday?: string, deathday?: string): string | null {
	if (!birthday) return null;

	const birthYear = new Date(birthday).getFullYear();

	if (deathday) {
		const deathYear = new Date(deathday).getFullYear();
		return `${birthYear} - ${deathYear}`;
	}

	return `${birthYear} - Present`;
}

function PersonDetailPage() {
	const { personId, name } = Route.useParams();
	const router = useRouter();
	const { seedColor } = useTheme();

	const { data: personData, isLoading: isPersonLoading } = useQuery({
		...peopleControllerGetPersonDetailsOptions({
			path: { personId },
		}),
	});

	const person = personData as TmdbPersonDetailDto | undefined;

	const colors = {
		primary: seedColor,
		secondary: seedColor,
		accent: seedColor,
		muted: "var(--md-sys-color-surface-container)",
	};

	const profileUrl = getTmdbProfileUrl(person?.profile_path);

	const subtitle = useMemo(() => {
		const lifespan = formatLifespan(person?.birthday, person?.deathday);
		if (person?.known_for_department && lifespan) {
			return `${person.known_for_department} • ${lifespan}`;
		}
		if (person?.known_for_department) {
			return person.known_for_department;
		}
		if (lifespan) {
			return lifespan;
		}
		return null;
	}, [person?.birthday, person?.deathday, person?.known_for_department]);

	const metadataItems = useMemo(() => {
		const items = [];

		if (person?.birthday) {
			const birthLabel = person.deathday
				? `Born: ${formatDate(person.birthday)}`
				: `Birthday: ${formatDate(person.birthday)}`;
			items.push({
				icon: <Calendar className="w-4 h-4" />,
				label: birthLabel,
			});
		}

		if (person?.deathday) {
			items.push({
				icon: <Calendar className="w-4 h-4" />,
				label: `Died: ${formatDate(person.deathday)}`,
			});
		}

		if (person?.place_of_birth) {
			items.push({
				icon: <MapPin className="w-4 h-4" />,
				label: person.place_of_birth,
			});
		}

		if (person?.popularity) {
			items.push({
				icon: <Star className="w-4 h-4" />,
				label: `Popularity: ${person.popularity.toFixed(1)}`,
			});
		}

		return items;
	}, [person]);

	return (
		<div
			className="min-h-screen m3-background m3-on-background"
			style={{
				backgroundColor: "var(--md-sys-color-background)",
				color: "var(--md-sys-color-on-background)",
			}}
		>
			<DetailHero
				title={person?.name || name.replace(/-/g, " ")}
				subtitle={subtitle ?? undefined}
				backdropUrl={null}
				posterUrl={profileUrl}
				colors={colors}
				isLoading={isPersonLoading}
				onBack={() => router.history.back()}
			/>

			<div className="container mx-auto px-4 py-6 max-w-7xl">
				<div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8 min-w-0">
					<div className="space-y-4 min-w-0">
						{/* Sidebar content - could add actions later */}
						<div className="m3-surface-container rounded-xl p-4">
							<h3
								className="m3-title-medium mb-3"
								style={{ color: colors.primary }}
							>
								Personal Info
							</h3>
							<div className="space-y-2">
								{metadataItems.map((item) => (
									<div
										key={item.label}
										className="flex items-center gap-2 text-sm"
										style={{ color: "var(--md-sys-color-on-surface-variant)" }}
									>
										{item.icon}
										<span>{item.label}</span>
									</div>
								))}
							</div>
						</div>
					</div>

					<div className="space-y-6 min-w-0">
						{/* Biography Section */}
						{person?.biography && (
							<section>
								<h2
									className="text-xl font-semibold mb-3"
									style={{ color: colors.primary }}
								>
									Biography
								</h2>
								<p className="text-(--md-sys-color-on-surface-variant) leading-relaxed whitespace-pre-line">
									{person.biography}
								</p>
							</section>
						)}

						{/* Filmography Section */}
						<section>
							<h2
								className="text-xl font-semibold mb-4"
								style={{ color: colors.primary }}
							>
								Filmography
								<span className="ml-2 text-sm font-normal text-(--md-sys-color-on-surface-variant)">
									({person?.filmography?.length || 0} titles)
								</span>
							</h2>
							<div className="space-y-3">
								{person?.filmography?.map((item: PersonFilmographyItemDto) => (
									<FilmographyItem
										key={`${item.media_type}-${item.id}-${item.character || item.job || ""}`}
										item={item}
										colors={colors}
									/>
								))}
							</div>
						</section>
					</div>
				</div>
			</div>

			{isPersonLoading && (
				<div
					className="fixed inset-0 flex items-center justify-center z-50"
					style={{
						backgroundColor: "var(--md-sys-color-background)",
					}}
				>
					<div
						className="animate-spin rounded-full h-16 w-16 border-b-2"
						style={{ borderColor: colors.primary }}
					/>
				</div>
			)}
		</div>
	);
}

interface FilmographyItemProps {
	item: PersonFilmographyItemDto;
	colors: { primary: string };
}

function FilmographyItem({ item, colors }: FilmographyItemProps) {
	const year = item.release_date
		? new Date(item.release_date).getFullYear()
		: item.first_air_date
			? new Date(item.first_air_date).getFullYear()
			: null;

	const posterUrl = getTmdbPosterUrl(item.poster_path, "w92");

	const role = item.character || item.job || "";
	const department = item.department || "";

	// Determine the route based on media type
	const routeTo =
		item.media_type === "movie"
			? {
					to: "/movies/$movieId/$title",
					params: {
						movieId: String(item.id),
						title: item.title.toLowerCase().replace(/\s+/g, "-"),
					},
				}
			: {
					to: "/shows/$showId/$title",
					params: {
						showId: String(item.id),
						title: item.title.toLowerCase().replace(/\s+/g, "-"),
					},
				};

	return (
		<Link
			to={routeTo.to}
			params={routeTo.params}
			className="flex gap-4 p-3 rounded-lg transition-colors hover:bg-(--md-sys-color-surface-container) group"
		>
			{/* Poster */}
			<div className="shrink-0 w-16 aspect-2/3 rounded-md overflow-hidden bg-(--md-sys-color-surface-container-high)">
				{posterUrl ? (
					<img
						src={posterUrl}
						alt={item.title}
						className="w-full h-full object-cover"
						loading="lazy"
					/>
				) : (
					<div className="w-full h-full flex items-center justify-center">
						{item.media_type === "movie" ? (
							<Film className="w-6 h-6 text-(--md-sys-color-on-surface-variant)" />
						) : (
							<Tv className="w-6 h-6 text-(--md-sys-color-on-surface-variant)" />
						)}
					</div>
				)}
			</div>

			{/* Info */}
			<div className="flex-1 min-w-0">
				<div className="flex items-start justify-between gap-2">
					<div className="flex-1 min-w-0">
						<h3 className="font-medium line-clamp-1 group-hover:text-(--md-sys-color-primary) transition-colors">
							{item.title}
						</h3>
						<p className="text-sm text-(--md-sys-color-on-surface-variant) line-clamp-1">
							{role && <span>{role}</span>}
							{role && department && (
								<span className="text-(--md-sys-color-outline)"> • </span>
							)}
							{department && <span>{department}</span>}
						</p>
					</div>
					<div className="flex items-center gap-2 shrink-0">
						{/* Media Type Badge */}
						<span
							className="text-xs px-2 py-1 rounded-full"
							style={{
								backgroundColor: "var(--md-sys-color-surface-container-high)",
								color: "var(--md-sys-color-on-surface-variant)",
							}}
						>
							{item.media_type === "movie" ? "Movie" : "TV"}
						</span>
						{/* Year */}
						{year && (
							<span
								className="text-sm font-medium"
								style={{ color: colors.primary }}
							>
								{year}
							</span>
						)}
					</div>
				</div>
			</div>
		</Link>
	);
}
